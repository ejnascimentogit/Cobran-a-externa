import { useState } from 'react';
import { useEstado } from '../../compartilhado/hooks.js';
import { brl, dataBR } from '../../compartilhado/formato.js';
import { conferirBaixas, simularBaixa } from '../../compartilhado/servico.js';

const STATUS = {
  aguardando: ['Aguardando', '#ca8a04'], baixado: ['Baixado', '#16a34a'], promessa_quebrada: ['Promessa quebrada', '#dc2626'],
};

export default function Monitorados() {
  const e = useEstado();
  const [msg, setMsg] = useState('');
  const conta = s => e.monitorados.filter(m => m.status === s).length;
  const valor = s => e.monitorados.filter(m => m.status === s)
    .reduce((t, m) => t + (e.titulos.find(x => x.codTitulo === m.codTitulo && x.codCliente === m.codCliente)?.valor || 0), 0);

  return (
    <>
      <div className="indicadores">
        <div className="indicador"><b>{e.monitorados.length}</b><span>títulos monitorados</span></div>
        <div className="indicador"><b style={{ color: 'var(--ok)' }}>{conta('baixado')}</b><span>baixados · {brl(valor('baixado'))}</span></div>
        <div className="indicador"><b style={{ color: 'var(--alerta)' }}>{conta('aguardando')}</b><span>aguardando · {brl(valor('aguardando'))}</span></div>
        <div className="indicador"><b style={{ color: 'var(--erro)' }}>{conta('promessa_quebrada')}</b><span>promessa quebrada · {brl(valor('promessa_quebrada'))}</span></div>
      </div>
      <div className="card">
        <div className="linha-acoes" style={{ marginBottom: '.75rem' }}>
          <h2 style={{ margin: 0, flex: 1 }}>Títulos que passaram por tratativa</h2>
          <button className="principal" onClick={() => { const r = conferirBaixas(); setMsg(`${r.baixados} baixado(s), ${r.quebrados} promessa(s) quebrada(s).`); }}>
            Conferir baixas agora
          </button>
        </div>
        {msg && <div className="ok">{msg}</div>}
        <p className="suave">Na versão real, a conferência roda sozinha com as baixas que a integração do ERP (Ryan) trouxer. Aqui o botão "Simular baixa" imita essa integração.</p>
        <div className="tabela-rolagem"><table>
          <thead><tr><th>Título</th><th>Cliente</th><th className="num">Valor</th><th>Prometido para</th><th>Situação</th><th /></tr></thead>
          <tbody>
            {e.monitorados.map(m => {
              const t = e.titulos.find(x => x.codTitulo === m.codTitulo && x.codCliente === m.codCliente);
              const [txt, cor] = STATUS[m.status];
              return (
                <tr key={m.id}>
                  <td>{m.codTitulo}</td><td>{e.clientes.find(c => c.cod === m.codCliente)?.nome}</td>
                  <td className="num">{brl(t?.valor)}</td><td>{dataBR(m.dataPrometida)}</td>
                  <td><span className="selo" style={{ background: cor }}>{txt}</span>{m.dataBaixa && <span className="suave"> em {dataBR(m.dataBaixa)}</span>}</td>
                  <td className="num">{m.status === 'aguardando' && !t?.dataPagamento && <button onClick={() => simularBaixa(m.codTitulo, m.codCliente)}>Simular baixa</button>}</td>
                </tr>
              );
            })}
            {!e.monitorados.length && <tr><td colSpan="6" className="suave">Nada monitorado ainda: aparece aqui o que o motoqueiro registrar como pago, negociado ou prometido.</td></tr>}
          </tbody>
        </table></div>
      </div>
    </>
  );
}
