-- Cobrança Externa: Realtime e funções do aceite da localização (APLICADOS em 2026-10-17 e conferidos).
-- Decisões: docs/11-banco-de-dados-padrao.md.

-- 1) Realtime do mapa ao vivo (aplicado; respeita a RLS de cada usuário)
-- alter publication supabase_realtime
--   add table public.cob04_rota, public.cob08_checkin, public.cob09_rastreamento;

-- 2) O motoqueiro não altera a própria linha direto: o aceite (LGPD) passa por estas funções.
--    O primeiro aceite fica guardado (coalesce), o consentimento pode ser retirado.
create or replace function public.cob01_aceitar_localizacao()
returns timestamptz
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_em timestamptz;
begin
  update public.cob01_cobrador
     set cob01_consentimento_em = coalesce(cob01_consentimento_em, now())
   where cob01_auth_id = (select auth.uid()) and cob01_ativo
  returning cob01_consentimento_em into v_em;
  if v_em is null then
    raise exception 'Cadastro de motoqueiro não encontrado ou inativo.';
  end if;
  return v_em;
end;
$$;

create or replace function public.cob01_revogar_localizacao()
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.cob01_cobrador
     set cob01_consentimento_em = null
   where cob01_auth_id = (select auth.uid());
end;
$$;

revoke all on function public.cob01_aceitar_localizacao()  from public, anon;
revoke all on function public.cob01_revogar_localizacao()  from public, anon;
grant execute on function public.cob01_aceitar_localizacao() to authenticated;
grant execute on function public.cob01_revogar_localizacao() to authenticated;
