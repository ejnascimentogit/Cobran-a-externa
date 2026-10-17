import { useEffect, useState, useSyncExternalStore } from 'react';
import { assinar, getEstado } from './store.js';

export const useEstado = () => useSyncExternalStore(assinar, getEstado);

// Re-renderiza a cada N ms (relógio, "previsto até agora").
export function useAgora(ms = 30000) {
  const [agora, setAgora] = useState(() => new Date());
  useEffect(() => {
    const t = setInterval(() => setAgora(new Date()), ms);
    return () => clearInterval(t);
  }, [ms]);
  return agora;
}
