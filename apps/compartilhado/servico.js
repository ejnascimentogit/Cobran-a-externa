// Regras de negócio do docs/03-regras-de-negocio.md aplicadas sobre o store da demonstração.
// Cada função muda o estado inteiro ou não muda nada (lança ErroNegocio).
import { mutar } from './store.js';
import { distanciaM, ordenarVizinho } from './geo.js';
import { hojeISO, diasEntre, somaDias } from './formato.js';

export class ErroNegocio extends Error {}
const erro = msg => { throw new ErroNegocio(msg); };
const uid = p => `${p}_${Math.random().toString(36).slice(2, 9)}`;
const agoraISO = () => new Date().toISOString();

export const ROTA_ABERTA = ['rascunho', 'enviada', 'em_andamento'];
export const diasAtraso = (vencimento, hoje = hojeISO()) => diasEntre(vencimento, hoje);

/* ---------- M1. Regras por faixa de atraso ---------- */

export function salvarRegra(dados) {
  mutar(e => {
    const nome = (dados.nome || '').trim();
    const diasMin = Number(dados.diasMin), diasMax = Number(dados.diasMax);
    if (!nome) erro('Informe o nome da regra.');
    if (!Number.isInteger(diasMin) || !Number.isInteger(diasMax) || diasMin < 0 || diasMin > diasMax)
      erro('A faixa de dias é inválida (mínimo não pode passar do máximo).');
    const ativa = dados.ativa ?? true;
    if (ativa) validarSemSobreposicao(e, { id: dados.id, diasMin, diasMax });
    const nova = { id: dados.id || uid('rg'), nome, diasMin, diasMax, ativa, prioridade: Number(dados.prioridade) || 99 };
    const i = e.regras.findIndex(r => r.id === nova.id);
    if (i >= 0) e.regras[i] = nova; else e.regras.push(nova);
  });
}

export function alternarRegra(id) {
  mutar(e => {
    const r = e.regras.find(x => x.id === id);
    if (!r) erro('Regra não encontrada.');
    if (!r.ativa) validarSemSobreposicao(e, r);
    r.ativa = !r.ativa;
  });
}

// Regra 1: faixas ativas não podem se sobrepor.
function validarSemSobreposicao(e, regra) {
  const choque = e.regras.find(o => o.ativa && o.id !== regra.id && o.diasMin <= regra.diasMax && regra.diasMin <= o.diasMax);
  if (choque) erro(`A faixa se sobrepõe à regra "${choque.nome}" (${choque.diasMin} a ${choque.diasMax} dias).`);
}

/* ---------- M2. Carteira e montagem da rota ---------- */

// Clientes com títulos em aberto dentro da faixa, um ponto por cliente (regra 2).
// Fora da carteira: título já em rota aberta no dia (regra 3) e título aguardando
// promessa/pagamento (regra 7).
export function carteiraPorRegra(e, regraId, hoje = hojeISO()) {
  const regra = e.regras.find(r => r.id === regraId);
  if (!regra) return [];
  const chave = (t, c) => `${t}|${c}`;
  const ocupados = new Set();
  for (const rota of e.rotas)
    if (rota.data === hoje && ROTA_ABERTA.includes(rota.status))
      e.paradaTitulos.filter(p => p.rotaId === rota.id).forEach(p => ocupados.add(chave(p.codTitulo, p.codCliente)));
  e.monitorados.filter(m => m.status === 'aguardando').forEach(m => ocupados.add(chave(m.codTitulo, m.codCliente)));

  const porCliente = new Map();
  for (const t of e.titulos) {
    if (t.dataPagamento || t.situacaoErp !== 'aberto') continue;
    const dias = diasAtraso(t.vencimento, hoje);
    if (dias < regra.diasMin || dias > regra.diasMax || ocupados.has(chave(t.codTitulo, t.codCliente))) continue;
    const cliente = e.clientes.find(c => c.cod === t.codCliente);
    if (!cliente) continue;
    const item = porCliente.get(cliente.cod) || { cliente, titulos: [], qtd: 0, valor: 0, diasMax: 0 };
    item.titulos.push({ ...t, dias });
    item.qtd += 1;
    item.valor += t.valorAberto;
    item.diasMax = Math.max(item.diasMax, dias);
    porCliente.set(cliente.cod, item);
  }
  return [...porCliente.values()].sort((a, b) => b.diasMax - a.diasMax);
}

