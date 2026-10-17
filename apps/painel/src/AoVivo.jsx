import { useMemo, useState } from 'react';
import Mapa from '../../compartilhado/Mapa.jsx';
import { useEstado, useAgora } from '../../compartilhado/hooks.js';
import { brl, esc, horaBR, RESULTADO, STATUS_ROTA } from '../../compartilhado/formato.js';
import { resumoRota } from '../../compartilhado/servico.js';

export default function AoVivo() {
  const e = useEstado();
  const agora = useAgora();
  const rotas = e.rotas.filter(r => r.status !== 'rascunho');
  const [escolhida, setEscolhida] = useState('');
  const rotaId = rotas.some(r => r.id === escolhida) ? escolhida
    : (rotas.find(r => r.status === 'em_andamento') || rotas[0])?.id;
  const r = useMemo(() => (rotaId ? resumoRota(e, rotaId, agora) : null), [e, rotaId, agora]);

  if (!rotas.length) return <div className="card">Nenhuma rota enviada ainda. Monte e envie uma rota na aba "Montar rota".</div>;
  const rota = e.rotas.find(x => x.id === rotaId);

  const marcadores = [
    { id: 'dep', lat: e.config.deposito.lat, lng: e.config.deposito.lng, cor: '#0f172a', raio: 7, html: esc(e.config.deposito.nome) },
    ...r.linhas.map(l => ({
      id: l.parada.id, lat: l.cliente.lat, lng: l.cliente.lng, cor: RESULTADO[l.resultado].cor, raio: 11,
      html: `<b>${l.parada.ordem}. ${esc(l.cliente.nome)}</b><br>${esc(l.cliente.endereco)}<br>${l.parada.qtdTitulos} título(s) · ${esc(brl(l.parada.valorTotal))}`
        + `<br>Previsão: ${horaBR(l.parada.previsaoChegada)}<br><b>${RESULTADO[l.resultado].texto}</b>`
        + (l.checkin ? `<br>Check-in às ${horaBR(l.checkin.registradoEm)}${l.checkin.valorRecebido ? ` · recebido ${esc(brl(l.checkin.valorRecebido))}` : ''}` : ''),
    })),
  ];
  const linhas = [], trilhas = {};
  e.rastreamento.filter(p => p.rotaId === rotaId).forEach(p => (trilhas[p.cobradorId] ||= []).push(p));
  Object.entries(trilhas).forEach(([cid, pts]) => {
    linhas.push({ pontos: pts.map(p => [p.lat, p.lng]), cor: '#2563eb' });
    const ultimo = pts.at(-1);
    marcadores.push({
      id: `pos-${cid}`, lat: ultimo.lat, lng: ultimo.lng, cor: '#2563eb', raio: 8,
      html: `🏍 ${esc(e.cobradores.find(c => c.id === cid)?.nome)}<br>visto às ${horaBR(ultimo.registradoEm)}`,
    });
  });

  return (
    <>
      <div className="card linha-acoes">
        <label style={{ margin: 0, flex: 1, minWidth: 220 }}>Rota
          <select value={rotaId} onChange={ev => setEscolhida(ev.target.value)}>
            {rotas.map(x => <option key={x.id} value={x.id}>
              {e.regras.find(g => g.id === x.regraId)?.nome} · {x.praca} · {STATUS_ROTA[x.status]}
            </option>)}
          </select>
        </label>
        <b>{STATUS_ROTA[rota.status]}</b>
      </div>

      <div className="indicadores">
        <div className="indicador"><b>{r.clientes}</b><span>clientes na rota</span></div>
        <div className="indicador"><b>{r.titulos}</b><span>títulos</span></div>
        <div className="indicador"><b>{brl(r.valorTotal)}</b><span>em cobrança · média {brl(r.valorTotal / (r.clientes || 1))} por cliente</span></div>
        <div className="indicador"><b>{r.visitados}/{r.clientes}</b><span>visitados (previsto até agora: {r.previstoAteAgora})</span></div>
        <div className="indicador"><b style={{ color: 'var(--ok)' }}>{brl(r.recebido)}</b><span>recebido</span></div>
        <div className="indicador"><b style={{ color: 'var(--alerta)' }}>{brl(r.negociado)}</b><span>negociado</span></div>
      </div>

      <div className="card">
        <Mapa marcadores={marcadores} linhas={linhas} altura={440} ajustarKey={rotaId} />
        <div className="linha-acoes" style={{ marginTop: '.6rem' }}>
          {Object.values(RESULTADO).map(x => <span key={x.texto}><span className="selo" style={{ background: x.cor }}>{x.texto}</span></span>)}
        </div>
      </div>

      <div className="card">
        <h2>Relatório por cliente</h2>
        <div className="tabela-rolagem"><table>
          <thead><tr><th>#</th><th>Cliente</th><th>Motoqueiro</th><th className="num">Títulos</th><th className="num">Valor</th><th>Previsão</th><th>Check-in</th><th>Resultado</th><th>Motivo e observação</th></tr></thead>
          <tbody>
            {r.linhas.map(l => (
              <tr key={l.parada.id}>
                <td>{l.parada.ordem}</td><td>{l.cliente.nome}</td><td>{l.cobrador.nome}</td>
                <td className="num">{l.parada.qtdTitulos}</td><td className="num">{brl(l.parada.valorTotal)}</td>
                <td>{horaBR(l.parada.previsaoChegada)}</td><td>{l.checkin ? horaBR(l.checkin.registradoEm) : '—'}</td>
                <td><span className="selo" style={{ background: RESULTADO[l.resultado].cor }}>{RESULTADO[l.resultado].texto}</span></td>
                <td>{l.checkin ? <>{e.motivos.find(m => m.id === l.checkin.motivoId)?.descricao}
                  {l.checkin.foraDoRaio && <span className="selo" style={{ background: 'var(--alerta)', marginLeft: 6 }}>a {l.checkin.distanciaM} m</span>}
                  {l.checkin.observacao && <div className="suave">{l.checkin.observacao}</div>}</> : '—'}</td>
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
                <td className="num">{c.visitados}/{c.clientes}</td><td className="num">{brl(c.recebido)}</td><td className="num">{brl(c.negociado)}</td></tr>))}</tbody>
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
