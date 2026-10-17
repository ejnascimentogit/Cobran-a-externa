import { useState } from 'react';
import { brl, hojeISO } from '../../compartilhado/formato.js';
import { useEstado } from '../../compartilhado/hooks.js';
import { registrarCheckin } from '../../compartilhado/servico.js';
import { obterGps, simularPerto, simularLonge } from './posicao.js';

export default function Checkin({ linha, cobrador, modo, onFechar }) {
  const e = useEstado();
  const { cliente, parada } = linha;
  const [f, setF] = useState({
    atendido: null, pagou: false, valorRecebido: parada.valorTotal, negociou: false, valorNegociado: '',
    dataPrometida: '', motivoId: '', observacao: '', onde: 'perto',
  });
  const [msg, setMsg] = useState('');
  const [salvando, setSalvando] = useState(false);
  const set = (k, v) => setF(x => ({ ...x, [k]: v }));
  const motivo = e.motivos.find(m => m.id === f.motivoId);

  const salvar = async () => {
    setSalvando(true); setMsg('');
    try {
      if (f.atendido === null) throw new Error('Informe se o cliente foi atendido.');
      const pos = modo === 'gps' ? await obterGps() : f.onde === 'perto' ? simularPerto(cliente) : simularLonge(cliente);
      registrarCheckin({
        paradaId: parada.id, cobradorId: cobrador.id, ...pos, atendido: f.atendido, pagou: f.pagou, valorRecebido: f.valorRecebido,
        negociou: f.negociou, valorNegociado: f.valorNegociado, dataPrometida: f.dataPrometida, motivoId: f.motivoId, observacao: f.observacao,
      });
      onFechar();
    } catch (x) { setMsg(x.message); }
    setSalvando(false);
  };

  const Sn = ({ k, sim = 'Sim', nao = 'Não' }) => (
    <div className="opcoes">
      <button className={f[k] === true ? 'marcada' : ''} onClick={() => set(k, true)}>{sim}</button>
      <button className={f[k] === false ? 'marcada' : ''} onClick={() => set(k, false)}>{nao}</button>
    </div>
  );

  return (
    <div className="card">
      <button onClick={onFechar} style={{ marginBottom: '.75rem' }}>← Voltar</button>
      <h2>{parada.ordem}. {cliente.nome}</h2>
      <p className="suave">{cliente.endereco}<br />{parada.qtdTitulos} título(s) · <b>{brl(parada.valorTotal)}</b> · {cliente.telefone}</p>
      {msg && <div className="erro">{msg}</div>}

      <label>O cliente foi atendido?</label>
      <Sn k="atendido" />

      {f.atendido && <>
        <label>Pagou?</label>
        <Sn k="pagou" />
        {f.pagou && <label>Valor recebido (R$)<input type="number" min="0" step="0.01" value={f.valorRecebido} onChange={ev => set('valorRecebido', ev.target.value)} /></label>}
        <label>Houve negociação?</label>
        <Sn k="negociou" />
        {f.negociou && <label>Valor negociado (R$)<input type="number" min="0" step="0.01" value={f.valorNegociado} onChange={ev => set('valorNegociado', ev.target.value)} /></label>}
        <label>Data prometida {(f.negociou || motivo?.tipo === 'promessa') ? '(obrigatória)' : '(se houver)'}
          <input type="date" min={hojeISO()} value={f.dataPrometida} onChange={ev => set('dataPrometida', ev.target.value)} /></label>
      </>}

      <label>Motivo
        <select value={f.motivoId} onChange={ev => set('motivoId', ev.target.value)}>
          <option value="">Escolha…</option>
          {e.motivos.filter(m => m.ativo).map(m => <option key={m.id} value={m.id}>{m.descricao}</option>)}
        </select>
      </label>
      <label>O que o cliente disse / observações
        <textarea rows="3" value={f.observacao} onChange={ev => set('observacao', ev.target.value)} /></label>

      {modo === 'demo' && (
        <label>Onde estou (simulação)
          <select value={f.onde} onChange={ev => set('onde', ev.target.value)}>
            <option value="perto">No cliente (≈ 30 m)</option>
            <option value="longe">Longe do cliente (≈ 1 km) — testa a justificativa</option>
          </select>
        </label>
      )}
      <button className="principal grande" disabled={salvando} onClick={salvar}>{salvando ? 'Salvando…' : 'Registrar check-in'}</button>
    </div>
  );
}