export function criarRota({ regraId, cobradorId, codClientes, metaVisitas, analista = 'analista' }) {
  return mutar(e => {
    const hoje = hojeISO();
    const regra = e.regras.find(r => r.id === regraId) || erro('Escolha a regra da rota.');
    const cobrador = e.cobradores.find(c => c.id === cobradorId && c.ativo) || erro('Escolha um motoqueiro ativo.');
    if (!codClientes?.length) erro('Selecione ao menos um cliente.');

    const carteira = carteiraPorRegra(e, regraId, hoje);
    const itens = codClientes.map(cod => carteira.find(i => i.cliente.cod === cod) || erro(`O cliente ${cod} não está mais disponível (já está em outra rota aberta ou saiu da faixa).`));
    const semCoord = itens.find(i => i.cliente.lat == null || i.cliente.lng == null);
    if (semCoord) erro(`O cliente "${semCoord.cliente.nome}" não tem coordenadas (precisa geocodificar o endereço).`);

    const { deposito, inicioRota, minutosPorVisita, velocidadeKmH } = e.config;
    const ordem = ordenarVizinho(deposito, itens.map(i => ({ ...i.cliente, item: i })));
    const [hh, mm] = inicioRota.split(':').map(Number);
    let relogio = new Date(); relogio.setHours(hh, mm, 0, 0);
    let ponto = deposito;

    const praca = [...new Set(itens.map(i => i.cliente.praca))];
    const rota = {
      id: uid('rt'), data: hoje, regraId: regra.id, praca: praca.length === 1 ? praca[0] : 'Várias praças',
      analista, status: 'rascunho', metaVisitas: Number(metaVisitas) || itens.length, criadoEm: agoraISO(),
    };
    e.rotas.push(rota);
    e.rotaCobradores.push({ rotaId: rota.id, cobradorId: cobrador.id, qtdClientes: itens.length, inicioEm: null, fimEm: null });

    ordem.forEach((p, idx) => {
      relogio = new Date(relogio.getTime() + (distanciaM(ponto, p) / 1000 / velocidadeKmH) * 3600000);
      const parada = {
        id: uid('pr'), rotaId: rota.id, cobradorId: cobrador.id, codCliente: p.cod, ordem: idx + 1,
        previsaoChegada: relogio.toISOString(), valorTotal: p.item.valor, qtdTitulos: p.item.qtd,
      };
      e.paradas.push(parada);
      p.item.titulos.forEach(t => e.paradaTitulos.push({ paradaId: parada.id, rotaId: rota.id, codTitulo: t.codTitulo, codCliente: t.codCliente }));
      relogio = new Date(relogio.getTime() + minutosPorVisita * 60000);
      ponto = p;
    });
    return rota.id;
  });
}

export function enviarRota(rotaId) {
  mutar(e => {
    const rota = e.rotas.find(r => r.id === rotaId) || erro('Rota não encontrada.');
    if (rota.status !== 'rascunho') erro('Só rota em rascunho pode ser enviada.');
    rota.status = 'enviada';
  });
}

export function descartarRota(rotaId) {
  mutar(e => {
    const rota = e.rotas.find(r => r.id === rotaId) || erro('Rota não encontrada.');
    if (rota.status !== 'rascunho') erro('Só rota em rascunho pode ser descartada.');
    e.rotas = e.rotas.filter(r => r.id !== rotaId);
    e.rotaCobradores = e.rotaCobradores.filter(r => r.rotaId !== rotaId);
    e.paradas = e.paradas.filter(p => p.rotaId !== rotaId);
    e.paradaTitulos = e.paradaTitulos.filter(p => p.rotaId !== rotaId);
  });
}

/* ---------- M3. App do motoqueiro ---------- */

export function registrarConsentimento(cobradorId) {
  mutar(e => { (e.cobradores.find(c => c.id === cobradorId) || erro('Motoqueiro não encontrado.')).consentimentoEm = agoraISO(); });
}

export function iniciarRota(rotaId, cobradorId, pos) {
  mutar(e => {
    const rota = e.rotas.find(r => r.id === rotaId) || erro('Rota não encontrada.');
    const rc = e.rotaCobradores.find(r => r.rotaId === rotaId && r.cobradorId === cobradorId) || erro('Esta rota não é sua.');
    if (!['enviada', 'em_andamento'].includes(rota.status)) erro('A rota ainda não foi enviada pelo analista.');
    if (rc.inicioEm) return;
    rc.inicioEm = agoraISO();
    rota.status = 'em_andamento';
    e.checkins.push({ id: uid('ck'), tipo: 'inicio', rotaId, cobradorId, paradaId: null, lat: pos.lat, lng: pos.lng, registradoEm: rc.inicioEm });
    e.rastreamento.push({ cobradorId, rotaId, lat: pos.lat, lng: pos.lng, registradoEm: rc.inicioEm });
  });
}

