// App guardado no aparelho para abrir SEM SINAL (docs/12-modo-offline.md).
// - Arquivos do app (/motoqueiro/assets/...): do cache primeiro (o nome muda a cada versão).
// - Páginas: rede primeiro; sem sinal, abre a última versão guardada.
// - Só o próprio site; NUNCA guarda chamadas ao banco nem a mapa de terceiros.
// Para forçar limpeza em todos os aparelhos, mude CACHE.
const CACHE = 'cobranca-motoqueiro-v2';
const BASE = '/motoqueiro/';

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll([BASE, `${BASE}manifest.webmanifest`, `${BASE}icone.svg`])).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => e.waitUntil(
  caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim())));

self.addEventListener('fetch', e => {
  const u = new URL(e.request.url);
  if (e.request.method !== 'GET' || u.origin !== location.origin || !u.pathname.startsWith(BASE)) return;

  if (u.pathname.startsWith(`${BASE}assets/`)) {
    e.respondWith(caches.match(e.request).then(guardado => guardado || fetch(e.request).then(r => {
      const copia = r.clone();
      caches.open(CACHE).then(c => c.put(e.request, copia));
      return r;
    })));
    return;
  }

  e.respondWith(fetch(e.request).then(r => {
    const copia = r.clone();
    caches.open(CACHE).then(c => c.put(e.request, copia));
    return r;
  }).catch(() => caches.match(e.request).then(g => g || caches.match(BASE))));
});
