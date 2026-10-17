const pad = n => String(n).padStart(2, '0');

export const hojeISO = () => {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

// Dias inteiros entre duas datas ISO (AAAA-MM-DD), sem efeito de fuso.
export const diasEntre = (de, ate) => {
  const [a, b] = [de, ate].map(s => Date.UTC(...s.split('-').map((x, i) => (i === 1 ? x - 1 : +x))));
  return Math.round((b - a) / 86400000);
};

export const somaDias = (iso, dias) => {
  const [y, m, d] = iso.split('-').map(Number);
  const t = new Date(Date.UTC(y, m - 1, d + dias));
  return `${t.getUTCFullYear()}-${pad(t.getUTCMonth() + 1)}-${pad(t.getUTCDate())}`;
};

export const brl = n => (n || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
export const dataBR = iso => (iso ? iso.split('-').reverse().join('/') : '—');
export const horaBR = v => (v ? new Date(v).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : '—');

export const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

export const RESULTADO = {
  pendente: { texto: 'Pendente', cor: '#94a3b8' },
  pago_na_visita: { texto: 'Pago na visita', cor: '#16a34a' },
  negociado: { texto: 'Negociado', cor: '#ca8a04' },
  promessa: { texto: 'Promessa de pagamento', cor: '#eab308' },
  nao_atendido: { texto: 'Não atendido', cor: '#ea580c' },
  sem_sucesso: { texto: 'Sem acordo', cor: '#dc2626' },
};

export const STATUS_ROTA = {
  rascunho: 'Rascunho', enviada: 'Enviada', em_andamento: 'Em andamento', finalizada: 'Finalizada',
};
