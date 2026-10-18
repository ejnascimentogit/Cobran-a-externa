import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Mapa from '../../../compartilhado/Mapa.jsx';
import { criarFila, armazenamentoLocalStorage } from '../../../compartilhado/fila.js';
import { brl, esc, horaBR, RESULTADO } from '../../../compartilhado/formato.js';
import { supabase } from '../../../compartilhado/real/cliente.js';
import { criarEnviar } from '../../../compartilhado/real/envio.js';
import { hojeBRT, resultadoDaVisita } from '../../../compartilhado/real/validacao.js';
import { obterGps } from '../posicao.js';
import CheckinReal from './CheckinReal.jsx';

const USUARIO_LOCAL = 'cobranca_real_usuario';
const lerJson = (chave, padrao) => { try { return JSON.parse(localStorage.getItem(chave)) ?? padrao; } catch { return padrao; } };
const gravarJson = (chave, valor) => { try { localStorage.setItem(chave, JSON.stringify(valor)); } catch { /* sem armazenamento */ } };

/* ---------- sessão ---------- */

function useSessao() {
  const [estado, setEstado] = useState({ carregando: true, sessao: null });
  useEffect(() => {
    let vivo = true;
    supabase.auth.getSession()
      .then(({ data }) => vivo && setEstado({ carregando: false, sessao: data.session }))
      .catch(() => vivo && setEstado({ carregando: false, sessao: null }));
    const { data } = supabase.auth.onAuthStateChange((_evento, sessao) => setEstado({ carregando: false, sessao }));
    return () => { vivo = false; data.subscription.unsubscribe(); };
  }, []);
  return estado;
}

function Cartao({ titulo, children }) {
  return (
    <div className="app">
      <header className="topo"><h1>Cobrança Externa</h1></header>
      <div className="card">{titulo && <h2>{titulo}</h2>}{children}</div>
    </div>
  );
}

function Entrar() {
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [msg, setMsg] = useState('');
  const [ocupado, setOcupado] = useState(false);
  const entrar = async e => {
    e.preventDefault();
    setOcupado(true);
    setMsg('');
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim().toLowerCase(), password: senha });
    if (error) setMsg(/invalid login/i.test(error.message) ? 'E-mail ou senha incorretos.' : navigator.onLine ? 'Não consegui entrar. Tente de novo.' : 'Sem sinal: não dá para entrar agora.');
    setOcupado(false);
  };
  return (
    <Cartao titulo="Entrar">
      <form onSubmit={entrar}>
        {msg && <div className="erro">{msg}</div>}
        <label>E-mail<input type="email" autoComplete="username" value={email} onChange={e => setEmail(e.target.value)} required /></label>
        <label>Senha<input type="password" autoComplete="current-password" value={senha} onChange={e => setSenha(e.target.value)} required /></label>
        <button className="principal grande" disabled={ocupado}>{ocupado ? 'Entrando…' : 'Entrar'}</button>
      </form>
    </Cartao>
  );
}

function TrocarSenha() {
  const [a, setA] = useState('');
  const [b, setB] = useState('');
  const [msg, setMsg] = useState('');
  const salvar = async e => {
    e.preventDefault();
    if (a.length < 8) return setMsg('A senha precisa ter pelo menos 8 caracteres.');
    if (a !== b) return setMsg('As duas senhas não são iguais.');
    const { error } = await supabase.auth.updateUser({ password: a, data: { trocar_senha: false } });
    if (error) setMsg('Não consegui trocar a senha. Tente de novo com sinal.');
  };
  return (
    <Cartao titulo="Crie a sua senha">
      <p className="suave">Você entrou com uma senha provisória. Escolha uma senha só sua.</p>
      <form onSubmit={salvar}>
        {msg && <div className="erro">{msg}</div>}
        <label>Nova senha<input type="password" autoComplete="new-password" value={a} onChange={e => setA(e.target.value)} /></label>
        <label>Repita a senha<input type="password" autoComplete="new-password" value={b} onChange={e => setB(e.target.value)} /></label>
        <button className="principal grande">Salvar senha</button>
      </form>
    </Cartao>
  );
}

/* ---------- dados ---------- */

async function consulta(promessa) {
  const { data, error } = await promessa;
  if (error) throw new Error(error.message);
  return data;
}

