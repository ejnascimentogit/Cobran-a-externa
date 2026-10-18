// Enquanto a ligação ao banco é validada, o site abre na DEMONSTRAÇÃO. O modo real liga com ?real=1
// (fica lembrado neste navegador) e volta com ?demo=1.
const CHAVE = 'cobranca_modo';

export function modoReal() {
  try {
    const q = new URLSearchParams(location.search);
    if (q.get('real') === '1') localStorage.setItem(CHAVE, 'real');
    if (q.get('demo') === '1') localStorage.setItem(CHAVE, 'demo');
    return localStorage.getItem(CHAVE) === 'real';
  } catch {
    return false;
  }
}
