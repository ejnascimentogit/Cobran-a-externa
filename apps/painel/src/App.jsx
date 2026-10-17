import { useState } from 'react';
import { reiniciarDemo } from '../../compartilhado/store.js';
import Regras from './Regras.jsx';
import Rotas from './Rotas.jsx';
import AoVivo from './AoVivo.jsx';
import Monitorados from './Monitorados.jsx';
import Cadastros from './Cadastros.jsx';

const ABAS = [
  ['regras', 'Regras de cobrança', Regras],
  ['rotas', 'Montar rota', Rotas],
  ['aovivo', 'Acompanhamento ao vivo', AoVivo],
  ['monitorados', 'Títulos monitorados', Monitorados],
  ['cadastros', 'Cadastros', Cadastros],
];

export default function App() {
  const [aba, setAba] = useState('rotas');
  const Tela = ABAS.find(a => a[0] === aba)[2];
  return (
    <>
      <header className="topo">
        <h1>Cobrança Externa · Painel do analista</h1>
        <span className="espaco" />
        <a href="/motoqueiro/" target="_blank" rel="noreferrer">Abrir app do motoqueiro ↗</a>
        <button onClick={() => confirm('Voltar aos dados de teste originais? Rotas e check-ins feitos serão apagados.') && reiniciarDemo()}>
          Reiniciar demonstração
        </button>
      </header>
      <nav className="abas">
        {ABAS.map(([id, nome]) => (
          <button key={id} className={id === aba ? 'ativa' : ''} onClick={() => setAba(id)}>{nome}</button>
        ))}
      </nav>
      <main>
        <div className="aviso">
          <b>Modo demonstração:</b> dados fictícios guardados neste navegador (sem Supabase nem ERP ainda). O painel e o app do
          motoqueiro precisam estar abertos no mesmo navegador para o acompanhamento ao vivo funcionar.
        </div>
        <Tela />
      </main>
    </>
  );
}
