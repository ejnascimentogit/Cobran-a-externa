// Posição do aparelho. No modo "demo" (sem backend, sem rua) o app simula onde o motoqueiro está
// para dar para testar o fluxo no computador; no modo "gps" usa o GPS do navegador.
const CHAVE = 'cobranca_modo_posicao';

export const getModo = () => { try { return localStorage.getItem(CHAVE) || 'demo'; } catch { return 'demo'; } };
export const setModo = m => { try { localStorage.setItem(CHAVE, m); } catch { /* sem armazenamento */ } };

export function obterGps() {
  return new Promise((ok, falha) => {
    if (!navigator.geolocation) return falha(new Error('Este aparelho não oferece GPS ao navegador.'));
    navigator.geolocation.getCurrentPosition(
      p => ok({ lat: p.coords.latitude, lng: p.coords.longitude }),
      () => falha(new Error('Não consegui pegar o GPS. Ative a localização e permita para este site.')),
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 10000 },
    );
  });
}

// ~30 m ao lado do ponto, ou ~1,1 km ao norte (para testar o "fora do raio").
export const simularPerto = c => ({ lat: c.lat + 0.0002, lng: c.lng + 0.0002 });
export const simularLonge = c => ({ lat: c.lat + 0.01, lng: c.lng });
