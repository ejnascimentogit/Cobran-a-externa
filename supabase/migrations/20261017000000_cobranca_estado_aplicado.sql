-- Cobrança Externa: estado FINAL do que foi aplicado no projeto EFR_ecommerce_tirapedidos em 2026-10-17.
--
-- ATENÇÃO: este arquivo é o REGISTRO do que já está no banco, na ordem certa de dependência.
-- NÃO rode no banco de produção: as tabelas já existem e os comandos dariam erro de duplicado.
-- Serve para recriar o banco do zero (ex.: um projeto novo) e para o histórico no git.
-- O caminho real foi mais longo (a cob01 nasceu com cob01_usuario_id e foi corrigida por alter table);
-- aqui está só o resultado final. Pré-requisitos do projeto: tb01_empresa, funções empresa_atual(),
-- aplicar_isolamento() e tocar_atualizado_em() (padrão do EFR_ecommerce_tirapedidos).
-- Decisões e padrão: docs/11-banco-de-dados-padrao.md.

create extension if not exists btree_gist with schema extensions;

-- cob02_regra: faixas de dias de atraso (ativas da mesma empresa não se sobrepõem)
create table public.cob02_regra (
  cob02_id            integer generated always as identity primary key,
  cob02_uuid          uuid        not null default gen_random_uuid() unique,
  cob02_empresa_id    integer     not null references public.tb01_empresa (tb01_id),
  cob02_nome          text        not null,
  cob02_dias_min      integer     not null check (cob02_dias_min >= 0),
  cob02_dias_max      integer     not null,
  cob02_prioridade    integer     not null default 1,
  cob02_ativo         boolean     not null default true,
  cob02_criado_em     timestamptz not null default now(),
  cob02_atualizado_em timestamptz not null default now(),
  constraint cob02_faixa_valida check (cob02_dias_min <= cob02_dias_max)
);
alter table public.cob02_regra
  add constraint cob02_faixas_sem_sobreposicao
  exclude using gist (
    cob02_empresa_id with =,
    int4range(cob02_dias_min, cob02_dias_max, '[]') with &&
  ) where (cob02_ativo);
select public.aplicar_isolamento('public.cob02_regra', 'cob02_empresa_id');
create trigger cob02_regra_atualizado_em
  before update on public.cob02_regra
  for each row execute function public.tocar_atualizado_em('cob02_atualizado_em');

-- cob03_motivo: motivos do check-in
create table public.cob03_motivo (
  cob03_id            integer generated always as identity primary key,
  cob03_uuid          uuid        not null default gen_random_uuid() unique,
  cob03_empresa_id    integer     not null references public.tb01_empresa (tb01_id),
  cob03_nome          text        not null,
  cob03_tipo          text        not null
                        check (cob03_tipo in ('pago','promessa','negociado','sem_sucesso')),
  cob03_ativo         boolean     not null default true,
  cob03_criado_em     timestamptz not null default now(),
  cob03_atualizado_em timestamptz not null default now(),
  constraint cob03_nome_unico unique (cob03_empresa_id, cob03_nome)
);
select public.aplicar_isolamento('public.cob03_motivo', 'cob03_empresa_id');
create trigger cob03_motivo_atualizado_em
  before update on public.cob03_motivo
  for each row execute function public.tocar_atualizado_em('cob03_atualizado_em');
alter table public.cob03_motivo
  add constraint cob03_id_empresa_unico unique (cob03_id, cob03_empresa_id);

-- cob01_cobrador: motoqueiro, com login próprio (fora de tb02_usuario, sem empresa_id no token)
create table public.cob01_cobrador (
  cob01_id               integer generated always as identity primary key,
  cob01_uuid             uuid        not null default gen_random_uuid() unique,
  cob01_empresa_id       integer     not null references public.tb01_empresa (tb01_id),
  cob01_telefone         text,
  cob01_veiculo          text,
  cob01_capacidade       integer     not null default 8 check (cob01_capacidade > 0),
  cob01_consentimento_em timestamptz,
  cob01_ativo            boolean     not null default true,
  cob01_criado_em        timestamptz not null default now(),
  cob01_atualizado_em    timestamptz not null default now(),
  cob01_auth_id          uuid        not null unique references auth.users (id) on delete cascade,
  cob01_nome             text        not null,
  cob01_email            text        not null,
  constraint cob01_email_formato     check (cob01_email ~~ '%_@_%.__%'),
  constraint cob01_email_normalizado check (cob01_email = btrim(lower(cob01_email))),
  constraint cob01_email_unico       unique (cob01_empresa_id, cob01_email),
  constraint cob01_id_empresa_unico  unique (cob01_id, cob01_empresa_id)
);
select public.aplicar_isolamento('public.cob01_cobrador', 'cob01_empresa_id');
create trigger cob01_cobrador_atualizado_em
  before update on public.cob01_cobrador
  for each row execute function public.tocar_atualizado_em('cob01_atualizado_em');
