import { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Mapa com OpenStreetMap (sem chave). Escolha final do serviço de mapa é um ponto em aberto.
// marcadores: [{ id, lat, lng, cor, raio, html (tooltip, já escapado), onClick }]
// linhas: [{ pontos: [[lat,lng],...], cor }]
export default function Mapa({ marcadores = [], linhas = [], altura = 420, ajustarKey = '' }) {
  const el = useRef(null), mapa = useRef(null), camada = useRef(null), ultimoAjuste = useRef(null);

  useEffect(() => {
    mapa.current = L.map(el.current, { zoomControl: true }).setView([-23.55, -46.63], 12);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19, attribution: '© OpenStreetMap',
    }).addTo(mapa.current);
    camada.current = L.layerGroup().addTo(mapa.current);
    return () => mapa.current.remove();
  }, []);

  useEffect(() => {
    camada.current.clearLayers();
    const pts = [];
    linhas.forEach(l => {
      if (l.pontos.length > 1) L.polyline(l.pontos, { color: l.cor || '#2563eb', weight: 3, opacity: 0.7 }).addTo(camada.current);
    });
    marcadores.forEach(m => {
      const c = L.circleMarker([m.lat, m.lng], {
        radius: m.raio || 9, color: '#fff', weight: 2, fillColor: m.cor || '#2563eb', fillOpacity: 0.95,
      }).addTo(camada.current);
      if (m.html) c.bindTooltip(m.html, { direction: 'top' });
      if (m.onClick) c.on('click', () => m.onClick(m));
      pts.push([m.lat, m.lng]);
    });
    // Só reenquadra quando muda o conjunto (ajustarKey), para não "pular" a cada check-in.
    if (pts.length && ultimoAjuste.current !== ajustarKey) {
      mapa.current.fitBounds(pts, { padding: [40, 40], maxZoom: 15, animate: false });
      ultimoAjuste.current = ajustarKey;
    }
  }, [marcadores, linhas, ajustarKey]);

  return <div ref={el} className="mapa" style={{ height: altura }} />;
}
