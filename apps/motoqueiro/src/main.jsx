import { createRoot } from 'react-dom/client';
import '../../compartilhado/base.css';
import './app.css';
import App from './App.jsx';

createRoot(document.getElementById('raiz')).render(<App />);

if ('serviceWorker' in navigator && import.meta.env.PROD) {
  navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`).catch(() => {});
}