create policy cobrador_le_proprio on public.cob01_cobrador
  for select
  using (cob01_auth_id = (select auth.uid()));

-- cob04_rota
create table public.cob04_rota (
  cob04_id            integer generated always as identity primary key,
  cob04_uuid          uuid        not null default gen_random_uuid() unique,
  cob04_empresa_id    integer     not null references public.tb01_empresa (tb01_id),
  cob04_regra_id      integer     not null references public.cob02_regra (cob02_id),
  cob04_data          date        not null default current_date,
  cob04_praca         text,
  cob04_status        text        not null default 'rascunho'
                        check (cob04_status in ('rascunho','enviada','em_andamento','finalizada')),
  cob04_meta_visitas  integer     not null default 0 check (cob04_meta_visitas >= 0),
  cob04_analista_id   integer     references public.tb02_usuario (tb02_id),
  cob04_criado_em     timestamptz not null default now(),
  cob04_atualizado_em timestamptz not null default now(),
  constraint cob04_id_empresa_unico unique (cob04_id, cob04_empresa_id)
);
select public.aplicar_isolamento('public.cob04_rota', 'cob04_empresa_id');
create trigger cob04_rota_atualizado_em
  before update on public.cob04_rota
  for each row execute function public.tocar_atualizado_em('cob04_atualizado_em');

-- cob05_rota_cobrador (+ policies do motoqueiro, incluindo a leitura da rota em cob04_rota)
create table public.cob05_rota_cobrador (
  cob05_id            integer generated always as identity primary key,
  cob05_uuid          uuid        not null default gen_random_uuid() unique,
  cob05_empresa_id    integer     not null references public.tb01_empresa (tb01_id),
  cob05_rota_id       integer     not null,
  cob05_cobrador_id   integer     not null,
  cob05_qtd_clientes  integer     not null default 0 check (cob05_qtd_clientes >= 0),
  cob05_inicio_em     timestamptz,
  cob05_fim_em        timestamptz,
  cob05_criado_em     timestamptz not null default now(),
  cob05_atualizado_em timestamptz not null default now(),
  constraint cob05_rota_fk foreign key (cob05_rota_id, cob05_empresa_id)
    references public.cob04_rota (cob04_id, cob04_empresa_id),
  constraint cob05_cobrador_fk foreign key (cob05_cobrador_id, cob05_empresa_id)
    references public.cob01_cobrador (cob01_id, cob01_empresa_id),
  constraint cob05_rota_cobrador_unico unique (cob05_rota_id, cob05_cobrador_id),
  constraint cob05_periodo_valido check (
    cob05_fim_em is null or (cob05_inicio_em is not null and cob05_fim_em >= cob05_inicio_em))
);
select public.aplicar_isolamento('public.cob05_rota_cobrador', 'cob05_empresa_id');
create trigger cob05_rota_cobrador_atualizado_em
  before update on public.cob05_rota_cobrador
  for each row execute function public.tocar_atualizado_em('cob05_atualizado_em');
create policy cobrador_le_proprio on public.cob05_rota_cobrador
  for select
  using (exists (select 1 from public.cob01_cobrador c
                 where c.cob01_id = cob05_cobrador_id
                   and c.cob01_auth_id = (select auth.uid())));
create policy cobrador_le_rota on public.cob04_rota
  for select
  using (exists (select 1 from public.cob05_rota_cobrador rc
                 where rc.cob05_rota_id = cob04_id));

