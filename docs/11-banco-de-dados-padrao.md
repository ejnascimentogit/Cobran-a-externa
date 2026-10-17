# Banco de dados: onde fica e qual padrão seguir

Registro das decisões de 2026-10-17 sobre o banco da cobrança. **Nada foi aplicado em banco nenhum**; este documento é o combinado entre Edimilson e o time para escrever as migrations.

## Onde fica

- **Decisão (Edimilson):** a cobrança usa o projeto Supabase **`EFR_ecommerce_tirapedidos`** (organização EFR, região `ca-central-1`, plano Free, porte Nano, branch `main` de produção). Na tela do Supabase o nome aparece como "EFR"; confirmar se a grafia correta é EFR ou ERF.
- **Acesso:** o ambiente do Claude **não enxerga** esse projeto (nem o `data-platform` do RH). O conector do Supabase só alcança a organização `admfullcontrolefinanceiro@gmail.com's Org`. O SQL é escrito aqui, revisado por escrito e **rodado por Edimilson ou Ryan** no SQL Editor.
- **Descartados:** `painel-workspaces` (Taskfull), `admfullcontrolefinanceiro` (financeiro e FullCommerce) e o `data-platform` (RH, padrão `tb` sem número). O RH chegou a ser considerado, e seu padrão (`id`, `codigo`, `id_empresa`, `dtcriacao`) ficou só como referência.
- **Risco do plano Free/Nano:** o projeto pausa por inatividade e é pequeno para rastreamento em tempo real. Serve para teste; para produção, avaliar plano pago.

## Padrão do `EFR_ecommerce_tirapedidos`

O padrão **não está documentado em nenhum repositório** (conferidos `rh-supabase`, `full_commerce`, `Task` e este). Foi lido de prints do Table Editor, por isso só os nomes de tabelas e as colunas de `tb01_empresa` são conhecidos.

### Tabelas

- `grupo` + número de dois dígitos + nome no singular, tudo no schema `public`: `tb01_empresa`, `tb04_cliente`, `tb06_pedido`.
- Grupos existentes: `tb` (cadastro e negócio), `int` (integração: `int02_erp`, `int03_servico_padrao`, `int04_servico_personalizado`), `log` (`log01_evento`) e `sup` (suporte: `sup01_chamado`, `sup01_chamado_anexo`).
- Tabelas existentes: `int02_erp`, `int03_servico_padrao`, `int04_servico_personalizado`, `log01_evento`, `sup01_chamado`, `sup01_chamado_anexo`, `tb01_empresa`, `tb02_usuario`, `tb03_produto`, `tb04_cliente`, `tb05_estoque`, `tb06_pedido`, `tb06_pedido_item`, `tb07_plano_pagamento`, `tb08_recorrencia`.
- No banco atual a tabela filha **divide o número da mãe** (`tb06_pedido_item`, `sup01_chamado_anexo`). Na cobrança, a decisão foi usar **um número por tabela** (como no quadro abaixo).
- A cobrança ganha o **grupo novo `cob`**, para ficar separada do e-commerce. Integração com o ERP fica no grupo **`int`**.

### Colunas

Lidas em `tb01_empresa`. **Cada coluna começa com o prefixo da própria tabela**:

| Coluna | Tipo | Papel |
| --- | --- | --- |
| `tb01_id` | inteiro, chave primária | identificador |
| `tb01_uuid` | uuid | identificador técnico |
| `tb01_nome` | text | campo do negócio |
| `tb01_ativo` | boolean | ativo ou inativo |
| `tb01_criado_em` | timestamptz | criação |
| `tb01_atualizado_em` | timestamptz | última alteração |

Na cobrança vale o mesmo: `cob02_id`, `cob02_uuid`, `cob02_nome`, `cob02_ativo`, `cob02_criado_em`, `cob02_atualizado_em`.

## Tabelas da cobrança (nomes propostos)

