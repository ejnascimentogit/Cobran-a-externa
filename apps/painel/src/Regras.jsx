import { useState } from 'react';
import { useEstado } from '../../compartilhado/hooks.js';
import { salvarRegra, alternarRegra, ErroNegocio } from '../../compartilhado/servico.js';

const VAZIA = { nome: '', diasMin: '', diasMax: '', prioridade: '' };

export default function Regras() {
  const e = useEstado();
  const [form, setForm] = useState(VAZIA);
  const [msg, setMsg] = useState('');
  const tentar = fn => { try { fn(); setMsg(''); } catch (x) { if (x instanceof ErroNegocio) setMsg(x.message); else throw x; } };
  const campo = k => ({ value: form[k] ?? '', onChange: ev => setForm({ ...form, [k]: ev.target.value }) });

  return (
    <div className="grade duas-colunas">
      <div className="card">
        <h2>Regras por faixa de atraso</h2>
        <p className="suave">Cada regra gera a sua consulta. As faixas ativas não podem se sobrepor.</p>
        <div className="tabela-rolagem"><table>
          <thead><tr><th>Regra</th><th className="num">De</th><th className="num">Até</th><th>Ativa</th><th /></tr></thead>
          <tbody>
            {[...e.regras].sort((a, b) => a.prioridade - b.prioridade).map(r => (
              <tr key={r.id} style={{ opacity: r.ativa ? 1 : .55 }}>
                <td>{r.nome}</td><td className="num">{r.diasMin} d</td><td className="num">{r.diasMax} d</td>
                <td><input type="checkbox" checked={r.ativa} onChange={() => tentar(() => alternarRegra(r.id))} /></td>
                <td className="num"><button onClick={() => setForm({ ...r })}>Editar</button></td>
              </tr>
            ))}
          </tbody>
        </table></div>
      </div>
      <div className="card">
        <h2>{form.id ? 'Editar regra' : 'Nova regra'}</h2>
        {msg && <div className="erro">{msg}</div>}
        <label>Nome<input {...campo('nome')} placeholder="Ex.: 61 a 90 dias" /></label>
        <div className="grade" style={{ gridTemplateColumns: '1fr 1fr 1fr' }}>
          <label>Dias mínimo<input type="number" min="0" {...campo('diasMin')} /></label>
          <label>Dias máximo<input type="number" min="0" {...campo('diasMax')} /></label>
          <label>Prioridade<input type="number" min="1" {...campo('prioridade')} /></label>
        </div>
        <div className="linha-acoes">
          <button className="principal" onClick={() => tentar(() => { salvarRegra({ ...form, ativa: form.ativa ?? true }); setForm(VAZIA); })}>
            {form.id ? 'Salvar' : 'Adicionar regra'}
          </button>
          {form.id && <button onClick={() => { setForm(VAZIA); setMsg(''); }}>Cancelar</button>}
        </div>
      </div>
    </div>
  );
}