-- cob06_rota_parada: cópia do cliente na montagem (o motoqueiro não lê tb04_cliente)
create table public.cob06_rota_parada (
  cob06_id                integer generated always as identity primary key,
  cob06_uuid              uuid        not null default gen_random_uuid() unique,
  cob06_empresa_id        integer     not null references public.tb01_empresa (tb01_id),
  cob06_rota_id           integer     not null,
  cob06_cobrador_id       integer     not null,
  cob06_cliente_id        integer     not null references public.tb04_cliente (tb04_id),
  cob06_ordem             integer     not null check (cob06_ordem > 0),
  cob06_previsao_chegada  timestamptz,
  cob06_cliente_nome      text        not null,
  cob06_cliente_endereco  text,
  cob06_cliente_telefone  text,
  cob06_latitude          numeric(9,6),
  cob06_longitude         numeric(9,6),
  cob06_valor_total       numeric(14,2) not null default 0 check (cob06_valor_total >= 0),
  cob06_qtd_titulos       integer     not null default 0 check (cob06_qtd_titulos >= 0),
  cob06_criado_em         timestamptz not null default now(),
  cob06_atualizado_em     timestamptz not null default now(),
  constraint cob06_rota_fk foreign key (cob06_rota_id, cob06_empresa_id)
    references public.cob04_rota (cob04_id, cob04_empresa_id),
  constraint cob06_rota_cobrador_fk foreign key (cob06_rota_id, cob06_cobrador_id)
    references public.cob05_rota_cobrador (cob05_rota_id, cob05_cobrador_id),
  constraint cob06_cliente_unico unique (cob06_rota_id, cob06_cliente_id),
  constraint cob06_ordem_unica unique (cob06_rota_id, cob06_cobrador_id, cob06_ordem),
  constraint cob06_lat_valida check (cob06_latitude  between -90  and 90),
  constraint cob06_lng_valida check (cob06_longitude between -180 and 180),
  constraint cob06_coord_par  check ((cob06_latitude is null) = (cob06_longitude is null))
);
select public.aplicar_isolamento('public.cob06_rota_parada', 'cob06_empresa_id');
create trigger cob06_rota_parada_atualizado_em
  before update on public.cob06_rota_parada
  for each row execute function public.tocar_atualizado_em('cob06_atualizado_em');
create policy cobrador_le_proprio on public.cob06_rota_parada
  for select
  using (exists (select 1 from public.cob01_cobrador c
                 where c.cob01_id = cob06_cobrador_id
                   and c.cob01_auth_id = (select auth.uid())));
alter table public.cob06_rota_parada
  add constraint cob06_id_rota_cobrador_unico unique (cob06_id, cob06_rota_id, cob06_cobrador_id);

-- cob11_config: parâmetros por empresa (uma linha por empresa)
create table public.cob11_config (
  cob11_id                       integer generated always as identity primary key,
  cob11_uuid                     uuid        not null default gen_random_uuid() unique,
  cob11_empresa_id               integer     not null unique references public.tb01_empresa (tb01_id),
  cob11_raio_gps_m               integer     not null default 200 check (cob11_raio_gps_m > 0),
  cob11_tolerancia_promessa_dias integer     not null default 2 check (cob11_tolerancia_promessa_dias >= 0),
  cob11_minutos_por_visita       integer     not null default 15 check (cob11_minutos_por_visita > 0),
  cob11_velocidade_km_h          integer     not null default 25 check (cob11_velocidade_km_h > 0),
  cob11_inicio_rota              time        not null default '08:00',
  cob11_deposito_nome            text,
  cob11_deposito_latitude        numeric(9,6),
  cob11_deposito_longitude       numeric(9,6),
  cob11_criado_em                timestamptz not null default now(),
  cob11_atualizado_em            timestamptz not null default now(),
  constraint cob11_deposito_lat check (cob11_deposito_latitude  between -90  and 90),
  constraint cob11_deposito_lng check (cob11_deposito_longitude between -180 and 180),
  constraint cob11_deposito_par check ((cob11_deposito_latitude is null) = (cob11_deposito_longitude is null))
);
select public.aplicar_isolamento('public.cob11_config', 'cob11_empresa_id');
create trigger cob11_config_atualizado_em
  before update on public.cob11_config
  for each row execute function public.tocar_atualizado_em('cob11_atualizado_em');

