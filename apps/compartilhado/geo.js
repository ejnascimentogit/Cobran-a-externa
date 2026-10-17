export function distanciaM(a, b) {
  const R = 6371000, rad = x => (x * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat), dLng = rad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

// Ordem sugerida de visita: sempre o ponto mais próximo do anterior, saindo da empresa.
// (A ordem otimizada de verdade é da Fase 2.)
export function ordenarVizinho(origem, pontos) {
  const restantes = [...pontos], ordem = [];
  let atual = origem;
  while (restantes.length) {
    let melhor = 0;
    restantes.forEach((p, i) => {
      if (distanciaM(atual, p) < distanciaM(atual, restantes[melhor])) melhor = i;
    });
    atual = restantes.splice(melhor, 1)[0];
    ordem.push(atual);
  }
  return ordem;
}
