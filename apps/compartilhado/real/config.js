// Projeto Supabase da cobrança (EFR_ecommerce_tirapedidos). URL e chave PUBLISHABLE são públicas por
// desenho (a proteção é a RLS das tabelas). Nunca colocar aqui a chave "secret" nem a "service_role".
export const SUPABASE_URL = 'https://xaicysbwwppqdhktchzy.supabase.co';
export const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_87wFWZrdtDN4kJqVggVncw_6sJjgxbX';

// Nome da Edge Function que cria o login do motoqueiro (publicada com nome aleatório, ver docs/11).
export const FUNCAO_CRIAR_COBRADOR = 'clever-endpoint';
