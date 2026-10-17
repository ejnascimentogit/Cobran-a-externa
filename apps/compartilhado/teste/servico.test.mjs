import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { getEstado, reiniciarDemo } from '../store.js';
import * as s from '../servico.js';
import { hojeISO, somaDias } from '../formato.js';

beforeEach(() => reiniciarDemo());
const falha = (fn, trecho) => assert.throws(fn, e => e instanceof s.ErroNegocio && e.message.includes(trecho));

function rotaEnviada(codClientes = ['1001', '1002']) {
  const id = s.criarRota({ regraId: 'rg1', cobradorId: 'cb1', codClientes });
  s.enviarRota(id);
  return id;
}
const naParada = (rotaId, cod) => {
  const e = getEstado(), p = e.paradas.find(x => x.rotaId === rotaId && x.codCliente === cod), c = e.clientes.find(x => x.cod === cod);
  return { p, c, pos: { lat: c.lat, lng: c.lng } };
};

test('regra 1: faixas ativas não podem se sobrepor', () => {
  falha(() => s.salvarRegra({ nome: 'x', diasMin: 4, diasMax: 8 }), 'sobrepõe');
  s.salvarRegra({ nome: 'ok', diasMin: 61, diasMax: 90 });
});

test('regra 2: cliente com vários títulos vira um ponto com valores somados', () => {
  const item = s.carteiraPorRegra(getEstado(), 'rg1').find(i => i.cliente.cod === '1001');
  assert.equal(item.qtd, 2);
  assert.equal(item.valor, 1170.5);
});

test('regra 3: título em rota aberta não entra em outra rota no mesmo dia', () => {
  const id = s.criarRota({ regraId: 'rg1', cobradorId: 'cb1', codClientes: ['1001'] });
  assert.ok(!s.carteiraPorRegra(getEstado(), 'rg1').some(i => i.cliente.cod === '1001'));
  falha(() => s.criarRota({ regraId: 'rg1', cobradorId: 'cb2', codClientes: ['1001'] }), 'não está mais disponível');
  s.descartarRota(id);
  assert.ok(s.carteiraPorRegra(getEstado(), 'rg1').some(i => i.cliente.cod === '1001'));
});

test('rota nasce em rascunho, com ordem e previsão, e só o enviado chega ao app', () => {
  const id = s.criarRota({ regraId: 'rg1', cobradorId: 'cb1', codClientes: ['1001', '1002'] });
  const e = getEstado();
  assert.equal(e.rotas[0].status, 'rascunho');
  assert.deepEqual(e.paradas.map(p => p.ordem), [1, 2]);
  falha(() => s.iniciarRota(id, 'cb1', e.config.deposito), 'não foi enviada');
});

test('regra 4: fora do raio do GPS exige justificativa', () => {
  const id = rotaEnviada();
  s.iniciarRota(id, 'cb1', getEstado().config.deposito);
  const { p, c } = naParada(id, '1001');
  const longe = { lat: c.lat + 0.01, lng: c.lng };
  const base = { paradaId: p.id, cobradorId: 'cb1', ...longe, atendido: true, motivoId: 'mt5' };
  falha(() => s.registrarCheckin(base), 'justificativa');
  s.registrarCheckin({ ...base, observacao: 'Cliente pediu para encontrar na esquina' });
  assert.equal(getEstado().checkins.at(-1).foraDoRaio, true);
});

test('regra 5: negociação ou promessa exige data prometida', () => {
  const id = rotaEnviada();
  s.iniciarRota(id, 'cb1', getEstado().config.deposito);
  const { p, pos } = naParada(id, '1001');
  const base = { paradaId: p.id, cobradorId: 'cb1', ...pos, atendido: true };
  falha(() => s.registrarCheckin({ ...base, motivoId: 'mt2' }), 'data prometida');
  falha(() => s.registrarCheckin({ ...base, motivoId: 'mt3', negociou: true, valorNegociado: 500 }), 'data prometida');
  falha(() => s.registrarCheckin({ ...base, motivoId: 'mt2', dataPrometida: somaDias(hojeISO(), -1) }), 'passado');
});

