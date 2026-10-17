-- Cobrança Externa: ajustes do banco para o app do motoqueiro funcionar SEM SINAL (A APLICAR).
-- Desenho e decisões: docs/12-modo-offline.md.
-- Regra do app: enviar os eventos UM POR VEZ, na ordem em que aconteceram (início, visitas, fim).
-- Uma inserção de várias linhas de uma vez não enxerga o efeito das linhas anteriores (gatilhos "depois").
-- Reenvio do mesmo evento (mesmo uuid) devolve 23505 e o app trata como "já recebido".

-- 1) Parâmetros novos e colunas da hora do aparelho
alter table public.cob11_config
  add column cob11_prazo_sincronizacao_horas integer not null default 72
    check (cob11_prazo_sincronizacao_horas > 0),
  add column cob11_tolerancia_relogio_min integer not null default 5
    check (cob11_tolerancia_relogio_min >= 0);

alter table public.cob08_checkin
  add column cob08_aparelho_em   timestamptz not null default now(),
  add column cob08_hora_suspeita boolean     not null default false;

alter table public.cob09_rastreamento
  add column cob09_uuid          uuid        not null default gen_random_uuid(),
  add column cob09_aparelho_em   timestamptz not null default now(),
  add column cob09_hora_suspeita boolean     not null default false,
  add constraint cob09_uuid_unico unique (cob09_uuid);

-- 2) Check-in: idempotente, com a hora do aparelho verificada
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
  v_hoje    date;
  v_dist    integer;
begin
  if exists (select 1 from public.cob08_checkin where cob08_uuid = new.cob08_uuid) then
    raise unique_violation using message = 'Evento já recebido.';
  end if;

  select * into v_rota from public.cob04_rota where cob04_id = new.cob08_rota_id;
  select * into v_rc from public.cob05_rota_cobrador
    where cob05_rota_id = new.cob08_rota_id and cob05_cobrador_id = new.cob08_cobrador_id;
  select * into v_cfg from public.cob11_config where cob11_empresa_id = new.cob08_empresa_id;
  if v_cfg.cob11_id is null then
    raise exception 'Parâmetros da cobrança não configurados para a empresa.';
  end if;

  new.cob08_criado_em := now();   -- hora em que o servidor recebeu
  new.cob08_distancia_m := null;
  new.cob08_fora_do_raio := false;

  -- hora do aparelho: no futuro, atrasada além do prazo, antes do dia da rota ou antes do início
  -- da rota => grava marcada como suspeita e usa a hora do servidor
  new.cob08_hora_suspeita := false;
  if new.cob08_aparelho_em > now() + make_interval(mins => v_cfg.cob11_tolerancia_relogio_min)
     or new.cob08_aparelho_em < now() - make_interval(hours => v_cfg.cob11_prazo_sincronizacao_horas)
     or (new.cob08_aparelho_em at time zone 'America/Sao_Paulo')::date < v_rota.cob04_data
     or (new.cob08_tipo <> 'inicio' and v_rc.cob05_inicio_em is not null
         and new.cob08_aparelho_em < v_rc.cob05_inicio_em) then
    new.cob08_hora_suspeita := true;
    new.cob08_aparelho_em := now();
  end if;
  v_hoje := (new.cob08_aparelho_em at time zone 'America/Sao_Paulo')::date;  -- data do evento

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

-- início e fim da rota passam a usar a hora do aparelho (já verificada acima)
create or replace function public.cob08_efeitos_checkin()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.cob08_tipo = 'inicio' then
    update public.cob05_rota_cobrador set cob05_inicio_em = new.cob08_aparelho_em
      where cob05_rota_id = new.cob08_rota_id and cob05_cobrador_id = new.cob08_cobrador_id;
    update public.cob04_rota set cob04_status = 'em_andamento'
      where cob04_id = new.cob08_rota_id and cob04_status = 'enviada';
  elsif new.cob08_tipo = 'finalizacao' then
    update public.cob05_rota_cobrador set cob05_fim_em = new.cob08_aparelho_em
      where cob05_rota_id = new.cob08_rota_id and cob05_cobrador_id = new.cob08_cobrador_id;
    if not exists (select 1 from public.cob05_rota_cobrador
                   where cob05_rota_id = new.cob08_rota_id and cob05_fim_em is null) then
      update public.cob04_rota set cob04_status = 'finalizada' where cob04_id = new.cob08_rota_id;
    end if;
  end if;
  return null;
end;
$$;

-- 3) Rastreamento: hora do aparelho verificada
create or replace function public.cob09_forca_hora()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_cfg public.cob11_config%rowtype;
begin
  select * into v_cfg from public.cob11_config where cob11_empresa_id = new.cob09_empresa_id;
  new.cob09_criado_em := now();
  new.cob09_hora_suspeita := false;
  if new.cob09_aparelho_em > now() + make_interval(mins => coalesce(v_cfg.cob11_tolerancia_relogio_min, 5))
     or new.cob09_aparelho_em < now() - make_interval(hours => coalesce(v_cfg.cob11_prazo_sincronizacao_horas, 72)) then
    new.cob09_hora_suspeita := true;
    new.cob09_aparelho_em := now();
  end if;
  return new;
end;
$$;

-- o ponto só vale se a hora do aparelho está ENTRE o início e o fim da rota do motoqueiro
-- (pontos guardados offline podem chegar depois da finalização)
drop policy cobrador_registra on public.cob09_rastreamento;
create policy cobrador_registra on public.cob09_rastreamento
  for insert
  with check (exists (select 1
                      from public.cob01_cobrador c
                      join public.cob05_rota_cobrador rc on rc.cob05_cobrador_id = c.cob01_id
                      where c.cob01_id = cob09_cobrador_id
                        and rc.cob05_rota_id = cob09_rota_id
                        and c.cob01_auth_id = (select auth.uid())
                        and c.cob01_ativo
                        and c.cob01_consentimento_em is not null
                        and rc.cob05_inicio_em is not null
                        and cob09_aparelho_em >= rc.cob05_inicio_em
                        and (rc.cob05_fim_em is null or cob09_aparelho_em <= rc.cob05_fim_em)));
