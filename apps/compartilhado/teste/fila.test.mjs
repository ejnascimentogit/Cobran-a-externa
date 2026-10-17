import { test } from 'node:test';
import assert from 'node:assert/strict';
import { criarFila } from '../fila.js';

const memoria = (inicial = []) => {
  let dados = structuredClone(inicial);
  return { carregar: async () => structuredClone(dados), salvar: async l => { dados = structuredClone(l); }, ver: () => dados };
};
let n = 0;
const base = { gerarId: () => `ev${++n}` };

test('sobe na ordem em que aconteceu e esvazia a fila', async () => {
  const enviados = [];
  const f = await criarFila({ ...base, armazenamento: memoria(), enviar: async e => { enviados.push(e.tipo); return { ok: true }; } });
  await f.adicionar('inicio', {});
  await f.adicionar('visita', { cliente: 1 });
  await f.adicionar('visita', { cliente: 2 });
  await f.adicionar('finalizacao', {});
  const r = await f.sincronizar();
  assert.deepEqual(enviados, ['inicio', 'visita', 'visita', 'finalizacao']);
  assert.equal(r.enviados, 4);
  assert.equal(r.pendentes, 0);
});

test('sem sinal: para, guarda tudo e continua de onde parou quando o sinal volta', async () => {
  let comSinal = false;
  const enviados = [];
  const f = await criarFila({ ...base, armazenamento: memoria(), enviar: async e => {
    if (!comSinal) return { ok: false, rede: true };
    enviados.push(e.id); return { ok: true };
  } });
  const a = await f.adicionar('inicio', {});
  const b = await f.adicionar('visita', {});
  let r = await f.sincronizar();
  assert.equal(r.parou, 'rede');
  assert.equal(r.pendentes, 2);
  assert.equal(f.lista()[0].tentativas, 0, 'falta de sinal não gasta tentativa');
  comSinal = true;
  r = await f.sincronizar();
  assert.deepEqual(enviados, [a.id, b.id]);
  assert.equal(r.pendentes, 0);
});

test('exceção do envio conta como falta de sinal', async () => {
  const f = await criarFila({ ...base, armazenamento: memoria(), enviar: async () => { throw new Error('fetch failed'); } });
  await f.adicionar('visita', {});
  const r = await f.sincronizar();
  assert.equal(r.parou, 'rede');
  assert.equal(r.pendentes, 1);
});

test('a fila sobrevive ao fechar o app (volta do armazenamento)', async () => {
  const arm = memoria();
  const f1 = await criarFila({ ...base, armazenamento: arm, enviar: async () => ({ ok: false, rede: true }) });
  await f1.adicionar('inicio', {});
  await f1.adicionar('visita', {});
  const f2 = await criarFila({ ...base, armazenamento: arm, enviar: async () => ({ ok: true }) });
  assert.equal(f2.resumo().pendentes, 2);
  assert.equal((await f2.sincronizar()).pendentes, 0);
});

test('o banco já tinha o evento (23505): conta como enviado, sem duplicar', async () => {
  // quem monta `enviar` converte 23505 em { ok: true }; aqui só se garante que a fila remove o evento
  const f = await criarFila({ ...base, armazenamento: memoria(), enviar: async () => ({ ok: true }) });
  await f.adicionar('visita', {});
  assert.equal((await f.sincronizar()).pendentes, 0);
});

test('visita recusada fica marcada com o motivo e não trava as outras', async () => {
  const f = await criarFila({ ...base, armazenamento: memoria(), enviar: async e =>
    e.dados.cliente === 1 ? { ok: false, codigo: 'P0001', mensagem: 'Escolha um motivo ativo.' } : { ok: true } });
  await f.adicionar('visita', { cliente: 1 });
  await f.adicionar('visita', { cliente: 2 });
  const r = await f.sincronizar();
  assert.equal(r.enviados, 1);
  assert.equal(r.comErro, 1);
  assert.equal(f.lista()[0].erro.mensagem, 'Escolha um motivo ativo.');
});

test('início recusado para tudo: o resto depende dele', async () => {
  const enviados = [];
  const f = await criarFila({ ...base, armazenamento: memoria(), enviar: async e => {
    if (e.tipo === 'inicio') return { ok: false, codigo: 'P0001', mensagem: 'A rota ainda não foi enviada pelo analista.' };
    enviados.push(e.tipo); return { ok: true };
  } });
  await f.adicionar('inicio', {});
  await f.adicionar('visita', {});
  const r = await f.sincronizar();
  assert.equal(r.parou, 'inicio_recusado');
  assert.deepEqual(enviados, []);
  assert.equal(r.pendentes, 1);
});

test('evento com erro não é reenviado sozinho; reenviar() devolve para a fila e descartar() remove', async () => {
  let aceita = false, chamadas = 0;
  const f = await criarFila({ ...base, armazenamento: memoria(), enviar: async () => {
    chamadas++; return aceita ? { ok: true } : { ok: false, codigo: 'P0001', mensagem: 'x' };
  } });
  const e = await f.adicionar('visita', {});
  await f.sincronizar();
  await f.sincronizar();
  assert.equal(chamadas, 1, 'não insiste no que o banco recusou');
  aceita = true;
  await f.reenviar(e.id);
  assert.equal((await f.sincronizar()).pendentes, 0);
  const g = await f.adicionar('posicao', {});
  await f.descartar(g.id);
  assert.equal(f.lista().length, 0);
});

test('duas sincronizações ao mesmo tempo não enviam duas vezes', async () => {
  let chamadas = 0;
  const f = await criarFila({ ...base, armazenamento: memoria(), enviar: async () => { chamadas++; await new Promise(r => setTimeout(r, 20)); return { ok: true }; } });
  await f.adicionar('visita', {});
  const [a, b] = await Promise.all([f.sincronizar(), f.sincronizar()]);
  assert.equal(chamadas, 1);
  assert.ok([a.parou, b.parou].includes('ja_sincronizando'));
});

test('muito tempo offline: descarta os pontos de posição mais antigos, nunca visita nem início', async () => {
  const f = await criarFila({ ...base, armazenamento: memoria(), enviar: async () => ({ ok: false, rede: true }), limitePosicoes: 3 });
  await f.adicionar('inicio', {});
  for (let i = 0; i < 6; i++) await f.adicionar('posicao', { i });
  await f.adicionar('visita', {});
  const tipos = f.lista().map(e => e.tipo);
  assert.equal(tipos.filter(t => t === 'posicao').length, 3);
  assert.deepEqual(f.lista().filter(e => e.tipo === 'posicao').map(e => e.dados.i), [3, 4, 5]);
  assert.ok(tipos.includes('inicio') && tipos.includes('visita'));
});

test('a hora do aparelho é a do momento da ação, não a do envio', async () => {
  let relogio = new Date('2026-10-20T10:00:00Z');
  const f = await criarFila({ ...base, armazenamento: memoria(), agora: () => relogio, enviar: async () => ({ ok: false, rede: true }) });
  const e = await f.adicionar('visita', {});
  relogio = new Date('2026-10-20T15:00:00Z');
  await f.sincronizar();
  assert.equal(f.lista()[0].aparelhoEm, '2026-10-20T10:00:00.000Z');
  assert.equal(e.aparelhoEm, '2026-10-20T10:00:00.000Z');
});