export function resultadoDoCheckin(c) {
  if (!c.atendido) return 'nao_atendido';
  if (c.pagou) return 'pago_na_visita';
  if (c.negociou) return 'negociado';
  if (c.dataPrometida) return 'promessa';
  return 'sem_sucesso';
}

export function registrarCheckin(d) {
  return mutar(e => {
    const parada = e.paradas.find(p => p.id === d.paradaId) || erro('Parada não encontrada.');
    const rota = e.rotas.find(r => r.id === parada.rotaId);
    if (parada.cobradorId !== d.cobradorId) erro('Esta parada não é sua.');
    if (rota.status !== 'em_andamento') erro('Inicie a rota antes de fazer check-in.');
    if (e.checkins.some(c => c.tipo === 'visita' && c.paradaId === parada.id)) erro('Este cliente já tem check-in.');

    const motivo = e.motivos.find(m => m.id === d.motivoId && m.ativo) || erro('Escolha o motivo.');
    const cliente = e.clientes.find(c => c.cod === parada.codCliente);
    const dist = Math.round(distanciaM({ lat: d.lat, lng: d.lng }, cliente));
    const foraDoRaio = dist > e.config.raioGpsM;
    const observacao = (d.observacao || '').trim();
    if (foraDoRaio && !observacao) erro(`Você está a ${dist} m do cliente (limite ${e.config.raioGpsM} m). Escreva a justificativa nas observações.`);

    const atendido = !!d.atendido;
    const pagou = atendido && !!d.pagou, negociou = atendido && !!d.negociou;
    const valorRecebido = pagou ? Number(d.valorRecebido) || 0 : 0;
    const valorNegociado = negociou ? Number(d.valorNegociado) || 0 : 0;
    const dataPrometida = atendido ? d.dataPrometida || null : null;
    // Coerência entre o motivo escolhido e o que foi marcado.
    if (motivo.tipo === 'pago' && !pagou) erro(`O motivo "${motivo.descricao}" exige marcar que o cliente pagou.`);
    if (motivo.tipo === 'negociado' && !negociou) erro(`O motivo "${motivo.descricao}" exige marcar que houve negociação.`);
    if (!atendido && ['pago', 'negociado', 'promessa'].includes(motivo.tipo)) erro('Cliente não atendido: escolha um motivo sem acordo.');
    if (pagou && (valorRecebido <= 0 || valorRecebido > parada.valorTotal + 0.001)) erro('Informe o valor recebido (até o total do cliente).');
    if (negociou && valorNegociado <= 0) erro('Informe o valor negociado.');
    if ((negociou || motivo.tipo === 'promessa') && !dataPrometida) erro('Negociação ou promessa exige a data prometida.'); // regra 5
    if (dataPrometida && dataPrometida < hojeISO()) erro('A data prometida não pode estar no passado.');

    const checkin = {
      id: uid('ck'), tipo: 'visita', rotaId: rota.id, cobradorId: d.cobradorId, paradaId: parada.id,
      lat: d.lat, lng: d.lng, registradoEm: agoraISO(), atendido, negociou, pagou, valorRecebido, valorNegociado,
      dataPrometida, motivoId: motivo.id, observacao, distanciaM: dist, foraDoRaio,
    };
    checkin.resultado = resultadoDoCheckin(checkin);
    e.checkins.push(checkin);
    e.rastreamento.push({ cobradorId: d.cobradorId, rotaId: rota.id, lat: d.lat, lng: d.lng, registradoEm: checkin.registradoEm });

    // Títulos tratados passam a ser conferidos contra a baixa do ERP.
    if (['pago_na_visita', 'negociado', 'promessa'].includes(checkin.resultado))
      e.paradaTitulos.filter(p => p.paradaId === parada.id).forEach(p =>
        e.monitorados.push({
          id: uid('mn'), codTitulo: p.codTitulo, codCliente: p.codCliente, checkinId: checkin.id,
          status: 'aguardando', dataPrometida: dataPrometida || hojeISO(), dataBaixa: null,
        }));
    return checkin.id;
  });
}

