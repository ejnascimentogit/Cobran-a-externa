import { useEffect, useState } from 'react';
import Mapa from '../../compartilhado/Mapa.jsx';
import { useEstado } from '../../compartilhado/hooks.js';
import { brl, esc, horaBR, RESULTADO } from '../../compartilhado/formato.js';
import { iniciarRota, finalizarRota, registrarPosicao, resumoRota, ErroNegocio } from '../../compartilhado/servico.js';
import { getModo, setModo, obterGps } from './posicao.js';
import Checkin from './Checkin.jsx';

export default function Rota({ cobrador }) {
  const e = useEstado();
  const [modo, setModoState] = useState(getModo);
  const [aberta, setAberta] = useState(null); // id da parada com o formulário aberto
  const [msg, setMsg] = useState('');
  const [ocupado, setOcupado] = useState(false);

  const rota = e.rotas
    .filter(r => r.data === e.demoData && ['enviada', 'em_andamento'].includes(r.status) && e.rotaCobradores.some(x => x.rotaId === r.id && x.cobradorId === cobrador.id))
    .sort((a, b) => (a.status === 'em_andamento' ? -1 : 1))[0];
  const rc = rota && e.rotaCobradores.find(x => x.rotaId === rota.id && x.cobradorId === cobrador.id);
  const emAndamento = rota?.status === 'em_andamento' && rc?.inicioEm && !rc.fimEm;

  // Posição enviada ao analista a cada 45 s, só com a rota em andamento (modo GPS).
  useEffect(() => {
    if (!emAndamento || modo !== 'gps') return;
    const enviar = () => obterGps().then(p => registrarPosicao(cobrador.id, rota.id, p)).catch(() => {});
    const t = setInterval(enviar, 45000);
    return () => clearInterval(t);
  }, [emAndamento, modo, cobrador.id, rota?.id]);

  const trocarModo = m => { setModo(m); setModoState(m); };
  const comPosicao = async fn => {
    setOcupado(true); setMsg('');
    try {
      const pos = modo === 'gps' ? await obterGps() : e.config.deposito;
      fn(pos);
    } catch (x) { setMsg(x instanceof ErroNegocio || x instanceof Error ? x.message : 'Erro inesperado.'); }
    setOcupado(false);
  };

  const seletor = (
    <label className="linha" style={{ fontSize: '.85rem', color: 'var(--suave)' }}>
      Posição:
      <select style={{ width: 'auto' }} value={modo} onChange={ev => trocarModo(ev.target.value)}>
        <option value="demo">Simulada (demonstração)</option>
        <option value="gps">GPS do aparelho</option>
      </select>
    </label>
  );

  if (!rota) return (
    <div className="card">
      <h2>Nenhuma rota para hoje</h2>
      <p className="suave">Quando o analista enviar uma rota para você, ela aparece aqui.</p>
      {seletor}
    </div>
  );

  const r = resumoRota(e, rota.id);
  const finalizada = !!rc.fimEm;
  const pendentes = r.linhas.filter(l => !l.checkin).length;
  const parada = aberta && r.linhas.find(l => l.parada.id === aberta);

  if (parada) return (
    <Checkin linha={parada} cobrador={cobrador} modo={modo} onFechar={() => setAberta(null)} />
  );

  const marcadores = r.linhas.map(l => ({
    id: l.parada.id, lat: l.cliente.lat, lng: l.cliente.lng, cor: RESULTADO[l.resultado].cor, raio: 11,
    html: `<b>${l.parada.ordem}. ${esc(l.cliente.nome)}</b>`, onClick: () => emAndamento && !l.checkin && setAberta(l.parada.id),
  }));

  return (
    <>
      <div className="card">
        <h2>{e.regras.find(g => g.id === rota.regraId)?.nome} · {rota.praca}</h2>
        <div className="indicadores" style={{ marginBottom: '.5rem' }}>
          <div className="indicador"><b>{r.visitados}/{r.clientes}</b><span>visitados</span></div>
          <div className="indicador"><b>{brl(r.valorTotal)}</b><span>em cobrança</span></div>
          <div className="indicador"><b>{brl(r.recebido)}</b><span>recebido</span></div>
        </div>
        {msg && <div className="erro">{msg}</div>}
        {!rc.inicioEm && <button className="principal grande" disabled={ocupado} onClick={() => comPosicao(pos => iniciarRota(rota.id, cobrador.id, pos))}>▶ Iniciar rota</button>}
        {emAndamento && <button className="grande" disabled={ocupado}
          onClick={() => confirm(pendentes ? `Ainda há ${pendentes} cliente(s) sem visita. Eles voltam para a carteira. Finalizar mesmo assim?` : 'Finalizar a rota e voltar para a empresa?')
            && comPosicao(pos => finalizarRota(rota.id, cobrador.id, pos))}>🏁 Finalizar rota (voltei para a empresa)</button>}
        {finalizada && <div className="ok">Rota finalizada às {horaBR(rc.fimEm)}. Bom trabalho!</div>}
        {seletor}
      </div>

      <div className="card"><Mapa marcadores={marcadores} altura={240} ajustarKey={rota.id} /></div>

      <h3>Clientes na ordem de visita</h3>
      {r.linhas.map(l => (
        <button key={l.parada.id} className={`parada ${l.checkin ? 'feita' : ''}`} disabled={!emAndamento || !!l.checkin} onClick={() => setAberta(l.parada.id)}>
          <span className="ordem">{l.checkin ? '✓' : l.parada.ordem}</span>
          <span className="corpo">
            <b>{l.cliente.nome}</b>
            <small className="suave">{l.cliente.endereco} · {l.parada.qtdTitulos} título(s) · {brl(l.parada.valorTotal)}</small>
            <small className="suave">Previsão {horaBR(l.parada.previsaoChegada)}</small>
          </span>
          <span className="selo" style={{ background: RESULTADO[l.resultado].cor }}>{RESULTADO[l.resultado].texto}</span>
        </button>
      ))}
      {!emAndamento && !finalizada && <p className="suave">Inicie a rota para fazer os check-ins.</p>}
    </>
  );
}
