import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from './cliente.js';

export function useSessao() {
  const [estado, setEstado] = useState({ carregando: true, sessao: null });
  useEffect(() => {
    let vivo = true;
    supabase.auth.getSession()
      .then(({ data }) => vivo && setEstado({ carregando: false, sessao: data.session }))
      .catch(() => vivo && setEstado({ carregando: false, sessao: null }));
    const { data } = supabase.auth.onAuthStateChange((_evento, sessao) => setEstado({ carregando: false, sessao }));
    return () => { vivo = false; data.subscription.unsubscribe(); };
  }, []);
  return estado;
}

// Carrega dados com uma função assíncrona; recarrega a cada `intervaloMs` (se informado) e sob demanda.
export function useCarga(carregar, dependencias = [], intervaloMs = 0) {
  const [estado, setEstado] = useState({ dados: null, erro: '', carregando: true });
  const funcao = useRef(carregar);
  funcao.current = carregar;
  const contador = useRef(0);

  const recarregar = useCallback(async () => {
    const minha = ++contador.current;
    try {
      const dados = await funcao.current();
      if (minha === contador.current) setEstado({ dados, erro: '', carregando: false });
    } catch (x) {
      if (minha === contador.current) setEstado(e => ({ ...e, erro: x.message || String(x), carregando: false }));
    }
  }, []);

  useEffect(() => {
    recarregar();
    if (!intervaloMs) return undefined;
    const t = setInterval(recarregar, intervaloMs);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recarregar, intervaloMs, ...dependencias]);

  return { ...estado, recarregar };
}

// Lê uma consulta do Supabase e lança o erro (com o objeto original) para a tela tratar.
export async function ler(consulta) {
  const { data, error } = await consulta;
  if (error) throw Object.assign(new Error(error.message), { code: error.code });
  return data;
}