async function carregarDados(userId) {
  const cobrador = await consulta(supabase.from('cob01_cobrador').select('*').eq('cob01_auth_id', userId).maybeSingle());
  if (!cobrador) return { cobrador: null };
  const rcs = await consulta(supabase.from('cob05_rota_cobrador').select('*').eq('cob05_cobrador_id', cobrador.cob01_id));
  const rotaIds = rcs.map(r => r.cob05_rota_id);
  const [rotas, paradas, checkins, motivos, config] = await Promise.all([
    rotaIds.length ? consulta(supabase.from('cob04_rota').select('*').in('cob04_id', rotaIds)) : [],
    rotaIds.length ? consulta(supabase.from('cob06_rota_parada').select('*').in('cob06_rota_id', rotaIds)
      .eq('cob06_cobrador_id', cobrador.cob01_id).order('cob06_ordem')) : [],
    rotaIds.length ? consulta(supabase.from('cob08_checkin')
      .select('cob08_uuid, cob08_rota_id, cob08_parada_id, cob08_tipo, cob08_resultado, cob08_aparelho_em')
      .eq('cob08_cobrador_id', cobrador.cob01_id).in('cob08_rota_id', rotaIds)) : [],
    consulta(supabase.from('cob03_motivo').select('*').eq('cob03_ativo', true).order('cob03_id')),
    consulta(supabase.from('cob11_config').select('cob11_raio_gps_m').maybeSingle()),
  ]);
  return { cobrador, rcs, rotas, paradas, checkins, motivos, raioM: config?.cob11_raio_gps_m ?? 200, carregadoEm: new Date().toISOString() };
}

/* ---------- tela principal ---------- */