test('regra 6: finalizar devolve os não visitados para a carteira', () => {
  const id = rotaEnviada();
  s.iniciarRota(id, 'cb1', getEstado().config.deposito);
  const { p, pos } = naParada(id, '1001');
  s.registrarCheckin({ paradaId: p.id, cobradorId: 'cb1', ...pos, atendido: true, pagou: true, valorRecebido: p.valorTotal, motivoId: 'mt1' });
  s.finalizarRota(id, 'cb1', getEstado().config.deposito);
  assert.equal(getEstado().rotas[0].status, 'finalizada');
  const carteira = s.carteiraPorRegra(getEstado(), 'rg1');
  assert.ok(carteira.some(i => i.cliente.cod === '1002'), 'não visitado volta');
  assert.ok(!carteira.some(i => i.cliente.cod === '1001'), 'pago na visita fica monitorado até a baixa: continua fora');
});

test('regra 7: promessa fica monitorada; baixa confere; passou da tolerância quebra', () => {
  const id = rotaEnviada();
  s.iniciarRota(id, 'cb1', getEstado().config.deposito);
  const a = naParada(id, '1001'), b = naParada(id, '1002');
  const prom = somaDias(hojeISO(), 1);
  s.registrarCheckin({ paradaId: a.p.id, cobradorId: 'cb1', ...a.pos, atendido: true, motivoId: 'mt2', dataPrometida: prom });
  s.registrarCheckin({ paradaId: b.p.id, cobradorId: 'cb1', ...b.pos, atendido: true, motivoId: 'mt2', dataPrometida: prom });
  assert.equal(getEstado().monitorados.length, 3);
  s.simularBaixa('T1002-1', '1002');
  assert.deepEqual(s.conferirBaixas(prom), { baixados: 1, quebrados: 0 });
  assert.deepEqual(s.conferirBaixas(somaDias(prom, 3)), { baixados: 0, quebrados: 2 });
  assert.ok(getEstado().monitorados.every(m => m.status !== 'aguardando'));
});

test('resumo da rota soma recebido, negociado e agrupa por motivo', () => {
  const id = rotaEnviada();
  s.iniciarRota(id, 'cb1', getEstado().config.deposito);
  const a = naParada(id, '1001');
  s.registrarCheckin({ paradaId: a.p.id, cobradorId: 'cb1', ...a.pos, atendido: true, pagou: true, valorRecebido: 100, motivoId: 'mt1' });
  const r = s.resumoRota(getEstado(), id);
  assert.equal(r.clientes, 2);
  assert.equal(r.visitados, 1);
  assert.equal(r.recebido, 100);
  assert.equal(r.porMotivo[0].descricao, 'Pagou no ato');
});

test('motoqueiro não mexe em parada de outro', () => {
  const id = rotaEnviada();
  s.iniciarRota(id, 'cb1', getEstado().config.deposito);
  const { p, pos } = naParada(id, '1001');
  falha(() => s.registrarCheckin({ paradaId: p.id, cobradorId: 'cb2', ...pos, atendido: true, motivoId: 'mt5' }), 'não é sua');
});

test('motivo precisa combinar com o resultado marcado', () => {
  const id = rotaEnviada();
  s.iniciarRota(id, 'cb1', getEstado().config.deposito);
  const { p, pos } = naParada(id, '1001');
  const base = { paradaId: p.id, cobradorId: 'cb1', ...pos };
  falha(() => s.registrarCheckin({ ...base, atendido: true, motivoId: 'mt1' }), 'exige marcar que o cliente pagou');
  falha(() => s.registrarCheckin({ ...base, atendido: true, motivoId: 'mt3', dataPrometida: somaDias(hojeISO(), 2) }), 'exige marcar que houve negociação');
  falha(() => s.registrarCheckin({ ...base, atendido: false, motivoId: 'mt2' }), 'não atendido');
  s.registrarCheckin({ ...base, atendido: false, motivoId: 'mt4' });
  assert.equal(getEstado().checkins.at(-1).resultado, 'nao_atendido');
});
