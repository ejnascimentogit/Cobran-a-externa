import { useState } from 'react';
import { useEstado } from '../../compartilhado/hooks.js';
import { registrarConsentimento } from '../../compartilhado/servico.js';
import Rota from './Rota.jsx';

const CHAVE = 'cobranca_cobrador';
const ler = () => { try { return localStorage.getItem(CHAVE) || ''; } catch { return ''; } };

export default function App() {
  const e = useEstado();
  const [id, setId] = useState(ler);
  const [aceite, setAceite] = useState(false);
  const cobrador = e.cobradores.find(c => c.id === id && c.ativo);

  const sair = () => { try { localStorage.removeItem(CHAVE); } catch { /* ok */ } setId(''); };
  const entrar = cid => {
    registrarConsentimento(cid);
    try { localStorage.setItem(CHAVE, cid); } catch { /* ok */ }
    setId(cid);
  };

  if (!cobrador || !cobrador.consentimentoEm) {
    return (
      <div className="app">
        <header className="topo"><h1>Cobrança Externa</h1></header>
        <div className="card">
          <h2>Quem é você?</h2>
          <p className="suave">Demonstração: na versão real o motoqueiro entra com usuário e senha.</p>
          <div className="aviso">
            <b>Sua localização.</b> O app registra a sua posição <b>somente enquanto a rota estiver em andamento</b>, para o analista
            acompanhar o trajeto. Fora da rota nada é registrado.
          </div>
          <label className="linha"><input type="checkbox" checked={aceite} onChange={ev => setAceite(ev.target.checked)} />
            Entendi e aceito o registro da localização durante a rota.</label>
          {e.cobradores.filter(c => c.ativo).map(c => (
            <button key={c.id} className="principal grande" style={{ marginBottom: '.5rem' }} disabled={!aceite} onClick={() => entrar(c.id)}>
              Entrar como {c.nome}
            </button>
          ))}
        </div>
      </div>
    );
  }
  return (
    <div className="app">
      <header className="topo"><h1>Olá, {cobrador.nome}</h1><button onClick={sair}>Sair</button></header>
      <Rota cobrador={cobrador} />
    </div>
  );
}