| Tabela | Conteúdo | Equivale a (docs/05) |
| --- | --- | --- |
| `cob01_cobrador` | motoqueiro | `cobradores` |
| `cob02_regra` | faixa de dias de atraso | `regras_cobranca` |
| `cob03_motivo` | motivos do check-in | `motivos` |
| `cob04_rota` | rota do dia | `rotas` |
| `cob05_rota_cobrador` | motoqueiro de cada rota | `rota_cobradores` |
| `cob06_rota_parada` | clientes a visitar, em ordem | `rota_paradas` |
| `cob07_rota_parada_titulo` | títulos de cada parada | (nova) |
| `cob08_checkin` | visita, início e finalização | `checkins` |
| `cob09_rastreamento` | posição do motoqueiro | `rastreamento` |
| `cob10_titulo_monitorado` | acompanhamento pós-cobrança | `titulos_monitorados` |
| `cob11_config` | raio de GPS, tolerância da promessa e outros | (nova) |
| `int05_titulo_erp` (número a confirmar) | cache dos títulos vindos do ERP | `titulos_cache` |

- **Devedor:** a decisão é reaproveitar `tb04_cliente` se for o mesmo cliente do e-commerce; senão, criar `int06_cliente_erp`. **Em aberto.**
- **Empresa e login:** `tb01_empresa` e `tb02_usuario`.
- **ERP:** `int02_erp` já existe; a carga é do Ryan (ver [integração](06-integracao-erp.md)). O ERP continua somente leitura.

## Estado do banco

