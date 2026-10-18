import { useState } from 'react';
import { supabase } from '../../../compartilhado/real/cliente.js';
import { useCarga, ler } from '../../../compartilhado/real/hooks.js';
import { mensagemDeErro } from '../../../compartilhado/real/resumo.js';
import { brl, dataBR, STATUS_ROTA } from '../../../compartilhado/formato.js';

export default function Rotas() {
  const { dados, erro, recarregar } = useCarga(async () => {
    const rotas = await ler(supabase.from('cob04_rota').select('*').order('cob04_id', { ascending: false }).limit(50));
    if (!rotas.length) return { rotas, ligacoes: [], paradas: [], cobradores: [], regras: [] };
    const ids = rotas.map(r => r.cob04_id);
    const [ligacoes, paradas, cobradores, regras] = await Promise.all([
      ler(supabase.from('cob05_rota_cobrador').select('*').in('cob05_rota_id', ids)),
      ler(supabase.from('cob06_rota_parada').select('cob06_rota_id, cob06_valor_total').in('cob06_rota_id', ids)),
      ler(supabase.from('cob01_cobrador').select('cob01_id, cob01_nome')),
      ler(supabase.from('cob02_regra').select('cob02_id, cob02_nome')),
    ]);
    return { rotas, ligacoes, paradas, cobradores, regras };
  }, [], 20000);
  const [msg, setMsg] = useState('');

  const enviar = async r => {
    setMsg('');
    const { error } = await supabase.from('cob04_rota').update({ cob04_status: 'enviada' }).eq('cob04_id', r.cob04_id).eq('cob04_status', 'rascunho');
    if (error) setMsg(mensagemDeErro(error));
    recarregar();
  };

  return (
    <>
      <div className="aviso">
        <b>Montar rota:</b> a carteira (clientes inadimplentes por faixa de atraso) vem dos títulos do ERP, que a integração do Ryan ainda
        vai trazer para o banco. Enquanto isso as rotas são criadas por SQL (ver <code>supabase/testes/dados-de-teste-motoqueiro.sql</code>)
        e esta tela mostra e envia ao app as que existem.
      </div>
      <div className="card">
        <h2>Rotas</h2>
        {(erro || msg) && <div className="erro">{msg || erro}</div>}
        <div className="tabela-rolagem"><table>
          <thead><tr><th>Rota</th><th>Data</th><th>Motoqueiro</th><th className="num">Clientes</th><th className="num">Valor</th><th>Situação</th><th /></tr></thead>
          <tbody>
            {(dados?.rotas || []).map(r => {
              const ps = dados.paradas.filter(p => p.cob06_rota_id === r.cob04_id);
              const lig = dados.ligacoes.filter(l => l.cob05_rota_id === r.cob04_id);
              const nomes = lig.map(l => dados.cobradores.find(c => c.cob01_id === l.cob05_cobrador_id)?.cob01_nome).filter(Boolean).join(', ');
              return (
                <tr key={r.cob04_id}>
                  <td>{dados.regras.find(g => g.cob02_id === r.cob04_regra_id)?.cob02_nome} · {r.cob04_praca || '—'}</td>
                  <td>{dataBR(r.cob04_data)}</td><td>{nomes || '—'}</td>
                  <td className="num">{ps.length}</td>
                  <td className="num">{brl(ps.reduce((s, p) => s + Number(p.cob06_valor_total), 0))}</td>
                  <td>{STATUS_ROTA[r.cob04_status]}</td>
                  <td className="num">{r.cob04_status === 'rascunho' && <button className="principal" onClick={() => enviar(r)}>Enviar ao app</button>}</td>
                </tr>
              );
            })}
            {dados && !dados.rotas.length && <tr><td colSpan="7" className="suave">Nenhuma rota ainda.</td></tr>}
          </tbody>
        </table></div>
      </div>
    </>
  );
}
