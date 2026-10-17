// Fila de eventos do app do motoqueiro para trabalhar SEM SINAL (docs/12-modo-offline.md).
// Não conhece o banco: quem envia é a função `enviar(evento)`, que devolve
//   { ok: true }                          enviado (ou o banco já tinha, código 23505)
//   { ok: false, rede: true }             sem sinal: para e tenta de novo depois
//   { ok: false, codigo, mensagem }       o banco recusou a regra (não adianta repetir igual)
// Regras: os eventos sobem UM POR VEZ, na ordem em que aconteceram; reenviar o mesmo evento
// (mesmo id) nunca duplica; um evento recusado fica na fila marcado com o motivo para alguém resolver.

const GERA_ID = () => globalThis.crypto.randomUUID();

export function armazenamentoLocalStorage(chave = 'cobranca_fila_v1') {
  return {
    async carregar() {
      try { return JSON.parse(localStorage.getItem(chave) || '[]'); } catch { return []; }
    },
    async salvar(lista) {
      localStorage.setItem(chave, JSON.stringify(lista));
    },
  };
}

const IMPORTANTES = ['inicio', 'visita', 'finalizacao'];

export async function criarFila({ armazenamento, enviar, agora = () => new Date(), gerarId = GERA_ID, limitePosicoes = 1500 }) {
  let eventos = await armazenamento.carregar();
  let sincronizando = false;
  const ouvintes = new Set();

  const salvar = async () => {
    await armazenamento.salvar(eventos);
    ouvintes.forEach(f => f(resumo()));
  };
  const resumo = () => ({
    pendentes: eventos.filter(e => e.estado === 'pendente').length,
    comErro: eventos.filter(e => e.estado === 'erro').length,
  });

  return {
    resumo,
    lista: () => eventos.map(e => ({ ...e })),
    assinar(f) { ouvintes.add(f); return () => ouvintes.delete(f); },

    // tipo: 'inicio' | 'visita' | 'finalizacao' | 'posicao'
    async adicionar(tipo, dados) {
      const evento = { id: gerarId(), tipo, dados, aparelhoEm: agora().toISOString(), estado: 'pendente', tentativas: 0 };
      eventos.push(evento);
      const posicoes = eventos.filter(e => e.tipo === 'posicao' && e.estado === 'pendente');
      if (posicoes.length > limitePosicoes) {
        const descartar = posicoes[0].id; // com muito tempo offline, perde os pontos mais antigos, nunca visita nem início/fim
        eventos = eventos.filter(e => e.id !== descartar);
      }
      await salvar();
      return { ...evento };
    },

    async sincronizar() {
      if (sincronizando) return { enviados: 0, parou: 'ja_sincronizando', ...resumo() };
      sincronizando = true;
      let enviados = 0, parou = null;
      try {
        for (const evento of [...eventos]) {
          if (evento.estado !== 'pendente') continue;
          evento.tentativas += 1;
          let r;
          try { r = await enviar({ ...evento }); } catch { r = { ok: false, rede: true }; }
          if (r.ok) {
            eventos = eventos.filter(e => e.id !== evento.id);
            enviados += 1;
          } else if (r.rede) {
            evento.tentativas -= 1; // falta de sinal não conta como tentativa
            parou = 'rede';
            await salvar();
            break;
          } else {
            evento.estado = 'erro';
            evento.erro = { codigo: r.codigo ?? null, mensagem: r.mensagem ?? 'Recusado.' };
            if (evento.tipo === 'inicio') { // tudo o que vem depois depende do início
              parou = 'inicio_recusado';
              await salvar();
              break;
            }
          }
          await salvar();
        }
      } finally {
        sincronizando = false;
      }
      return { enviados, parou, ...resumo() };
    },

    // depois de corrigir a causa (ex.: o analista reativou o motivo), o evento volta para a fila
    async reenviar(id) {
      const e = eventos.find(x => x.id === id);
      if (e && e.estado === 'erro') { e.estado = 'pendente'; delete e.erro; await salvar(); }
    },
    async descartar(id) {
      eventos = eventos.filter(e => e.id !== id);
      await salvar();
    },
  };
}

export { IMPORTANTES };