| Tabela | Situação |
| --- | --- |
| `cob02_regra` | **Criada em 2026-10-17** por Edimilson no `EFR_ecommerce_tirapedidos`, com o SQL abaixo. **RLS ligada** (`alter table public.cob02_regra enable row level security;`, conferido com `pg_class.relrowsecurity = true`) e **sem policies**, ou seja, fechada para a API pública até as policies serem escritas. |
| `cob02_regra`: faixas sem sobreposição | **Aplicado em 2026-10-17**: extensão `btree_gist` (schema `extensions`) e restrição de exclusão `cob02_faixas_sem_sobreposicao`. Testado: inserir "3 a 5" e depois "4 a 8" na mesma empresa falha com `23P01`, como esperado. |
| `cob02_regra`: isolamento por empresa e gatilho | **Aplicado em 2026-10-17**: `select public.aplicar_isolamento('public.cob02_regra', 'cob02_empresa_id');` (policy `isolamento_empresa`, conferida em `pg_policies`) e gatilho `cob02_regra_atualizado_em` (conferido em `pg_trigger`). **A tabela está pronta.** A conferência de `relforcerowsecurity` ainda não foi enviada, mas a função liga os dois. |
| `cob03_motivo` | **Criada em 2026-10-17** com a receita do projeto: colunas `cob03_id`, `cob03_uuid`, `cob03_empresa_id`, `cob03_nome`, `cob03_tipo` (`pago`, `promessa`, `negociado`, `sem_sucesso`), `cob03_ativo`, `cob03_criado_em`, `cob03_atualizado_em`; nome único por empresa (`cob03_nome_unico`); `aplicar_isolamento` e gatilho `cob03_motivo_atualizado_em`. Conferido: policy `isolamento_empresa`, gatilho e RLS/RLS forçada `true / true`. **Os 8 motivos iniciais** (de `docs/03-regras-de-negocio.md`) foram cadastrados em 2026-10-17 para a empresa `tb01_id = 1` (Comal). |
| `cob01_cobrador` | **Criada e corrigida em 2026-10-17** (opção C, login separado). Colunas: `cob01_id`, `cob01_uuid`, `cob01_empresa_id`, `cob01_auth_id` (único, ligado a `auth.users`, `on delete cascade`), `cob01_nome`, `cob01_email` (formato, minúsculas e único por empresa), `cob01_telefone`, `cob01_veiculo`, `cob01_capacidade` (padrão 8), `cob01_consentimento_em`, `cob01_ativo`, `cob01_criado_em`, `cob01_atualizado_em`. Criada primeiro com `cob01_usuario_id` (ligação a `tb02_usuario`) e ajustada por `alter table` porque estava vazia. Conferido: policies `isolamento_empresa` e `cobrador_le_proprio`, gatilho `cob01_cobrador_atualizado_em`, RLS/RLS forçada `true / true`. Sem linhas. |
| `cob04_rota` | **Criada em 2026-10-17**. Colunas: `cob04_id`, `cob04_uuid`, `cob04_empresa_id`, `cob04_regra_id` (→ `cob02_regra`), `cob04_data` (padrão hoje), `cob04_praca`, `cob04_status` (`rascunho`, `enviada`, `em_andamento`, `finalizada`), `cob04_meta_visitas`, `cob04_analista_id` (→ `tb02_usuario`, opcional), `cob04_criado_em`, `cob04_atualizado_em`. Conferido: policy `isolamento_empresa`, gatilho `cob04_rota_atualizado_em`, RLS/RLS forçada `true / true`. Ainda sem policy para o motoqueiro (entra com a `cob05_rota_cobrador`). Sem linhas. |
| `cob05_rota_cobrador` | **Criada em 2026-10-17**. Colunas: `cob05_id`, `cob05_uuid`, `cob05_empresa_id`, `cob05_rota_id`, `cob05_cobrador_id`, `cob05_qtd_clientes`, `cob05_inicio_em`, `cob05_fim_em` (só com início), `cob05_criado_em`, `cob05_atualizado_em`. Chaves estrangeiras **compostas com a empresa** (`(cob05_rota_id, cob05_empresa_id)` → `cob04_rota` e `(cob05_cobrador_id, cob05_empresa_id)` → `cob01_cobrador`): rota e motoqueiro de empresas diferentes não se ligam. Para isso entraram `cob01_id_empresa_unico` e `cob04_id_empresa_unico`. Único por rota e motoqueiro (`cob05_rota_cobrador_unico`). Policies: `isolamento_empresa` e `cobrador_le_proprio` (o motoqueiro lê só as ligações dele); em `cob04_rota` entrou `cobrador_le_rota` (o motoqueiro lê só as rotas em que aparece). Gatilho `cob05_rota_cobrador_atualizado_em`. RLS/RLS forçada `true / true`. Sem linhas. |
| `cob06_rota_parada` | **Criada em 2026-10-17**. Uma parada por cliente em cada rota, em ordem por motoqueiro. Colunas: `cob06_id`, `cob06_uuid`, `cob06_empresa_id`, `cob06_rota_id`, `cob06_cobrador_id`, `cob06_cliente_id` (→ `tb04_cliente`, FK simples), `cob06_ordem`, `cob06_previsao_chegada`, **cópia do cliente na montagem** (`cob06_cliente_nome`, `cob06_cliente_endereco`, `cob06_cliente_telefone`, `cob06_latitude`, `cob06_longitude`, estas duas juntas ou nenhuma), `cob06_valor_total`, `cob06_qtd_titulos`, datas. FKs compostas: `(rota, empresa)` → `cob04_rota` e `(rota, cobrador)` → `cob05_rota_cobrador`. Únicos: cliente por rota e ordem por rota e motoqueiro. Policies `isolamento_empresa` e `cobrador_le_proprio`; gatilho `cob06_rota_parada_atualizado_em`; RLS/RLS forçada `true / true`. Sem linhas. |
| Demais (`cob07` a `cob11`, `int05`) | Não criadas. |

Regra para toda tabela nova: **ligar a RLS no mesmo momento da criação**. No Supabase, tabela nova em `public` fica aberta à chave publishable até a RLS ser ligada.

## `cob02_regra`: SQL aplicado

```sql
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
```

Restrição aplicada depois (faixas ativas de uma empresa não se sobrepõem):

```sql
create extension if not exists btree_gist with schema extensions;

alter table public.cob02_regra
  add constraint cob02_faixas_sem_sobreposicao
  exclude using gist (
    cob02_empresa_id with =,
    int4range(cob02_dias_min, cob02_dias_max, '[]') with &&
  ) where (cob02_ativo);
```

