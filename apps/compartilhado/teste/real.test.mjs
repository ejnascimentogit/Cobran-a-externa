import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validarVisita, hojeBRT, resultadoDaVisita } from '../real/validacao.js';
import { criarEnviar, traduzirResposta } from '../real/envio.js';

const parada = { cob06_latitude: -23.55, cob06_longitude: -46.63, cob06_valor_total: 1000 };
const motivos = {
  pago: { cob03_id: 1, cob03_nome: 'Pagou no ato', cob03_tipo: 'pago' },
  promessa: { cob03_id: 2, cob03_nome: 'Prometeu pagar', cob03_tipo: 'promessa' },
  negociado: { cob03_id: 3, cob03_nome: 'Negociou parcelamento', cob03_tipo: 'negociado' },
  sem: { cob03_id: 4, cob03_nome: 'Cliente ausente', cob03_tipo: 'sem_sucesso' },
};
const perto = { lat: -23.5501, lng: -46.6301 };
const longe = { lat: -23.54, lng: -46.63 };
const ctx = (motivo, extra = {}) => ({ parada, motivo, raioM: 200, agora: new Date('2026-10-20T15:00:00Z'), ...extra });

test('visita completa e normalizada: pagou no ato', () => {
  const r = validarVisita({ ...perto, atendido: true, pagou: true, valorRecebido: '1000', motivoId: 1 }, ctx(motivos.pago));
  assert.equal(r.ok, true);
  assert.equal(r.resultado, 'pago_na_visita');
  assert.equal(r.linha.cob08_valor_recebido, 1000);
  assert.equal(r.linha.cob08_motivo_id, 1);
  assert.equal(r.foraDoRaio, false);
});

test('não atendido zera pagamento, negociação e data', () => {
  const r = validarVisita({ ...perto, atendido: false, pagou: true, valorRecebido: 5, negociou: true, dataPrometida: '2026-10-25', motivoId: 4 }, ctx(motivos.sem));
  assert.equal(r.ok, true);
  assert.equal(r.resultado, 'nao_atendido');
  assert.deepEqual([r.linha.cob08_pagou, r.linha.cob08_negociou, r.linha.cob08_valor_recebido, r.linha.cob08_data_prometida], [false, false, 0, null]);
});

test('regra 4: fora do raio exige justificativa; com justificativa passa e marca fora', () => {
  const base = { ...longe, atendido: true, motivoId: 4 };
  const sem = validarVisita(base, ctx(motivos.sem));
  assert.equal(sem.ok, false);
  assert.match(sem.erro, /justificativa/);
  const com = validarVisita({ ...base, observacao: 'Cliente pediu para encontrar na esquina' }, ctx(motivos.sem));
  assert.equal(com.ok, true);
  assert.equal(com.foraDoRaio, true);
});

test('cliente sem coordenadas conta como fora do raio', () => {
  const sem = validarVisita({ ...perto, atendido: true }, ctx(motivos.sem, { parada: { ...parada, cob06_latitude: null, cob06_longitude: null } }));
  assert.equal(sem.ok, false);
  assert.match(sem.erro, /sem coordenadas/);
});

test('regra 5 e motivo coerente com o resultado', () => {
  assert.match(validarVisita({ ...perto, atendido: true, motivoId: 2 }, ctx(motivos.promessa)).erro, /data prometida/);
  assert.match(validarVisita({ ...perto, atendido: true, negociou: true, valorNegociado: 100, motivoId: 3 }, ctx(motivos.negociado)).erro, /data prometida/);
  assert.match(validarVisita({ ...perto, atendido: true, motivoId: 1 }, ctx(motivos.pago)).erro, /exige marcar que o cliente pagou/);
  assert.match(validarVisita({ ...perto, atendido: true, dataPrometida: '2026-10-25', motivoId: 3 }, ctx(motivos.negociado)).erro, /exige marcar que houve negociação/);
  assert.match(validarVisita({ ...perto, atendido: false, motivoId: 2 }, ctx(motivos.promessa)).erro, /não atendido/);
});

test('data prometida: não pode estar no passado (data do evento, fuso de Brasília)', () => {
  const r = validarVisita({ ...perto, atendido: true, dataPrometida: '2026-10-19', motivoId: 2 }, ctx(motivos.promessa));
  assert.match(r.erro, /passado/);
  assert.equal(validarVisita({ ...perto, atendido: true, dataPrometida: '2026-10-20', motivoId: 2 }, ctx(motivos.promessa)).ok, true);
  assert.equal(hojeBRT(new Date('2026-10-20T02:00:00Z')), '2026-10-19'); // 23h em Brasília ainda é dia 19
});

