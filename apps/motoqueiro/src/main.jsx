import { createRoot } from 'react-dom/client';
import '../../compartilhado/base.css';
import './app.css';
import App from './App.jsx';
import AppReal from './real/AppReal.jsx';
import { modoReal } from '../../compartilhado/real/modo.js';

// Enquanto a ligação ao banco é validada, o site abre na demonstração; ?real=1 liga o modo real.
createRoot(document.getElementById('raiz')).render(modoReal() ? <AppReal /> : <App />);

if ('serviceWorker' in navigator && import.meta.env.PROD) {
  navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`).catch(() => {});
}