As policies e o gatilho entram pelo padrão do projeto (seção abaixo).

## `tb02_usuario` (colunas lidas em 2026-10-17)

`tb02_id` (integer), `tb02_empresa_id` (integer), `tb02_codigo` (text, opcional), `tb02_nome`, `tb02_email`, `tb02_ativo` (default `true`), `tb02_criado_em`, `tb02_atualizado_em`, `tb02_auth_id` (uuid, opcional: o usuário do Supabase Auth), `tb02_papel` (text, default `'vendedor'`) e `tb02_codusur` (integer, opcional: provável código do usuário no ERP).

Ainda não se sabe se `tb02_papel` tem restrição de valores (se aceita `'cobrador'`).

## `tb04_cliente` e `int02_erp` (colunas lidas em 2026-10-17)

- **`tb04_cliente`:** `tb04_id`, `tb04_empresa_id`, `tb04_codigo` (integer, provável código do cliente no ERP), `tb04_nome`, `tb04_fantasia`, `tb04_cnpj`, `tb04_plpag` (plano de pagamento), `tb04_cobranca` (text), `tb04_praca` (integer, praça do ERP), `tb04_rca` e `tb04_rca2` (vendedores do ERP), `tb04_bloqueio` (text), `tb04_excluido_em` (date, exclusão lógica), `tb04_sincronizado_em` (not null: o cadastro vem de uma sincronização com o ERP), `tb04_criado_em`, `tb04_atualizado_em`. **Não tem endereço, telefone, latitude nem longitude**, e não tem `tb04_uuid`.
- **`int02_erp`:** conexão com o ERP de cada empresa: `int02_id`, `int02_empresa_id`, `int02_tipo_erp`, `int02_tipo_banco`, `int02_host`, `int02_porta`, `int02_servico`, `int02_tipo_servico`, `int02_usuario`, `int02_senha`, `int02_owner`, `int02_ativo`, `int02_criado_em`, `int02_atualizado_em`.
- **Leitura:** o devedor da cobrança é o `tb04_cliente` (já sincronizado com o ERP; `tb04_praca` responde ao ponto em aberto "as rotas seguem as praças do ERP?"). Faltam endereço, telefone e coordenadas, que dependem da integração (Ryan). O motoqueiro não tem `empresa_id` no token e **não lê `tb04_cliente`**: por isso `cob06_rota_parada` guarda uma cópia dos dados do cliente no momento da montagem da rota, como o "espelho do pedido" do e-commerce.

## Decisão: login do motoqueiro separado do e-commerce (2026-10-17)

- `tb02_papel` só aceita `'empresa_admin'` e `'vendedor'` (restrição `tb02_usuario_tb02_papel_check`); `'cobrador'` exigiria alterar tabela existente.
- As tabelas do e-commerce filtram só por empresa (`isolamento_empresa`): quem tem `empresa_id` no token lê e grava tudo da empresa pela API.
- **Decisão (Edimilson):** o motoqueiro tem **login próprio, fora de `tb02_usuario`**, ligado a `cob01_cobrador.cob01_auth_id`.
  - Ao criar o usuário no Supabase Auth, **não colocar `empresa_id` no `app_metadata`**: sem ele, `empresa_atual()` fica nula e o motoqueiro não alcança nenhuma tabela do e-commerce.
  - O analista usa o login normal da empresa e enxerga tudo da cobrança pela policy `isolamento_empresa`.
  - O motoqueiro lê só o próprio cadastro (`cobrador_le_proprio`). Nas tabelas de rota, parada e check-in ele ganha policies próprias, por `auth.uid()`, criadas junto com cada tabela (ou depois, quando a tabela de ligação existir).
  - O aceite da localização (`cob01_consentimento_em`) será gravado por uma função, não por `update` direto.
  - Quem cria o login do motoqueiro será uma Edge Function (a escrever), com chave de servidor.

## Segurança e gatilho: padrão do projeto

Lido das tabelas `tb01_empresa`, `tb02_usuario`, `tb04_cliente` e das funções do schema `public`.

