// Envia UM evento da fila (docs/12-modo-offline.md) para o Supabase e traduz o resultado para o que a
// fila entende: { ok: true } | { ok: false, rede: true } | { ok: false, codigo, mensagem }.
//
// - O id do evento vira o uuid da linha (cob08_uuid / cob09_uuid): reenviar nunca duplica.
// - 23505 (valor duplicado) = o banco já tinha o evento: conta como enviado.
// - Sem sinal, servidor fora do ar (5xx) ou login vencido (a sessão é renovada com sinal): tenta de novo
//   depois, sem marcar como erro.

const REDE = /fetch|network|timeout|failed to|load failed|jwt|expired|PGRST30[0-9]/i;

export function traduzirResposta(res) {
  const erro = res?.error;
  if (!erro) return { ok: true };
  if (erro.code === '23505') return { ok: true };
  if ((res.status ?? 0) === 0 || res.status >= 500 || REDE.test(`${erro.message ?? ''} ${erro.code ?? ''}`)) {
    return { ok: false, rede: true };
  }
  return { ok: false, codigo: erro.code || null, mensagem: erro.message || 'Recusado pelo servidor.' };
}

export function criarEnviar(supabase) {
  return async evento => {
    try {
      const resposta = evento.tipo === 'posicao'
        ? await supabase.from('cob09_rastreamento').insert({
          ...evento.dados, cob09_uuid: evento.id, cob09_aparelho_em: evento.aparelhoEm,
        })
        : await supabase.from('cob08_checkin').insert({
          ...evento.dados, cob08_tipo: evento.tipo, cob08_uuid: evento.id, cob08_aparelho_em: evento.aparelhoEm,
        });
      return traduzirResposta(resposta);
    } catch {
      return { ok: false, rede: true };
    }
  };
}