function Principal({ usuario }) {
  const chaveCache = `cobranca_real_cache_${usuario.id}`;
  const [dados, setDados] = useState(() => lerJson(chaveCache, null));
  const [erroDados, setErroDados] = useState('');
  const [online, setOnline] = useState(navigator.onLine);
  const [fila, setFila] = useState(null);
  const [, redesenhar] = useState(0);
  const [aberta, setAberta] = useState(null);
  const [msg, setMsg] = useState('');
  const [ocupado, setOcupado] = useState(false);
  const filaRef = useRef(null);

  const recarregar = useCallback(async () => {
    if (!navigator.onLine) return;
    try {
      const novos = await carregarDados(usuario.id);
      setDados(novos);
      gravarJson(chaveCache, novos);
      setErroDados('');
    } catch (x) {
      setErroDados(navigator.onLine ? `Não consegui atualizar: ${x.message}` : '');
    }
  }, [usuario.id, chaveCache]);

  const sincronizar = useCallback(async () => {
    const f = filaRef.current;
    if (!f || !navigator.onLine) return;
    await supabase.auth.getSession().catch(() => {}); // renova o login vencido, se houver sinal
    const r = await f.sincronizar();
    if (r.enviados > 0) await recarregar();
  }, [recarregar]);

  // fila deste usuário, guardada no aparelho
  useEffect(() => {
    let cancelado = false;
    criarFila({ armazenamento: armazenamentoLocalStorage(`cobranca_fila_${usuario.id}`), enviar: criarEnviar(supabase) }).then(f => {
      if (cancelado) return;
      filaRef.current = f;
      f.assinar(() => redesenhar(n => n + 1));
      setFila(f);
      sincronizar();
    });
    return () => { cancelado = true; };
  }, [usuario.id, sincronizar]);

  // abre e atualiza: ao abrir, ao voltar o sinal, ao voltar para o app e a cada minuto
  useEffect(() => {
    recarregar();
    const ligou = () => { setOnline(true); sincronizar(); recarregar(); };
    const caiu = () => setOnline(false);
    const voltou = () => { if (document.visibilityState === 'visible') { sincronizar(); recarregar(); } };
    window.addEventListener('online', ligou);
    window.addEventListener('offline', caiu);
    document.addEventListener('visibilitychange', voltou);
    const t = setInterval(() => { if (navigator.onLine) sincronizar(); }, 60000);
    return () => {
      window.removeEventListener('online', ligou);
      window.removeEventListener('offline', caiu);
      document.removeEventListener('visibilitychange', voltou);
      clearInterval(t);
    };
  }, [recarregar, sincronizar]);

  const eventos = fila ? fila.lista() : [];
  const resumo = fila ? fila.resumo() : { pendentes: 0, comErro: 0 };

  const visao = useMemo(() => {
    if (!dados?.cobrador) return null;
    // a rota ativa; se não há, a que acabou de ser finalizada hoje (para mostrar "Rota finalizada")
    const rotas = dados.rotas || [];
    const rota = rotas
      .filter(r => ['enviada', 'em_andamento'].includes(r.cob04_status))
      .sort(r => (r.cob04_status === 'em_andamento' ? -1 : 1))[0]
      || rotas.find(r => eventos.some(e => e.dados.cob08_rota_id === r.cob04_id))
      || [...rotas].sort((a, b) => b.cob04_id - a.cob04_id)
        .find(r => r.cob04_status === 'finalizada' && r.cob04_data === hojeBRT());
    if (!rota) return { rota: null };
    const rc = dados.rcs.find(x => x.cob05_rota_id === rota.cob04_id) || {};
    const doRota = tipo => eventos.filter(e => e.tipo === tipo && (e.dados.cob08_rota_id ?? e.dados.cob09_rota_id) === rota.cob04_id);
    const inicioFeito = !!rc.cob05_inicio_em || doRota('inicio').length > 0;
    const fimFeito = !!rc.cob05_fim_em || doRota('finalizacao').length > 0;
    const paradas = (dados.paradas || []).filter(p => p.cob06_rota_id === rota.cob04_id).map(p => {
      const noServidor = dados.checkins.find(c => c.cob08_tipo === 'visita' && c.cob08_parada_id === p.cob06_id);
      const naFila = eventos.find(e => e.tipo === 'visita' && e.dados.cob08_parada_id === p.cob06_id);
      const resultado = noServidor?.cob08_resultado
        || (naFila ? resultadoDaVisita({
          atendido: naFila.dados.cob08_atendido, pagou: naFila.dados.cob08_pagou,
          negociou: naFila.dados.cob08_negociou, dataPrometida: naFila.dados.cob08_data_prometida,
        }) : 'pendente');
      return { ...p, resultado, naFila: !noServidor && !!naFila, feita: !!noServidor || !!naFila };
    });
    return { rota, rc, inicioFeito, fimFeito, paradas };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dados, fila, resumo.pendentes, resumo.comErro]);

  const emAndamento = visao?.rota && visao.inicioFeito && !visao.fimFeito;

  // posição enviada a cada 45 s durante a rota (só com o app aberto e a tela ligada)
  useEffect(() => {
    if (!emAndamento || !fila) return undefined;
    let trava = null;
    if ('wakeLock' in navigator) navigator.wakeLock.request('screen').then(t => { trava = t; }).catch(() => {});
    const t = setInterval(async () => {
      try {
        const p = await obterGps();
        await fila.adicionar('posicao', {
          cob09_empresa_id: dados.cobrador.cob01_empresa_id, cob09_rota_id: visao.rota.cob04_id,
          cob09_cobrador_id: dados.cobrador.cob01_id, cob09_latitude: p.lat, cob09_longitude: p.lng,
        });
        sincronizar();
      } catch { /* sem GPS neste instante: tenta no próximo */ }
    }, 45000);
    return () => { clearInterval(t); trava?.release?.().catch(() => {}); };
  }, [emAndamento, fila, dados, visao, sincronizar]);

  const base = () => ({
    cob08_empresa_id: dados.cobrador.cob01_empresa_id, cob08_rota_id: visao.rota.cob04_id, cob08_cobrador_id: dados.cobrador.cob01_id,
  });

  const registrar = async (tipo, extra) => {
    setOcupado(true);
    setMsg('');
    try {
      const p = await obterGps();
      await fila.adicionar(tipo, { ...base(), cob08_latitude: p.lat, cob08_longitude: p.lng, ...extra });
      sincronizar();
    } catch (x) {
      setMsg(x.message);
    }
    setOcupado(false);
  };

  const sair = async () => {
    if (resumo.pendentes > 0 && !confirm(`Há ${resumo.pendentes} item(ns) sem enviar. Se sair agora, eles só sobem quando você entrar de novo com sinal. Sair mesmo assim?`)) return;
    localStorage.removeItem(USUARIO_LOCAL);
    await supabase.auth.signOut().catch(() => {});
  };

  /* --- telas --- */
  if (!dados) {
    return (
      <Cartao titulo="Carregando…">
        <p className="suave">{online ? 'Buscando a sua rota.' : 'Sem sinal e sem rota guardada neste aparelho. Abra o app uma vez com sinal.'}</p>
        {erroDados && <div className="erro">{erroDados}</div>}
        <button onClick={sair}>Sair</button>
      </Cartao>
    );
  }
  if (!dados.cobrador) {
    return (
      <Cartao titulo="Cadastro não encontrado">
        <p className="suave">Este login não é de motoqueiro. Fale com o administrador da empresa.</p>
        <button onClick={sair}>Sair</button>
      </Cartao>
    );
  }
  if (!dados.cobrador.cob01_consentimento_em) {
    return <Consentimento onAceitar={async () => {
      const { error } = await supabase.rpc('cob01_aceitar_localizacao');
      if (error) throw new Error(error.message);
      await recarregar();
    }} />;
  }

  const { cobrador } = dados;
  const parada = aberta && visao?.paradas?.find(p => p.cob06_id === aberta);
  if (parada) {
    return (
      <div className="app">
        <header className="topo"><h1>Olá, {cobrador.cob01_nome}</h1></header>
        <CheckinReal
          parada={parada} motivos={dados.motivos} raioM={dados.raioM} onFechar={() => setAberta(null)}
          onSalvar={async ({ lat, lng, linha }) => {
            await fila.adicionar('visita', { ...base(), cob08_parada_id: parada.cob06_id, cob08_latitude: lat, cob08_longitude: lng, ...linha });
            setAberta(null);
            sincronizar();
          }}
        />
      </div>
    );
  }

  const marcadores = (visao?.paradas || []).filter(p => p.cob06_latitude != null).map(p => ({
    id: p.cob06_id, lat: Number(p.cob06_latitude), lng: Number(p.cob06_longitude), cor: RESULTADO[p.resultado].cor, raio: 11,
    html: `<b>${p.cob06_ordem}. ${esc(p.cob06_cliente_nome)}</b>`,
  }));

  return (
    <div className="app">
      <header className="topo"><h1>Olá, {cobrador.cob01_nome}</h1><button onClick={sair}>Sair</button></header>

      <div className="card" style={{ padding: '.6rem .8rem' }}>
        <div className="linha-acoes">
          <span className="selo" style={{ background: online ? 'var(--ok)' : 'var(--alerta)' }}>{online ? 'Com sinal' : 'Sem sinal'}</span>
          <span>{resumo.pendentes > 0 ? `${resumo.pendentes} pendente(s) de envio` : 'Tudo enviado'}</span>
          <button style={{ marginLeft: 'auto' }} disabled={!online || resumo.pendentes === 0} onClick={sincronizar}>Enviar agora</button>
        </div>
        {erroDados && <div className="aviso" style={{ marginTop: '.5rem' }}>{erroDados}</div>}
        {eventos.filter(e => e.estado === 'erro').map(e => (
          <div className="erro" key={e.id} style={{ marginTop: '.5rem' }}>
            <b>{e.tipo === 'visita' ? 'Uma visita' : e.tipo === 'inicio' ? 'O início da rota' : e.tipo === 'finalizacao' ? 'A finalização' : 'Um ponto de posição'}</b> não foi aceita: {e.erro?.mensagem}
            <div className="linha-acoes" style={{ marginTop: '.4rem' }}>
              <button onClick={() => fila.reenviar(e.id).then(sincronizar)}>Tentar de novo</button>
              <button className="perigo" onClick={() => confirm('Descartar este registro? Ele não será enviado.') && fila.descartar(e.id)}>Descartar</button>
            </div>
          </div>
        ))}
      </div>

      {!visao?.rota ? (
        <div className="card"><h2>Nenhuma rota para hoje</h2><p className="suave">Quando o analista enviar uma rota para você, ela aparece aqui.</p></div>
      ) : (
        <>
          <div className="card">
            <h2>Rota {visao.rota.cob04_praca || ''}</h2>
            <div className="indicadores" style={{ marginBottom: '.5rem' }}>
              <div className="indicador"><b>{visao.paradas.filter(p => p.feita).length}/{visao.paradas.length}</b><span>visitados</span></div>
              <div className="indicador"><b>{brl(visao.paradas.reduce((s, p) => s + Number(p.cob06_valor_total), 0))}</b><span>em cobrança</span></div>
            </div>
            {msg && <div className="erro">{msg}</div>}
            {!visao.inicioFeito && <button className="principal grande" disabled={ocupado} onClick={() => registrar('inicio', {})}>▶ Iniciar rota</button>}
            {emAndamento && (
              <button className="grande" disabled={ocupado} onClick={() => {
                const faltam = visao.paradas.filter(p => !p.feita).length;
                if (confirm(faltam ? `Ainda há ${faltam} cliente(s) sem visita. Eles voltam para a carteira. Finalizar mesmo assim?` : 'Finalizar a rota e voltar para a empresa?')) registrar('finalizacao', {});
              }}>🏁 Finalizar rota (voltei para a empresa)</button>
            )}
            {visao.fimFeito && <div className="ok">Rota finalizada. Bom trabalho!</div>}
          </div>

          {marcadores.length > 0 && <div className="card"><Mapa marcadores={marcadores} altura={220} ajustarKey={String(visao.rota.cob04_id)} /></div>}

          <h3>Clientes na ordem de visita</h3>
          {visao.paradas.map(p => (
            <button key={p.cob06_id} className={`parada ${p.feita ? 'feita' : ''}`} disabled={!emAndamento || p.feita} onClick={() => setAberta(p.cob06_id)}>
              <span className="ordem">{p.feita ? '✓' : p.cob06_ordem}</span>
              <span className="corpo">
                <b>{p.cob06_cliente_nome}</b>
                <small className="suave">{p.cob06_cliente_endereco} · {p.cob06_qtd_titulos} título(s) · {brl(p.cob06_valor_total)}</small>
                <small className="suave">Previsão {horaBR(p.cob06_previsao_chegada)}{p.naFila ? ' · aguardando envio' : ''}</small>
              </span>
              <span className="selo" style={{ background: RESULTADO[p.resultado].cor }}>{RESULTADO[p.resultado].texto}</span>
            </button>
          ))}
          {!emAndamento && !visao.fimFeito && <p className="suave">Inicie a rota para fazer os check-ins.</p>}
        </>
      )}
      <p className="suave" style={{ fontSize: '.8rem' }}>
        Dados de {dados.carregadoEm ? horaBR(dados.carregadoEm) : '—'}. O rastreamento só funciona com o app aberto e a tela ligada.
      </p>
    </div>
  );
}

