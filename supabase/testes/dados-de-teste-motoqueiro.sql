-- Dados de TESTE para experimentar o app do motoqueiro no modo real (https://.../motoqueiro/?real=1).
-- Rode no SQL Editor, UM BLOCO POR VEZ, trocando EMAIL_DO_LOGIN_DE_TESTE pelo e-mail do login criado em
-- Authentication → Users → Add user (com "Auto Confirm User" marcado e SEM mexer em metadados).
-- Para apagar depois: delete das linhas criadas (rota, paradas, ligação e o cadastro do motoqueiro).

-- 0) conferir antes: precisa existir a empresa 1 e ao menos 2 clientes dela
select (select count(*) from public.tb01_empresa where tb01_id = 1) as empresa_1,
       (select count(*) from public.tb04_cliente where tb04_empresa_id = 1) as clientes_da_empresa_1;

-- A) uma regra de teste (só cria se a empresa ainda não tem nenhuma)
insert into public.cob02_regra (cob02_empresa_id, cob02_nome, cob02_dias_min, cob02_dias_max, cob02_prioridade)
select 1, '3 a 5 dias', 3, 5, 1
where not exists (select 1 from public.cob02_regra where cob02_empresa_id = 1);

-- B) cadastro do motoqueiro de teste, ligado ao login (confira que devolve 1 linha)
insert into public.cob01_cobrador (cob01_empresa_id, cob01_auth_id, cob01_nome, cob01_email, cob01_capacidade)
select 1, u.id, 'Motoqueiro Teste', lower(u.email), 8
from auth.users u
where lower(u.email) = lower('EMAIL_DO_LOGIN_DE_TESTE')
returning cob01_id, cob01_email;

-- C) uma rota ENVIADA para ele, com os 2 primeiros clientes da empresa.
--    As coordenadas abaixo são do centro de São Paulo: troque por pontos perto de onde você vai testar
--    (para testar "dentro do raio") ou deixe assim para testar o aviso de "fora do raio".
with rota as (
  insert into public.cob04_rota (cob04_empresa_id, cob04_regra_id, cob04_praca, cob04_status, cob04_meta_visitas)
  select 1, (select min(cob02_id) from public.cob02_regra where cob02_empresa_id = 1), 'Teste', 'enviada', 2
  returning cob04_id
), ligacao as (
  insert into public.cob05_rota_cobrador (cob05_empresa_id, cob05_rota_id, cob05_cobrador_id, cob05_qtd_clientes)
  select 1, rota.cob04_id, c.cob01_id, 2
  from rota, public.cob01_cobrador c
  where lower(c.cob01_email) = lower('EMAIL_DO_LOGIN_DE_TESTE')
  returning cob05_rota_id, cob05_cobrador_id
)
insert into public.cob06_rota_parada
  (cob06_empresa_id, cob06_rota_id, cob06_cobrador_id, cob06_cliente_id, cob06_ordem, cob06_previsao_chegada,
   cob06_cliente_nome, cob06_cliente_endereco, cob06_cliente_telefone, cob06_latitude, cob06_longitude,
   cob06_valor_total, cob06_qtd_titulos)
select 1, l.cob05_rota_id, l.cob05_cobrador_id, cl.tb04_id, row_number() over (order by cl.tb04_id),
       now() + interval '1 hour', cl.tb04_nome, 'Endereço de teste', null,
       -23.5505 + (row_number() over (order by cl.tb04_id) - 1) * 0.002, -46.6333, 500, 1
from ligacao l,
     (select tb04_id, tb04_nome from public.tb04_cliente where tb04_empresa_id = 1 order by tb04_id limit 2) cl
returning cob06_id, cob06_ordem, cob06_cliente_nome;
