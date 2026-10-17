// Armazenamento da DEMONSTRAÇÃO (localStorage). O painel e o app do motoqueiro são
// publicados no mesmo site (/ e /motoqueiro/) para compartilharem estes dados e o
// mapa ao vivo funcionar sem backend. Quando o Supabase estiver pronto, este módulo
// e o servico.js são trocados por chamadas ao banco (ver docs/10-front-cloudflare.md).
import { seed } from './dados.js';
import { hojeISO } from './formato.js';

const KEY = 'cobranca_demo_v1';
const ls = typeof localStorage !== 'undefined' ? localStorage : null;
const ouvintes = new Set();

function carregar() {
  try {
    const j = ls?.getItem(KEY);
    if (j) {
      const e = JSON.parse(j);
      if (e.demoData === hojeISO()) return e; // novo dia = dados de teste novos (vencimentos relativos a hoje)
    }
  } catch { /* segue com dados novos */ }
  return seed();
}

let estado = carregar();

function salvar() {
  try { ls?.setItem(KEY, JSON.stringify(estado)); } catch { /* sem armazenamento: segue em memória */ }
}

export const getEstado = () => estado;

export function assinar(fn) {
  ouvintes.add(fn);
  return () => ouvintes.delete(fn);
}

const avisar = () => ouvintes.forEach(f => f());

// Trabalha numa cópia: se fn lançar erro, nada é gravado.
export function mutar(fn) {
  const copia = structuredClone(estado);
  const retorno = fn(copia);
  estado = copia;
  salvar();
  avisar();
  return retorno;
}

export function reiniciarDemo() {
  estado = seed();
  salvar();
  avisar();
}

if (typeof window !== 'undefined') {
  // Outra aba (ex.: o app do motoqueiro) gravou: recarrega.
  window.addEventListener('storage', e => {
    if (e.key === KEY && e.newValue) {
      estado = JSON.parse(e.newValue);
      avisar();
    }
  });
}
