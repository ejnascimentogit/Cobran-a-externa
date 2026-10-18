import { useState } from 'react';
import { supabase } from '../../../compartilhado/real/cliente.js';
import { useSessao } from '../../../compartilhado/real/hooks.js';
import AoVivo from './AoVivoReal.jsx';
import Rotas from './RotasReal.jsx';
import Regras from './RegrasReal.jsx';
import Cadastros from './CadastrosReal.jsx';

const ABAS = [
  ['aovivo', 'Acompanhamento ao vivo', AoVivo],
  ['rotas', 'Rotas', Rotas],
  ['regras', 'Regras de cobrança', Regras],
  ['cadastros', 'Cadastros', Cadastros],
];

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
    if (error) setMsg(/invalid login/i.test(error.message) ? 'E-mail ou senha incorretos.' : 'Não consegui entrar. Tente de novo.');
    setOcupado(false);
  };
  return (
    <main style={{ maxWidth: 420 }}>
      <div className="card">
        <h2>Cobrança Externa · Entrar</h2>
        <p className="suave">Use o mesmo login do painel da empresa.</p>
        <form onSubmit={entrar}>
          {msg && <div className="erro">{msg}</div>}
          <label>E-mail<input type="email" autoComplete="username" value={email} onChange={e => setEmail(e.target.value)} required /></label>
          <label>Senha<input type="password" autoComplete="current-password" value={senha} onChange={e => setSenha(e.target.value)} required /></label>
          <button className="principal" disabled={ocupado}>{ocupado ? 'Entrando…' : 'Entrar'}</button>
        </form>
        <p className="suave" style={{ marginTop: '1rem' }}>Para ver a demonstração com dados de exemplo: <a href="/?demo=1">abrir demonstração</a>.</p>
      </div>
    </main>
  );
}

export default function AppReal() {
  const { carregando, sessao } = useSessao();
  const [aba, setAba] = useState('aovivo');
  if (carregando) return <main><div className="card">Carregando…</div></main>;
  if (!sessao) return <Entrar />;

  const usuario = sessao.user;
  const empresaId = Number(usuario.app_metadata?.empresa_id);
  const Tela = ABAS.find(a => a[0] === aba)[2];

  return (
    <>
      <header className="topo">
        <h1>Cobrança Externa · Painel do analista</h1>
        <span className="espaco" />
        <span style={{ fontSize: '.85rem', opacity: .85 }}>{usuario.email}</span>
        <button onClick={() => supabase.auth.signOut()}>Sair</button>
      </header>
      <nav className="abas">
        {ABAS.map(([id, nome]) => <button key={id} className={id === aba ? 'ativa' : ''} onClick={() => setAba(id)}>{nome}</button>)}
      </nav>
      <main>
        {!Number.isInteger(empresaId)
          ? <div className="erro">Este login não está ligado a uma empresa (falta o <code>empresa_id</code> no acesso). Peça ao administrador.</div>
          : <Tela empresaId={empresaId} usuario={usuario} />}
      </main>
    </>
  );
}
