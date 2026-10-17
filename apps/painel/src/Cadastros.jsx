import { useState } from 'react';
import { useEstado } from '../../compartilhado/hooks.js';
import { mutar } from '../../compartilhado/store.js';

const TIPOS = { pago: 'Pagou', promessa: 'Promessa', negociado: 'Negociado', sem_sucesso: 'Sem sucesso' };
const uid = p => `${p}_${Math.random().toString(36).slice(2, 8)}`;

export default function Cadastros() {
  const e = useEstado();
  const [cb, setCb] = useState({ nome: '', telefone: '', veiculo: '', capacidade: 8 });
  const [mt, setMt] = useState({ descricao: '', tipo: 'sem_sucesso' });

  const addCobrador = () => {
    if (!cb.nome.trim()) return;
    mutar(s => s.cobradores.push({ id: uid('cb'), ...cb, nome: cb.nome.trim(), capacidade: Number(cb.capacidade) || 8, ativo: true, consentimentoEm: null }));
    setCb({ nome: '', telefone: '', veiculo: '', capacidade: 8 });
  };
  const addMotivo = () => {
    if (!mt.descricao.trim()) return;
    mutar(s => s.motivos.push({ id: uid('mt'), descricao: mt.descricao.trim(), tipo: mt.tipo, ativo: true }));
    setMt({ descricao: '', tipo: 'sem_sucesso' });
  };
  const alternar = (lista, id) => mutar(s => { const x = s[lista].find(i => i.id === id); x.ativo = !x.ativo; });
  const config = (k, v) => mutar(s => { s.config[k] = Number(v) || 0; });

  return (
    <div className="grade duas-colunas">
      <div className="card">
        <h2>Motoqueiros</h2>
        <div className="tabela-rolagem"><table>
          <thead><tr><th>Nome</th><th>Veículo</th><th className="num">Visitas/dia</th><th>Localização</th><th>Ativo</th></tr></thead>
          <tbody>{e.cobradores.map(c => (
            <tr key={c.id}><td>{c.nome}<div className="suave">{c.telefone}</div></td><td>{c.veiculo}</td><td className="num">{c.capacidade}</td>
              <td className="suave">{c.consentimentoEm ? 'Consentiu' : 'Sem consentimento'}</td>
              <td><input type="checkbox" checked={c.ativo} onChange={() => alternar('cobradores', c.id)} /></td></tr>))}</tbody>
        </table></div>
        <h3 style={{ marginTop: '1rem' }}>Novo motoqueiro</h3>
        <div className="grade" style={{ gridTemplateColumns: '1fr 1fr' }}>
          <label>Nome<input value={cb.nome} onChange={ev => setCb({ ...cb, nome: ev.target.value })} /></label>
          <label>Telefone<input value={cb.telefone} onChange={ev => setCb({ ...cb, telefone: ev.target.value })} /></label>
          <label>Veículo<input value={cb.veiculo} onChange={ev => setCb({ ...cb, veiculo: ev.target.value })} /></label>
          <label>Visitas por dia<input type="number" min="1" value={cb.capacidade} onChange={ev => setCb({ ...cb, capacidade: ev.target.value })} /></label>
        </div>
        <button className="principal" onClick={addCobrador}>Adicionar</button>
      </div>

      <div>
        <div className="card">
          <h2>Motivos do check-in</h2>
          <div className="tabela-rolagem"><table>
            <thead><tr><th>Motivo</th><th>Tipo</th><th>Ativo</th></tr></thead>
            <tbody>{e.motivos.map(m => (
              <tr key={m.id}><td>{m.descricao}</td><td>{TIPOS[m.tipo]}</td>
                <td><input type="checkbox" checked={m.ativo} onChange={() => alternar('motivos', m.id)} /></td></tr>))}</tbody>
          </table></div>
          <div className="linha-acoes" style={{ marginTop: '.75rem' }}>
            <input style={{ flex: 1, minWidth: 160 }} placeholder="Novo motivo" value={mt.descricao} onChange={ev => setMt({ ...mt, descricao: ev.target.value })} />
            <select style={{ width: 150 }} value={mt.tipo} onChange={ev => setMt({ ...mt, tipo: ev.target.value })}>
              {Object.entries(TIPOS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
            <button className="principal" onClick={addMotivo}>Adicionar</button>
          </div>
        </div>
        <div className="card">
          <h2>Parâmetros</h2>
          <p className="suave">Valores iniciais; os dois primeiros são pontos em aberto do projeto.</p>
          <label>Raio de GPS aceito no check-in (metros)<input type="number" min="10" value={e.config.raioGpsM} onChange={ev => config('raioGpsM', ev.target.value)} /></label>
          <label>Tolerância da promessa (dias após a data prometida)<input type="number" min="0" value={e.config.toleranciaPromessaDias} onChange={ev => config('toleranciaPromessaDias', ev.target.value)} /></label>
          <label>Minutos por visita (para a previsão de chegada)<input type="number" min="1" value={e.config.minutosPorVisita} onChange={ev => config('minutosPorVisita', ev.target.value)} /></label>
        </div>
      </div>
    </div>
  );
}