-- cob08_checkin: tabela (parte A)
create table public.cob08_checkin (
  cob08_id              integer generated always as identity primary key,
  cob08_uuid            uuid        not null default gen_random_uuid() unique,
  cob08_empresa_id      integer     not null references public.tb01_empresa (tb01_id),
  cob08_rota_id         integer     not null,
  cob08_cobrador_id     integer     not null,
  cob08_parada_id       integer,
  cob08_tipo            text        not null check (cob08_tipo in ('visita','inicio','finalizacao')),
  cob08_latitude        numeric(9,6) not null check (cob08_latitude  between -90  and 90),
  cob08_longitude       numeric(9,6) not null check (cob08_longitude between -180 and 180),
  cob08_atendido        boolean,
  cob08_negociou        boolean     not null default false,
  cob08_pagou           boolean     not null default false,
  cob08_valor_recebido  numeric(14,2) not null default 0 check (cob08_valor_recebido  >= 0),
  cob08_valor_negociado numeric(14,2) not null default 0 check (cob08_valor_negociado >= 0),
  cob08_data_prometida  date,
  cob08_motivo_id       integer,
  cob08_observacao      text,
  cob08_distancia_m     integer,
  cob08_fora_do_raio    boolean     not null default false,
  cob08_resultado       text generated always as (
    case
      when cob08_tipo <> 'visita'  then null
      when not cob08_atendido      then 'nao_atendido'
      when cob08_pagou             then 'pago_na_visita'
      when cob08_negociou          then 'negociado'
      when cob08_data_prometida is not null then 'promessa'
      else 'sem_sucesso'
    end) stored,
  cob08_criado_em       timestamptz not null default now(),
  cob08_atualizado_em   timestamptz not null default now(),
  constraint cob08_rota_empresa_fk foreign key (cob08_rota_id, cob08_empresa_id)
    references public.cob04_rota (cob04_id, cob04_empresa_id),
  constraint cob08_rota_cobrador_fk foreign key (cob08_rota_id, cob08_cobrador_id)
    references public.cob05_rota_cobrador (cob05_rota_id, cob05_cobrador_id),
  constraint cob08_parada_fk foreign key (cob08_parada_id, cob08_rota_id, cob08_cobrador_id)
    references public.cob06_rota_parada (cob06_id, cob06_rota_id, cob06_cobrador_id),
  constraint cob08_motivo_fk foreign key (cob08_motivo_id, cob08_empresa_id)
    references public.cob03_motivo (cob03_id, cob03_empresa_id),
  constraint cob08_visita_completa check (
    cob08_tipo <> 'visita'
    or (cob08_parada_id is not null and cob08_atendido is not null and cob08_motivo_id is not null)),
  constraint cob08_so_visita_tem_parada check (cob08_tipo = 'visita' or cob08_parada_id is null),
  constraint cob08_nao_atendido_sem_acordo check (
    cob08_atendido is not false
    or (not cob08_negociou and not cob08_pagou and cob08_data_prometida is null)),
  constraint cob08_pagou_valor check (
    (cob08_pagou and cob08_valor_recebido > 0) or (not cob08_pagou and cob08_valor_recebido = 0)),
  constraint cob08_negociou_valor check (
    (cob08_negociou and cob08_valor_negociado > 0 and cob08_data_prometida is not null)
    or (not cob08_negociou and cob08_valor_negociado = 0)),
  constraint cob08_fora_justificado check (
    not cob08_fora_do_raio or length(btrim(coalesce(cob08_observacao, ''))) > 0)
);
create unique index cob08_visita_unica on public.cob08_checkin (cob08_parada_id)
  where cob08_tipo = 'visita';
create unique index cob08_inicio_fim_unico on public.cob08_checkin (cob08_rota_id, cob08_cobrador_id, cob08_tipo)
  where cob08_tipo in ('inicio','finalizacao');
select public.aplicar_isolamento('public.cob08_checkin', 'cob08_empresa_id');
create trigger cob08_checkin_atualizado_em
  before update on public.cob08_checkin
  for each row execute function public.tocar_atualizado_em('cob08_atualizado_em');
create policy cobrador_le_proprio on public.cob08_checkin
  for select
  using (exists (select 1 from public.cob01_cobrador c
                 where c.cob01_id = cob08_cobrador_id
                   and c.cob01_auth_id = (select auth.uid())));

-- cob08_checkin: parte B (validação no servidor, efeitos na rota e policy de gravação do motoqueiro)
create or replace function public.cob08_validar_checkin()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_rota    public.cob04_rota%rowtype;
  v_rc      public.cob05_rota_cobrador%rowtype;
  v_cfg     public.cob11_config%rowtype;
  v_parada  public.cob06_rota_parada%rowtype;
  v_motivo  public.cob03_motivo%rowtype;
  v_hoje    date := (now() at time zone 'America/Sao_Paulo')::date;
  v_dist    integer;
