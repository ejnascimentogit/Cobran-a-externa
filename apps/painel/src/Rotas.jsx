import { useMemo, useState } from 'react';
import Mapa from '../../compartilhado/Mapa.jsx';
import { useEstado } from '../../compartilhado/hooks.js';
import { brl, esc, STATUS_ROTA, horaBR } from '../../compartilhado/formato.js';
import { carteiraPorRegra, criarRota, enviarRota, descartarRota, ErroNegocio } from '../../compartilhado/servico.js';

export default function Rotas() {
  const e = useEstado();
  const ativas = e.regras.filter(r => r.ativa).sort((a, b) => a.prioridade - b.prioridade);
  const [regraId, setRegraId] = useState(ativas[0]?.id || '');
  const [praca, setPraca] = useState('');
  const [sel, setSel] = useState(new Set());
  const [cobradorId, setCobradorId] = useState('');
  const [meta, setMeta] = useState(5);
  const [msg, setMsg] = useState('');

  const carteira = useMemo(() => carteiraPorRegra(e, regraId), [e, regraId]);
  const pracas = [...new Set(carteira.map(i => i.cliente.praca))];
  const lista = carteira.filter(i => !praca || i.cliente.praca === praca);
  const visiveis = new Set(lista.map(i => i.cliente.cod));
  const escolhidos = lista.filter(i => sel.has(i.cliente.cod));
  const cobrador = e.cobradores.find(c => c.id === cobradorId);
  const soma = (arr, f) => arr.reduce((s, x) => s + f(x), 0);

  const trocar = fn => { setSel(new Set()); fn(); setMsg(''); };
  const alternar = cod => setSel(s => { const n = new Set(s); n.has(cod) ? n.delete(cod) : n.add(cod); return n; });
  const selecionarMeta = () => setSel(new Set(lista.slice(0, Number(meta) || 0).map(i => i.cliente.cod)));
  const tentar = (fn, ok) => { try { fn(); setMsg(''); ok?.(); } catch (x) { if (x instanceof ErroNegocio) setMsg(x.message); else throw x; } };

  const marcadores = [
    { id: 'dep', lat: e.config.deposito.lat, lng: e.config.deposito.lng, cor: '#0f172a', raio: 8, html: esc(e.config.deposito.nome) },
    ...lista.map(i => ({
      id: i.cliente.cod, lat: i.cliente.lat, lng: i.cliente.lng, cor: sel.has(i.cliente.cod) ? '#1d4ed8' : '#94a3b8',
      raio: sel.has(i.cliente.cod) ? 11 : 8, onClick: () => alternar(i.cliente.cod),
      html: `<b>${esc(i.cliente.nome)}</b><br>${i.qtd} título(s) · ${esc(brl(i.valor))}<br>${i.diasMax} dias de atraso`,
    })),
  ];
  const hoje = e.rotas.filter(r => r.data === e.demoData);

  return (
    <>
      <div className="card">
        <div className="grade" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))' }}>
          <label>Regra (faixa de atraso)
            <select value={regraId} onChange={ev => trocar(() => setRegraId(ev.target.value))}>
              {ativas.map(r => <option key={r.id} value={r.id}>{r.nome}</option>)}
            </select>
          </label>
          <label>Rota / praça
            <select value={praca} onChange={ev => trocar(() => setPraca(ev.target.value))}>
              <option value="">Todas</option>
              {pracas.map(p => <option key={p}>{p}</option>)}
            </select>
          </label>
        </div>
        <div className="indicadores" style={{ marginBottom: 0 }}>
          <div className="indicador"><b>{lista.length}</b><span>clientes inadimplentes</span></div>
          <div className="indicador"><b>{soma(lista, i => i.qtd)}</b><span>títulos</span></div>
          <div className="indicador"><b>{brl(soma(lista, i => i.valor))}</b><span>valor total da rota</span></div>
        </div>
      </div>

      <div className="grade duas-colunas">
        <div className="card">
          <h2>Clientes da faixa</h2>
          <div className="linha-acoes" style={{ marginBottom: '.75rem' }}>
            <span>Quantos clientes o motoqueiro vai visitar:</span>
            <input type="number" min="1" style={{ width: 70 }} value={meta} onChange={ev => setMeta(ev.target.value)} />
            <button onClick={selecionarMeta}>Selecionar os {meta || 0} mais atrasados</button>
            <button onClick={() => setSel(new Set())}>Limpar</button>
          </div>
          <div className="tabela-rolagem"><table>
            <thead><tr><th /><th>Cliente</th><th>Praça</th><th className="num">Títulos</th><th className="num">Valor</th><th className="num">Atraso</th></tr></thead>
            <tbody>
              {lista.map(i => (
                <tr key={i.cliente.cod}>
                  <td><input type="checkbox" checked={sel.has(i.cliente.cod)} onChange={() => alternar(i.cliente.cod)} /></td>
                  <td>{i.cliente.nome}<div className="suave">{i.cliente.endereco}</div></td>
                  <td>{i.cliente.praca}</td><td className="num">{i.qtd}</td><td className="num">{brl(i.valor)}</td><td className="num">{i.diasMax} d</td>
                </tr>
              ))}
              {!lista.length && <tr><td colSpan="6" className="suave">Nenhum cliente nesta faixa (ou todos já estão em rota).</td></tr>}
            </tbody>
          </table></div>
        </div>
        <div className="card">
          <Mapa marcadores={marcadores} altura={360} ajustarKey={`${regraId}|${praca}`} />
          <p className="suave">Clique num ponto para marcar/desmarcar o cliente.</p>
        </div>
      </div>

      <div className="card">
        <h2>Enviar para um motoqueiro</h2>
        {msg && <div className="erro">{msg}</div>}
        <div className="linha-acoes">
          <select style={{ maxWidth: 260 }} value={cobradorId} onChange={ev => setCobradorId(ev.target.value)}>
            <option value="">Escolha o motoqueiro…</option>
            {e.cobradores.filter(c => c.ativo).map(c => <option key={c.id} value={c.id}>{c.nome} (capacidade {c.capacidade}/dia)</option>)}
          </select>
          <span>{[...visiveis].filter(c => sel.has(c)).length} cliente(s) · {brl(soma(escolhidos, i => i.valor))}</span>
          <button className="principal" disabled={!escolhidos.length || !cobradorId}
            onClick={() => tentar(() => criarRota({ regraId, cobradorId, codClientes: escolhidos.map(i => i.cliente.cod), metaVisitas: meta }), () => setSel(new Set()))}>
            Criar rota (rascunho)
          </button>
        </div>
        {cobrador && escolhidos.length > cobrador.capacidade && (
          <div className="aviso" style={{ marginTop: '.75rem' }}>
            Acima da demanda normal de {cobrador.nome} ({cobrador.capacidade} visitas). Dividir a rota entre dois motoqueiros chega na Fase 2.
          </div>
        )}
      </div>

      <div className="card">
        <h2>Rotas de hoje</h2>
        <div className="tabela-rolagem"><table>
          <thead><tr><th>Rota</th><th>Motoqueiro</th><th className="num">Clientes</th><th className="num">Valor</th><th>Situação</th><th /></tr></thead>
          <tbody>
            {hoje.map(r => {
              const ps = e.paradas.filter(p => p.rotaId === r.id);
              const rc = e.rotaCobradores.find(x => x.rotaId === r.id);
              return (
                <tr key={r.id}>
                  <td>{e.regras.find(g => g.id === r.regraId)?.nome} · {r.praca}<div className="suave">criada às {horaBR(r.criadoEm)}</div></td>
                  <td>{e.cobradores.find(c => c.id === rc.cobradorId)?.nome}</td>
                  <td className="num">{ps.length}</td><td className="num">{brl(ps.reduce((s, p) => s + p.valorTotal, 0))}</td>
                  <td>{STATUS_ROTA[r.status]}</td>
                  <td className="num">{r.status === 'rascunho' && (
                    <span className="linha-acoes" style={{ justifyContent: 'flex-end' }}>
                      <button className="principal" onClick={() => tentar(() => enviarRota(r.id))}>Enviar ao app</button>
                      <button className="perigo" onClick={() => tentar(() => descartarRota(r.id))}>Descartar</button>
                    </span>)}</td>
                </tr>
              );
            })}
            {!hoje.length && <tr><td colSpan="6" className="suave">Nenhuma rota criada hoje.</td></tr>}
          </tbody>
        </table></div>
      </div>
    </>
  );
}