function Consentimento({ onAceitar }) {
  const [aceite, setAceite] = useState(false);
  const [msg, setMsg] = useState('');
  return (
    <Cartao titulo="Sua localização">
      <div className="aviso">
        O app registra a sua posição <b>somente enquanto a rota estiver em andamento</b>, para o analista acompanhar o trajeto.
        Fora da rota nada é registrado. Você pode retirar o consentimento quando quiser.
      </div>
      {msg && <div className="erro">{msg}</div>}
      <label className="linha"><input type="checkbox" checked={aceite} onChange={e => setAceite(e.target.checked)} />
        Entendi e aceito o registro da localização durante a rota.</label>
      <button className="principal grande" disabled={!aceite} onClick={() => onAceitar().catch(x => setMsg(x.message))}>Continuar</button>
    </Cartao>
  );
}

/* ---------- raiz ---------- */

export default function AppReal() {
  const { carregando, sessao } = useSessao();
  if (carregando) return <Cartao titulo="Carregando…" />;

  let usuario = sessao?.user ?? null;
  if (usuario) gravarJson(USUARIO_LOCAL, { id: usuario.id, email: usuario.email });
  else if (!navigator.onLine) usuario = lerJson(USUARIO_LOCAL, null); // sem sinal: segue com a rota guardada neste aparelho

  if (!usuario) return <Entrar />;
  if (usuario.user_metadata?.trocar_senha) return <TrocarSenha />;
  return <Principal usuario={usuario} />;
}