- **`empresa_atual()`** (integer) decide a empresa:
  - usuário logado: `app_metadata.empresa_id` do token (JWT);
  - papel `agente_N` (integrador, como o ERP): o `N` do nome do papel;
  - `service_role` ou SQL Editor: configuração de sessão `app.empresa_id`.
- **`eh_owner()`**: dono do sistema, pelo claim `role` do token. A policy `owner_total` só existe em `tb01_empresa` e `tb02_usuario`, não nas tabelas de negócio.
- **`aplicar_isolamento(p_tabela regclass, p_coluna text)`**: liga a RLS, liga a **RLS forçada** e cria a policy `isolamento_empresa` (`using` e `with check` com `p_coluna = empresa_atual()`). **Rodar uma vez por tabela**: não apaga policy existente.
- **`conceder_ao_agente(p_tabela regclass)`**: dá `select, insert, update, delete` a todos os papéis `agente_%`. Usar só nas tabelas de **integração** (cache do ERP, do Ryan), não nas tabelas que o painel grava.
- **`tocar_atualizado_em()`**: gatilho `BEFORE UPDATE` que grava `now()` na coluna passada como argumento. Cada tabela tem `<tabela>_atualizado_em`.
- **Coluna da empresa:** `<prefixo>_empresa_id` (ex.: `tb04_empresa_id`, `cob02_empresa_id`).

Receita para tabela nova:

```sql
-- 1) create table ... (colunas no padrão, com <prefixo>_empresa_id)
select public.aplicar_isolamento('public.<tabela>', '<prefixo>_empresa_id');

create trigger <tabela>_atualizado_em
  before update on public.<tabela>
  for each row execute function public.tocar_atualizado_em('<prefixo>_atualizado_em');
```

Para testar no SQL Editor lembre que `empresa_atual()` lê `app.empresa_id` na sessão; o `now()` do gatilho é o horário da transação.

## Pendências para fechar o padrão

1. ~~Coluna da empresa~~ resolvido: `<prefixo>_empresa_id`.
2. Tipo real de `tb01_id` (`integer` ou `bigint`): `cob02_id` foi criada como `integer`; conferir se as chaves do projeto são `integer` antes de criar tabelas que apontam para elas.
3. ~~Gatilho de `_atualizado_em`~~ resolvido: `tocar_atualizado_em`.
4. ~~RLS do projeto e login do motoqueiro~~ resolvido (ver a decisão acima). **Em aberto:** a Edge Function que cria o login do motoqueiro e a função que grava o aceite da localização.
5. Devedor: `tb04_cliente` ou tabela nova no grupo `int`.
6. Número e nome das tabelas de cache do ERP.
7. Prefixo das colunas das tabelas filhas: em `tb06_pedido_item` o gatilho usa `tb06_item_atualizado_em` (prefixo `tb06_item_`). Decidir se `cob05_rota_cobrador` usa `cob05_` (adotado até agora).

Para fechar: prints do Table Editor com as colunas de `tb02_usuario` e `tb04_cliente` e das abas "RLS policies" e "Triggers" de uma delas, ou o resultado da consulta de colunas do `information_schema` (ver abaixo).

```sql
select table_name,
       string_agg(column_name || ' ' || data_type
         || case when is_nullable='NO' then ' not null' else '' end
         || coalesce(' default ' || column_default, ''), E'\n' order by ordinal_position) as colunas
from information_schema.columns
where table_schema='public'
group by table_name
order by table_name;
```

## Como trabalhamos

- Os nomes e as colunas são decididos **junto com o Edimilson**, uma tabela por vez.
- O SQL é mostrado completo por escrito antes de qualquer aplicação; só roda depois de um "pode aplicar" explícito.
- As migrations ficam em `supabase/migrations/` neste repositório, no padrão acima, e cada mudança de banco é registrada aqui.
- O front hoje é demonstração com dados no navegador ([docs/10](10-front-cloudflare.md)); troca para o banco só depois de o schema existir.