test('valor recebido: positivo e até o total do cliente', () => {
  const base = { ...perto, atendido: true, pagou: true, motivoId: 1 };
  assert.match(validarVisita({ ...base, valorRecebido: 1000.01 }, ctx(motivos.pago)).erro, /valor recebido/i);
  assert.match(validarVisita({ ...base, valorRecebido: 0 }, ctx(motivos.pago)).erro, /valor recebido/i);
});

test('falta marcar atendido ou escolher o motivo', () => {
  assert.match(validarVisita({ ...perto, atendido: null }, ctx(motivos.sem)).erro, /atendido/);
  assert.match(validarVisita({ ...perto, atendido: true }, ctx(undefined)).erro, /motivo/);
});

test('resultadoDaVisita', () => {
  assert.equal(resultadoDaVisita({ atendido: true, dataPrometida: '2026-10-25' }), 'promessa');
  assert.equal(resultadoDaVisita({ atendido: true }), 'sem_sucesso');
});

// ---- envio ----
const fake = respostas => {
  const chamadas = [];
  return {
    chamadas,
    from: tabela => ({ insert: async linha => { chamadas.push({ tabela, linha }); const r = respostas.shift(); if (r instanceof Error) throw r; return r; } }),
  };
};

test('visita vai para cob08_checkin com uuid e hora do aparelho; posição para cob09_rastreamento', async () => {
  const sb = fake([{ error: null, status: 201 }, { error: null, status: 201 }]);
  const enviar = criarEnviar(sb);
  const hora = '2026-10-20T10:00:00.000Z';
  assert.deepEqual(await enviar({ id: 'u1', tipo: 'visita', aparelhoEm: hora, dados: { cob08_rota_id: 7 } }), { ok: true });
  assert.deepEqual(await enviar({ id: 'u2', tipo: 'posicao', aparelhoEm: hora, dados: { cob09_rota_id: 7 } }), { ok: true });
  assert.deepEqual(sb.chamadas[0], { tabela: 'cob08_checkin', linha: { cob08_rota_id: 7, cob08_tipo: 'visita', cob08_uuid: 'u1', cob08_aparelho_em: hora } });
  assert.deepEqual(sb.chamadas[1], { tabela: 'cob09_rastreamento', linha: { cob09_rota_id: 7, cob09_uuid: 'u2', cob09_aparelho_em: hora } });
});

test('o tipo do evento vira cob08_tipo (início e fim)', async () => {
  const sb = fake([{ error: null, status: 201 }, { error: null, status: 201 }]);
  const enviar = criarEnviar(sb);
  await enviar({ id: 'a', tipo: 'inicio', aparelhoEm: 'x', dados: {} });
  await enviar({ id: 'b', tipo: 'finalizacao', aparelhoEm: 'x', dados: {} });
  assert.deepEqual(sb.chamadas.map(c => c.linha.cob08_tipo), ['inicio', 'finalizacao']);
});

test('tradução das respostas do banco', () => {
  assert.deepEqual(traduzirResposta({ error: null, status: 201 }), { ok: true });
  assert.deepEqual(traduzirResposta({ error: { code: '23505', message: 'duplicate' }, status: 409 }), { ok: true });
  assert.deepEqual(traduzirResposta({ error: { code: '', message: 'TypeError: Failed to fetch' }, status: 0 }), { ok: false, rede: true });
  assert.deepEqual(traduzirResposta({ error: { code: '', message: 'x' }, status: 503 }), { ok: false, rede: true });
  assert.deepEqual(traduzirResposta({ error: { code: 'PGRST301', message: 'JWT expired' }, status: 401 }), { ok: false, rede: true });
  assert.deepEqual(traduzirResposta({ error: { code: 'P0001', message: 'Escolha um motivo ativo.' }, status: 400 }),
    { ok: false, codigo: 'P0001', mensagem: 'Escolha um motivo ativo.' });
  assert.deepEqual(traduzirResposta({ error: { code: '42501', message: 'new row violates row-level security policy' }, status: 403 }),
    { ok: false, codigo: '42501', mensagem: 'new row violates row-level security policy' });
});

test('exceção do envio conta como falta de sinal', async () => {
  const enviar = criarEnviar(fake([new Error('fetch failed')]));
  assert.deepEqual(await enviar({ id: 'a', tipo: 'visita', aparelhoEm: 'x', dados: {} }), { ok: false, rede: true });
});
