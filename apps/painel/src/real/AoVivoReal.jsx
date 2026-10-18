import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Mapa from '../../../compartilhado/Mapa.jsx';
import { supabase } from '../../../compartilhado/real/cliente.js';
import { useCarga, ler } from '../../../compartilhado/real/hooks.js';
import { resumirRota } from '../../../compartilhado/real/resumo.js';
import { brl, esc, horaBR, RESULTADO, STATUS_ROTA } from '../../../compartilhado/formato.js';

export default function AoVivo() {
  const [escolhida, setEscolhida] = useState('');
  const { dados, erro, recarregar } = useCarga(async () => {
    const rotas = await ler(supabase.from('cob04_rota').select('*').neq('cob04_status', 'rascunho').order('cob04_id', { ascending: false }).limit(30));
    const rotaId = rotas.some(r => String(r.cob04_id) === String(escolhida)) ? Number(escolhida)
      : (rotas.find(r => r.cob04_status === 'em_andamento') || rotas[0])?.cob04_id;
    if (!rotaId) return { rotas, rotaId: null };
    const [paradas, checkins, trilha, cobradores, motivos, regras] = await Promise.all([
      ler(supabase.from('cob06_rota_parada').select('*').eq('cob06_rota_id', rotaId)),
      ler(supabase.from('cob08_checkin').select('*').eq('cob08_rota_id', rotaId)),
      ler(supabase.from('cob09_rastreamento').select('cob09_cobrador_id, cob09_latitude, cob09_longitude, cob09_aparelho_em')
        .eq('cob09_rota_id', rotaId).order('cob09_aparelho_em').limit(5000)),
      ler(supabase.from('cob01_cobrador').select('cob01_id, cob01_nome')),
      ler(supabase.from('cob03_motivo').select('cob03_id, cob03_nome')),
      ler(supabase.from('cob02_regra').select('cob02_id, cob02_nome')),
    ]);
    return { rotas, rotaId, paradas, checkins, trilha, cobradores, motivos, regras };
  }, [escolhida], 20000);

  // atualiza na hora quando entra check-in, ponto ou muda a rota (e a cada 20 s por garantia)
  const espera = useRef(null);
  const agendar = useCallback(() => { clearTimeout(espera.current); espera.current = setTimeout(recarregar, 1500); }, [recarregar]);
  useEffect(() => {
    const canal = supabase.channel('cobranca-aovivo');
    for (const tabela of ['cob08_checkin', 'cob09_rastreamento', 'cob04_rota']) {
      canal.on('postgres_changes', { event: '*', schema: 'public', table: tabela }, agendar);
    }
    canal.subscribe();
    return () => { clearTimeout(espera.current); supabase.removeChannel(canal); };
  }, [agendar]);

  const r = useMemo(() => (dados?.rotaId ? resumirRota(dados) : null), [dados]);

  if (erro && !dados) return <div className="erro">{erro}</div>;
  if (!dados) return <div className="card">Carregando…</div>;
  if (!dados.rotaId) return <div className="card">Nenhuma rota enviada ainda.</div>;

  const rota = dados.rotas.find(x => x.cob04_id === dados.rotaId);
  const marcadores = [];
  for (const l of r.linhas) {
    if (l.parada.cob06_latitude == null) continue;
    const c = l.checkin;
    marcadores.push({
      id: l.parada.cob06_id, lat: Number(l.parada.cob06_latitude), lng: Number(l.parada.cob06_longitude),
      cor: RESULTADO[l.resultado].cor, raio: 11,
      html: `<b>${l.parada.cob06_ordem}. ${esc(l.parada.cob06_cliente_nome)}</b><br>${esc(l.parada.cob06_cliente_endereco)}`
        + `<br>${l.parada.cob06_qtd_titulos} título(s) · ${esc(brl(l.parada.cob06_valor_total))}`
        + `<br>Previsão: ${horaBR(l.parada.cob06_previsao_chegada)}<br><b>${RESULTADO[l.resultado].texto}</b>`
        + (c ? `<br>Check-in às ${horaBR(c.cob08_aparelho_em)}${Number(c.cob08_valor_recebido) ? ` · recebido ${esc(brl(c.cob08_valor_recebido))}` : ''}` : ''),
    });
  }
  const linhas = [];
  const porCobrador = {};
  dados.trilha.forEach(p => (porCobrador[p.cob09_cobrador_id] ||= []).push(p));
  Object.entries(porCobrador).forEach(([id, pts]) => {
    linhas.push({ pontos: pts.map(p => [Number(p.cob09_latitude), Number(p.cob09_longitude)]), cor: '#2563eb' });
    const u = pts[pts.length - 1];
    marcadores.push({
      id: `pos-${id}`, lat: Number(u.cob09_latitude), lng: Number(u.cob09_longitude), cor: '#2563eb', raio: 8,
      html: `🏍 ${esc(dados.cobradores.find(c => String(c.cob01_id) === id)?.cob01_nome)}<br>visto às ${horaBR(u.cob09_aparelho_em)}`,
    });
  });

  return (
    <>
      <div className="card linha-acoes">
        <label style={{ margin: 0, flex: 1, minWidth: 220 }}>Rota
          <select value={dados.rotaId} onChange={e => setEscolhida(e.target.value)}>
            {dados.rotas.map(x => (
              <option key={x.cob04_id} value={x.cob04_id}>
                {dados.regras?.find(g => g.cob02_id === x.cob04_regra_id)?.cob02_nome ?? 'Rota'} · {x.cob04_praca || '—'} · {STATUS_ROTA[x.cob04_status]}
              </option>
            ))}
          </select>
        </label>
        <b>{STATUS_ROTA[rota.cob04_status]}</b>
      </div>
      {erro && <div className="aviso">Não consegui atualizar agora: {erro}</div>}

      <div className="indicadores">
        <div className="indicador"><b>{r.clientes}</b><span>clientes na rota</span></div>
        <div className="indicador"><b>{r.titulos}</b><span>títulos</span></div>
        <div className="indicador"><b>{brl(r.valorTotal)}</b><span>em cobrança · média {brl(r.valorTotal / (r.clientes || 1))} por cliente</span></div>
        <div className="indicador"><b>{r.visitados}/{r.clientes}</b><span>visitados (previsto até agora: {r.previstoAteAgora})</span></div>
        <div className="indicador"><b style={{ color: 'var(--ok)' }}>{brl(r.recebido)}</b><span>recebido</span></div>
        <div className="indicador"><b style={{ color: 'var(--alerta)' }}>{brl(r.negociado)}</b><span>negociado</span></div>
      </div>

      <div className="card">
        <Mapa marcadores={marcadores} linhas={linhas} altura={440} ajustarKey={String(dados.rotaId)} />
        <div className="linha-acoes" style={{ marginTop: '.6rem' }}>
          {Object.values(RESULTADO).map(x => <span key={x.texto} className="selo" style={{ background: x.cor }}>{x.texto}</span>)}
        </div>
      </div>

      <div className="card">
        <h2>Relatório por cliente</h2>
        <div className="tabela-rolagem"><table>
          <thead><tr><th>#</th><th>Cliente</th><th>Motoqueiro</th><th className="num">Títulos</th><th className="num">Valor</th><th>Previsão</th><th>Check-in</th><th>Resultado</th><th>Motivo e observação</th></tr></thead>
          <tbody>
            {r.linhas.map(l => (
              <tr key={l.parada.cob06_id}>
                <td>{l.parada.cob06_ordem}</td><td>{l.parada.cob06_cliente_nome}</td><td>{l.cobrador?.cob01_nome}</td>
                <td className="num">{l.parada.cob06_qtd_titulos}</td><td className="num">{brl(l.parada.cob06_valor_total)}</td>
                <td>{horaBR(l.parada.cob06_previsao_chegada)}</td><td>{l.checkin ? horaBR(l.checkin.cob08_aparelho_em) : '—'}</td>
                <td><span className="selo" style={{ background: RESULTADO[l.resultado].cor }}>{RESULTADO[l.resultado].texto}</span></td>
                <td>{l.checkin ? <>{l.motivo?.cob03_nome}
                  {l.checkin.cob08_fora_do_raio && <span className="selo" style={{ background: 'var(--alerta)', marginLeft: 6 }}>{l.checkin.cob08_distancia_m != null ? `a ${l.checkin.cob08_distancia_m} m` : 'sem coordenada'}</span>}
                  {l.checkin.cob08_hora_suspeita && <span className="selo" style={{ background: 'var(--erro)', marginLeft: 6 }}>hora suspeita</span>}
                  {l.checkin.cob08_observacao && <div className="suave">{l.checkin.cob08_observacao}</div>}</> : '—'}</td>
              </tr>
            ))}
          </tbody>
        </table></div>
      </div>

      <div className="grade duas-colunas">
        <div className="card">
          <h2>Totais por motoqueiro</h2>
          <div className="tabela-rolagem"><table>
            <thead><tr><th>Motoqueiro</th><th className="num">Títulos</th><th className="num">Valor</th><th className="num">Visitados</th><th className="num">Recebido</th><th className="num">Negociado</th></tr></thead>
            <tbody>{r.porCobrador.map(c => (
              <tr key={c.nome}><td>{c.nome}</td><td className="num">{c.titulos}</td><td className="num">{brl(c.valor)}</td>
                <td className="num">{c.visitados}/{c.clientes}</td><td className="num">{brl(c.recebido)}</td><td className="num">{brl(c.negociado)}</td></tr>
            ))}</tbody>
          </table></div>
        </div>
        <div className="card">
          <h2>Resultado por motivo</h2>
          <div className="tabela-rolagem"><table>
            <thead><tr><th>Motivo</th><th className="num">Clientes</th><th className="num">Valor em cobrança</th></tr></thead>
            <tbody>
              {r.porMotivo.map(m => <tr key={m.descricao}><td>{m.descricao}</td><td className="num">{m.qtd}</td><td className="num">{brl(m.valor)}</td></tr>)}
              {!r.porMotivo.length && <tr><td colSpan="3" className="suave">Nenhum check-in ainda.</td></tr>}
            </tbody>
          </table></div>
        </div>
      </div>
    </>
  );
}
