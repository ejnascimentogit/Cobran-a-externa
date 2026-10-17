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
| Demais (`cob01`, `cob03` a `cob11`, `int05`) | Não criadas. |

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

Faltam: policies no padrão do projeto, gatilho de `cob02_atualizado_em` e a regra de que **faixas ativas de uma empresa não se sobrepõem** (restrição de exclusão com a extensão `btree_gist`, só entra com aprovação).

## Pendências para fechar o padrão

1. Nome da coluna que liga à empresa (`cob02_empresa_id` é suposição) e se `tb04_cliente` e `tb06_pedido` a têm.
2. Tipo real de `tb01_id` (`integer` ou `bigint`, identidade ou sequência).
3. Como `*_atualizado_em` é mantida (gatilho, função pronta).
4. Como é a RLS do projeto (as policies de `tb01_empresa` e `tb02_usuario`) e como o motoqueiro, que grava check-in, entra nela.
5. Devedor: `tb04_cliente` ou tabela nova no grupo `int`.
6. Número e nome das tabelas de cache do ERP.

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