export function finalizarRota(rotaId, cobradorId, pos) {
  mutar(e => {
    const rota = e.rotas.find(r => r.id === rotaId) || erro('Rota não encontrada.');
    const rc = e.rotaCobradores.find(r => r.rotaId === rotaId && r.cobradorId === cobradorId) || erro('Esta rota não é sua.');
    if (!rc.inicioEm) erro('A rota ainda não foi iniciada.');
    if (rc.fimEm) erro('A rota já foi finalizada.');
    rc.fimEm = agoraISO();
    e.checkins.push({ id: uid('ck'), tipo: 'finalizacao', rotaId, cobradorId, paradaId: null, lat: pos.lat, lng: pos.lng, registradoEm: rc.fimEm });
    e.rastreamento.push({ cobradorId, rotaId, lat: pos.lat, lng: pos.lng, registradoEm: rc.fimEm });
    // Regra 6: quem não foi visitado volta sozinho para a carteira (a rota deixa de ser "aberta").
    if (e.rotaCobradores.filter(r => r.rotaId === rotaId).every(r => r.fimEm)) rota.status = 'finalizada';
  });
}

export function registrarPosicao(cobradorId, rotaId, pos) {
  mutar(e => {
    const rota = e.rotas.find(r => r.id === rotaId);
    if (rota?.status !== 'em_andamento') return;
    e.rastreamento.push({ cobradorId, rotaId, lat: pos.lat, lng: pos.lng, registradoEm: agoraISO() });
    if (e.rastreamento.length > 1500) e.rastreamento = e.rastreamento.slice(-1000);
  });
}

/* ---------- M6. Acompanhamento pós-cobrança ---------- */

// Regra 7: promessa vale até a data prometida + tolerância (aqui em dias corridos;
// dias úteis dependem de calendário de feriados, ponto em aberto).
export function conferirBaixas(hoje = hojeISO()) {
  return mutar(e => {
    const r = { baixados: 0, quebrados: 0 };
    for (const m of e.monitorados) {
      if (m.status !== 'aguardando') continue;
      const t = e.titulos.find(x => x.codTitulo === m.codTitulo && x.codCliente === m.codCliente);
      if (t?.dataPagamento) { m.status = 'baixado'; m.dataBaixa = t.dataPagamento; r.baixados++; }
      else if (somaDias(m.dataPrometida, e.config.toleranciaPromessaDias) < hoje) { m.status = 'promessa_quebrada'; r.quebrados++; }
    }
    return r;
  });
}

// SÓ DEMONSTRAÇÃO: imita a baixa que a integração do ERP (Ryan) vai trazer.
export function simularBaixa(codTitulo, codCliente) {
  mutar(e => {
    const t = e.titulos.find(x => x.codTitulo === codTitulo && x.codCliente === codCliente) || erro('Título não encontrado.');
    t.dataPagamento = hojeISO();
    t.valorAberto = 0;
  });
}

/* ---------- M4 e M5. Leitura para mapa e relatório ---------- */

export function resumoRota(e, rotaId, agora = new Date()) {
  const paradas = e.paradas.filter(p => p.rotaId === rotaId).sort((a, b) => a.ordem - b.ordem);
  const visitas = new Map(e.checkins.filter(c => c.rotaId === rotaId && c.tipo === 'visita').map(c => [c.paradaId, c]));
  const linhas = paradas.map(p => ({
    parada: p, cliente: e.clientes.find(c => c.cod === p.codCliente), cobrador: e.cobradores.find(c => c.id === p.cobradorId),
    checkin: visitas.get(p.id) || null, resultado: visitas.get(p.id)?.resultado || 'pendente',
  }));
  const soma = (arr, f) => arr.reduce((s, x) => s + f(x), 0);
  const porMotivo = {}, porCobrador = {};
  for (const l of linhas) {
    const cb = (porCobrador[l.cobrador.id] ||= { nome: l.cobrador.nome, clientes: 0, titulos: 0, valor: 0, visitados: 0, recebido: 0, negociado: 0 });
    cb.clientes++; cb.titulos += l.parada.qtdTitulos; cb.valor += l.parada.valorTotal;
    if (l.checkin) {
      cb.visitados++; cb.recebido += l.checkin.valorRecebido; cb.negociado += l.checkin.valorNegociado;
      const m = e.motivos.find(x => x.id === l.checkin.motivoId);
      const pm = (porMotivo[m.id] ||= { descricao: m.descricao, tipo: m.tipo, qtd: 0, valor: 0 });
      pm.qtd++; pm.valor += l.parada.valorTotal;
    }
  }
  return {
    linhas, porMotivo: Object.values(porMotivo), porCobrador: Object.values(porCobrador),
    clientes: linhas.length, titulos: soma(paradas, p => p.qtdTitulos), valorTotal: soma(paradas, p => p.valorTotal),
    visitados: visitas.size, recebido: soma([...visitas.values()], c => c.valorRecebido),
    negociado: soma([...visitas.values()], c => c.valorNegociado),
    previstoAteAgora: paradas.filter(p => new Date(p.previsaoChegada) <= agora).length,
  };
}