begin
  select * into v_rota from public.cob04_rota where cob04_id = new.cob08_rota_id;
  select * into v_rc from public.cob05_rota_cobrador
    where cob05_rota_id = new.cob08_rota_id and cob05_cobrador_id = new.cob08_cobrador_id;
  select * into v_cfg from public.cob11_config where cob11_empresa_id = new.cob08_empresa_id;
  if v_cfg.cob11_id is null then
    raise exception 'Parâmetros da cobrança não configurados para a empresa.';
  end if;

  new.cob08_criado_em := now();
  new.cob08_distancia_m := null;
  new.cob08_fora_do_raio := false;

  if new.cob08_tipo = 'inicio' then
    if v_rota.cob04_status not in ('enviada', 'em_andamento') then
      raise exception 'A rota ainda não foi enviada pelo analista.';
    end if;
    return new;
  end if;

  if v_rota.cob04_status <> 'em_andamento' or v_rc.cob05_inicio_em is null then
    raise exception 'Inicie a rota antes de registrar.';
  end if;
  if v_rc.cob05_fim_em is not null then
    raise exception 'Esta rota já foi finalizada por você.';
  end if;
  if new.cob08_tipo = 'finalizacao' then
    return new;
  end if;

  -- visita
  select * into v_parada from public.cob06_rota_parada where cob06_id = new.cob08_parada_id;
  select * into v_motivo from public.cob03_motivo
    where cob03_id = new.cob08_motivo_id and cob03_ativo;
  if v_motivo.cob03_id is null then
    raise exception 'Escolha um motivo ativo.';
  end if;

  if v_parada.cob06_latitude is null then
    new.cob08_fora_do_raio := true;  -- sem coordenada do cliente não dá para conferir: exige justificativa
  else
    v_dist := round(2 * 6371000 * asin(least(1.0::float8, sqrt(
        power(sin(radians(new.cob08_latitude - v_parada.cob06_latitude) / 2), 2)
      + cos(radians(v_parada.cob06_latitude)) * cos(radians(new.cob08_latitude))
        * power(sin(radians(new.cob08_longitude - v_parada.cob06_longitude) / 2), 2)))))::integer;
    new.cob08_distancia_m := v_dist;
    new.cob08_fora_do_raio := v_dist > v_cfg.cob11_raio_gps_m;
  end if;
  if new.cob08_fora_do_raio and length(btrim(coalesce(new.cob08_observacao, ''))) = 0 then
    raise exception 'Você está fora do raio de % m do cliente. Escreva a justificativa nas observações.',
      v_cfg.cob11_raio_gps_m;
  end if;

  if v_motivo.cob03_tipo = 'pago' and not new.cob08_pagou then
    raise exception 'O motivo "%" exige marcar que o cliente pagou.', v_motivo.cob03_nome;
  end if;
  if v_motivo.cob03_tipo = 'negociado' and not new.cob08_negociou then
    raise exception 'O motivo "%" exige marcar que houve negociação.', v_motivo.cob03_nome;
  end if;
  if v_motivo.cob03_tipo = 'promessa' and new.cob08_data_prometida is null then
    raise exception 'A promessa exige a data prometida.';
  end if;
  if not new.cob08_atendido and v_motivo.cob03_tipo in ('pago', 'negociado', 'promessa') then
    raise exception 'Cliente não atendido: escolha um motivo sem acordo.';
  end if;
  if new.cob08_data_prometida is not null and new.cob08_data_prometida < v_hoje then
    raise exception 'A data prometida não pode estar no passado.';
  end if;
  if new.cob08_pagou and new.cob08_valor_recebido > v_parada.cob06_valor_total then
    raise exception 'O valor recebido passa do total do cliente.';
  end if;
  return new;
end;
$$;

create trigger cob08_checkin_validar
  before insert on public.cob08_checkin
  for each row execute function public.cob08_validar_checkin();

