// Mesmas regras que o banco aplica no check-in (cob08_validar_checkin e as restrições da tabela),
// conferidas NO APARELHO para o motoqueiro receber o aviso na hora, mesmo sem sinal. O banco continua
// sendo quem decide: se uma regra mudar lá, mude aqui também.
import { distanciaM } from '../geo.js';

export const hojeBRT = (d = new Date()) => d.toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' });

export function resultadoDaVisita(v) {
  if (!v.atendido) return 'nao_atendido';
  if (v.pagou) return 'pago_na_visita';
  if (v.negociou) return 'negociado';
  if (v.dataPrometida) return 'promessa';
  return 'sem_sucesso';
}

// d: o que o formulário tem; ctx: { parada (linha de cob06), motivo (linha de cob03), raioM, agora }
export function validarVisita(d, { parada, motivo, raioM, agora = new Date() }) {
  const erro = mensagem => ({ ok: false, erro: mensagem });
  if (d.atendido === null || d.atendido === undefined) return erro('Informe se o cliente foi atendido.');
  if (!motivo) return erro('Escolha o motivo.');

  const atendido = !!d.atendido;
  const pagou = atendido && !!d.pagou;
  const negociou = atendido && !!d.negociou;
  const valorRecebido = pagou ? Number(d.valorRecebido) || 0 : 0;
  const valorNegociado = negociou ? Number(d.valorNegociado) || 0 : 0;
  const dataPrometida = atendido ? d.dataPrometida || null : null;
  const observacao = (d.observacao || '').trim();

  let distancia = null;
  let fora = false;
  if (parada.cob06_latitude == null) {
    fora = true; // sem coordenada do cliente não dá para conferir: exige justificativa
  } else {
    distancia = Math.round(distanciaM(
      { lat: d.lat, lng: d.lng },
      { lat: Number(parada.cob06_latitude), lng: Number(parada.cob06_longitude) },
    ));
    fora = distancia > raioM;
  }
  if (fora && !observacao) {
    return erro(distancia === null
      ? 'O cliente está sem coordenadas no cadastro. Escreva a justificativa nas observações.'
      : `Você está a ${distancia} m do cliente (limite ${raioM} m). Escreva a justificativa nas observações.`);
  }

  if (motivo.cob03_tipo === 'pago' && !pagou) return erro(`O motivo "${motivo.cob03_nome}" exige marcar que o cliente pagou.`);
  if (motivo.cob03_tipo === 'negociado' && !negociou) return erro(`O motivo "${motivo.cob03_nome}" exige marcar que houve negociação.`);
  if (!atendido && ['pago', 'negociado', 'promessa'].includes(motivo.cob03_tipo)) {
    return erro('Cliente não atendido: escolha um motivo sem acordo.');
  }
  if (pagou && (valorRecebido <= 0 || valorRecebido > Number(parada.cob06_valor_total))) {
    return erro('Informe o valor recebido (até o total do cliente).');
  }
  if (negociou && valorNegociado <= 0) return erro('Informe o valor negociado.');
  if ((negociou || motivo.cob03_tipo === 'promessa') && !dataPrometida) {
    return erro('Negociação ou promessa exige a data prometida.');
  }
  if (dataPrometida && dataPrometida < hojeBRT(agora)) return erro('A data prometida não pode estar no passado.');

  const visita = { atendido, negociou, pagou, dataPrometida };
  return {
    ok: true,
    resultado: resultadoDaVisita(visita),
    distanciaM: distancia,
    foraDoRaio: fora,
    // colunas de cob08_checkin (o envio acrescenta uuid e hora do aparelho)
    linha: {
      cob08_atendido: atendido,
      cob08_negociou: negociou,
      cob08_pagou: pagou,
      cob08_valor_recebido: valorRecebido,
      cob08_valor_negociado: valorNegociado,
      cob08_data_prometida: dataPrometida,
      cob08_motivo_id: motivo.cob03_id,
      cob08_observacao: observacao || null,
    },
  };
}
