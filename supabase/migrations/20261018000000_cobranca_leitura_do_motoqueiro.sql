-- Cobrança Externa: o app do motoqueiro (modo real) precisa LER a lista de motivos e o raio de GPS da
-- própria empresa. O login dele não tem empresa_id no token, então a policy padrão (isolamento_empresa)
-- não deixa. Estas policies liberam só leitura, só para motoqueiro ativo, só da empresa dele. (APLICADO em 2026-10-18 e conferido em pg_policies)

create policy cobrador_le_motivos on public.cob03_motivo
  for select
  using (exists (select 1 from public.cob01_cobrador c
                 where c.cob01_auth_id = (select auth.uid())
                   and c.cob01_ativo
                   and c.cob01_empresa_id = cob03_empresa_id));

create policy cobrador_le_config on public.cob11_config
  for select
  using (exists (select 1 from public.cob01_cobrador c
                 where c.cob01_auth_id = (select auth.uid())
                   and c.cob01_ativo
                   and c.cob01_empresa_id = cob11_empresa_id));
