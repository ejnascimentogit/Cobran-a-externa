import { useState } from 'react';
import { brl, hojeISO } from '../../../compartilhado/formato.js';
import { validarVisita } from '../../../compartilhado/real/validacao.js';
import { obterGps } from '../posicao.js';

// Check-in de uma visita. Confere as regras no aparelho (vale offline); o banco confere de novo ao receber.
export default function CheckinReal({ parada, motivos, raioM, onSalvar, onFechar }) {
  const [f, setF] = useState({
    atendido: null, pagou: false, valorRecebido: parada.cob06_valor_total, negociou: false,
    valorNegociado: '', dataPrometida: '', motivoId: '', observacao: '',
  });
  const [msg, setMsg] = useState('');
  const [salvando, setSalvando] = useState(false);
  const set = (k, v) => setF(x => ({ ...x, [k]: v }));
  const motivo = motivos.find(m => String(m.cob03_id) === String(f.motivoId));

  const salvar = async () => {
    setSalvando(true);
    setMsg('');
    try {
      if (f.atendido === null) throw new Error('Informe se o cliente foi atendido.');
      const pos = await obterGps();
      const r = validarVisita({ ...f, ...pos }, { parada, motivo, raioM });
      if (!r.ok) throw new Error(r.erro);
      await onSalvar({ lat: pos.lat, lng: pos.lng, linha: r.linha });
    } catch (x) {
      setMsg(x.message);
      setSalvando(false);
    }
  };

  const SimNao = ({ k }) => (
    <div className="opcoes">
      <button className={f[k] === true ? 'marcada' : ''} onClick={() => set(k, true)}>Sim</button>
      <button className={f[k] === false ? 'marcada' : ''} onClick={() => set(k, false)}>Não</button>
    </div>
  );

  return (
    <div className="card">
      <button onClick={onFechar} style={{ marginBottom: '.75rem' }}>← Voltar</button>
      <h2>{parada.cob06_ordem}. {parada.cob06_cliente_nome}</h2>
      <p className="suave">
        {parada.cob06_cliente_endereco}<br />
        {parada.cob06_qtd_titulos} título(s) · <b>{brl(parada.cob06_valor_total)}</b> · {parada.cob06_cliente_telefone}
      </p>
      {msg && <div className="erro">{msg}</div>}

      <label>O cliente foi atendido?</label>
      <SimNao k="atendido" />

      {f.atendido && <>
        <label>Pagou?</label>
        <SimNao k="pagou" />
        {f.pagou && (
          <label>Valor recebido (R$)
            <input type="number" min="0" step="0.01" value={f.valorRecebido} onChange={e => set('valorRecebido', e.target.value)} />
          </label>
        )}
        <label>Houve negociação?</label>
        <SimNao k="negociou" />
        {f.negociou && (
          <label>Valor negociado (R$)
            <input type="number" min="0" step="0.01" value={f.valorNegociado} onChange={e => set('valorNegociado', e.target.value)} />
          </label>
        )}
        <label>Data prometida {(f.negociou || motivo?.cob03_tipo === 'promessa') ? '(obrigatória)' : '(se houver)'}
          <input type="date" min={hojeISO()} value={f.dataPrometida} onChange={e => set('dataPrometida', e.target.value)} />
        </label>
      </>}

      <label>Motivo
        <select value={f.motivoId} onChange={e => set('motivoId', e.target.value)}>
          <option value="">Escolha…</option>
          {motivos.map(m => <option key={m.cob03_id} value={m.cob03_id}>{m.cob03_nome}</option>)}
        </select>
      </label>
      <label>O que o cliente disse / observações
        <textarea rows="3" value={f.observacao} onChange={e => set('observacao', e.target.value)} />
      </label>

      <button className="principal grande" disabled={salvando} onClick={salvar}>
        {salvando ? 'Salvando…' : 'Registrar check-in'}
      </button>
    </div>
  );
}
