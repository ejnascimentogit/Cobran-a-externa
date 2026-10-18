// Totais e linhas do acompanhamento ao vivo, a partir das linhas do banco (cob04/05/06/08).
const n = v => Number(v) || 0;

export function resumirRota({ paradas, checkins, cobradores, motivos, agora = new Date() }) {
  const visitas = new Map(checkins.filter(c => c.cob08_tipo === 'visita').map(c => [c.cob08_parada_id, c]));
  const linhas = [...paradas].sort((a, b) => a.cob06_ordem - b.cob06_ordem).map(p => {
    const c = visitas.get(p.cob06_id) || null;
    return {
      parada: p,
      checkin: c,
      cobrador: cobradores.find(x => x.cob01_id === p.cob06_cobrador_id) || null,
      motivo: c ? motivos.find(m => m.cob03_id === c.cob08_motivo_id) || null : null,
      resultado: c?.cob08_resultado || 'pendente',
    };
  });

  const porCobrador = {};
  const porMotivo = {};
  for (const l of linhas) {
    const chave = l.parada.cob06_cobrador_id;
    const cb = (porCobrador[chave] ||= { nome: l.cobrador?.cob01_nome ?? '—', clientes: 0, titulos: 0, valor: 0, visitados: 0, recebido: 0, negociado: 0 });
    cb.clientes += 1;
    cb.titulos += n(l.parada.cob06_qtd_titulos);
    cb.valor += n(l.parada.cob06_valor_total);
    if (l.checkin) {
      cb.visitados += 1;
      cb.recebido += n(l.checkin.cob08_valor_recebido);
      cb.negociado += n(l.checkin.cob08_valor_negociado);
      const nome = l.motivo?.cob03_nome ?? 'Motivo removido';
      const pm = (porMotivo[nome] ||= { descricao: nome, qtd: 0, valor: 0 });
      pm.qtd += 1;
      pm.valor += n(l.parada.cob06_valor_total);
    }
  }
  const feitas = linhas.filter(l => l.checkin);
  return {
    linhas,
    porCobrador: Object.values(porCobrador),
    porMotivo: Object.values(porMotivo),
    clientes: linhas.length,
    titulos: linhas.reduce((s, l) => s + n(l.parada.cob06_qtd_titulos), 0),
    valorTotal: linhas.reduce((s, l) => s + n(l.parada.cob06_valor_total), 0),
    visitados: feitas.length,
    recebido: feitas.reduce((s, l) => s + n(l.checkin.cob08_valor_recebido), 0),
    negociado: feitas.reduce((s, l) => s + n(l.checkin.cob08_valor_negociado), 0),
    previstoAteAgora: linhas.filter(l => l.parada.cob06_previsao_chegada && new Date(l.parada.cob06_previsao_chegada) <= agora).length,
  };
}

// mensagens em português para os erros mais comuns do banco
export function mensagemDeErro(erro) {
  const texto = erro?.message || String(erro || '');
  if (erro?.code === '23P01') return 'A faixa de dias se sobrepõe a outra regra ativa da empresa.';
  if (erro?.code === '23505') return 'Já existe um registro igual (nome repetido).';
  if (erro?.code === '23514') return 'Algum valor está fora do permitido (confira os números).';
  if (erro?.code === '42501') return 'Sem permissão para esta operação.';
  if (/failed to fetch|network|load failed/i.test(texto)) return 'Sem conexão com o servidor. Tente de novo.';
  return texto;
}