create or replace function public.cob08_efeitos_checkin()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.cob08_tipo = 'inicio' then
    update public.cob05_rota_cobrador set cob05_inicio_em = new.cob08_criado_em
      where cob05_rota_id = new.cob08_rota_id and cob05_cobrador_id = new.cob08_cobrador_id;
    update public.cob04_rota set cob04_status = 'em_andamento'
      where cob04_id = new.cob08_rota_id and cob04_status = 'enviada';
  elsif new.cob08_tipo = 'finalizacao' then
    update public.cob05_rota_cobrador set cob05_fim_em = new.cob08_criado_em
      where cob05_rota_id = new.cob08_rota_id and cob05_cobrador_id = new.cob08_cobrador_id;
    if not exists (select 1 from public.cob05_rota_cobrador
                   where cob05_rota_id = new.cob08_rota_id and cob05_fim_em is null) then
      update public.cob04_rota set cob04_status = 'finalizada' where cob04_id = new.cob08_rota_id;
    end if;
  end if;
  return null;
end;
$$;

create trigger cob08_checkin_efeitos
  after insert on public.cob08_checkin
  for each row execute function public.cob08_efeitos_checkin();

create policy cobrador_registra on public.cob08_checkin
  for insert
  with check (exists (select 1 from public.cob01_cobrador c
                      where c.cob01_id = cob08_cobrador_id
                        and c.cob01_auth_id = (select auth.uid())
                        and c.cob01_ativo
                        and c.cob01_consentimento_em is not null));

-- cob09_rastreamento: pontos do motoqueiro durante a rota
create table public.cob09_rastreamento (
  cob09_id            bigint      generated always as identity primary key,
  cob09_empresa_id    integer     not null references public.tb01_empresa (tb01_id),
  cob09_rota_id       integer     not null,
  cob09_cobrador_id   integer     not null,
  cob09_latitude      numeric(9,6) not null check (cob09_latitude  between -90  and 90),
  cob09_longitude     numeric(9,6) not null check (cob09_longitude between -180 and 180),
  cob09_precisao_m    integer     check (cob09_precisao_m >= 0),
  cob09_criado_em     timestamptz not null default now(),
  constraint cob09_rota_empresa_fk foreign key (cob09_rota_id, cob09_empresa_id)
    references public.cob04_rota (cob04_id, cob04_empresa_id),
  constraint cob09_rota_cobrador_fk foreign key (cob09_rota_id, cob09_cobrador_id)
    references public.cob05_rota_cobrador (cob05_rota_id, cob05_cobrador_id)
);
create index cob09_trilha_idx on public.cob09_rastreamento (cob09_rota_id, cob09_cobrador_id, cob09_criado_em);

create function public.cob09_forca_hora()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.cob09_criado_em := now();
  return new;
end;
$$;

create trigger cob09_rastreamento_hora
  before insert on public.cob09_rastreamento
  for each row execute function public.cob09_forca_hora();

select public.aplicar_isolamento('public.cob09_rastreamento', 'cob09_empresa_id');

create policy cobrador_le_proprio on public.cob09_rastreamento
  for select
  using (exists (select 1 from public.cob01_cobrador c
                 where c.cob01_id = cob09_cobrador_id
                   and c.cob01_auth_id = (select auth.uid())));

create policy cobrador_registra on public.cob09_rastreamento
  for insert
  with check (exists (select 1
                      from public.cob01_cobrador c
                      join public.cob05_rota_cobrador rc on rc.cob05_cobrador_id = c.cob01_id
                      join public.cob04_rota r on r.cob04_id = rc.cob05_rota_id
                      where c.cob01_id = cob09_cobrador_id
                        and rc.cob05_rota_id = cob09_rota_id
                        and c.cob01_auth_id = (select auth.uid())
                        and c.cob01_ativo
                        and c.cob01_consentimento_em is not null
                        and rc.cob05_inicio_em is not null
                        and rc.cob05_fim_em is null
                        and r.cob04_status = 'em_andamento'));

-- Dados iniciais aplicados (empresa 1): linha de cob11_config com os valores padrão e os 8 motivos de docs/03.
-- insert into public.cob11_config (cob11_empresa_id) values (1);
-- insert into public.cob03_motivo (cob03_empresa_id, cob03_nome, cob03_tipo) values
--   (1,'Pagou no ato','pago'), (1,'Prometeu pagar','promessa'), (1,'Negociou parcelamento','negociado'),
--   (1,'Cliente ausente / estabelecimento fechado','sem_sucesso'), (1,'Recusou pagar','sem_sucesso'),
--   (1,'Contesta o débito','sem_sucesso'), (1,'Endereço não localizado','sem_sucesso'),
--   (1,'Dificuldade financeira','sem_sucesso');
