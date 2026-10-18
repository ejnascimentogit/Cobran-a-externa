# Cobrança Externa — contexto para o Claude

Sistema de cobrança presencial de inadimplência por rota (motoqueiros). A especificação completa está em `docs/`; leia `docs/02-requisitos-funcionais.md` e `docs/05-modelo-de-dados.md` antes de implementar.

## Regras de trabalho

- Idioma: português (código pode usar nomes em português, como no modelo de dados).
- Antes de qualquer mudança que altere um fluxo já existente, perguntar e esperar aprovação.
- A integração com o ERP (WinThor/Oracle) é do Ryan. Não implementar conexão com o ERP; usar dados de teste em `clientes_cache` e `titulos_cache`.
- O ERP é somente leitura: nada neste repositório grava no WinThor.

## Quem é quem (decisão do Edimilson, 2026-10-18)

- A **Cobrança Externa é um produto próprio, que está sendo vendido**. Não é o e-commerce. Os acessos ao painel e ao app da cobrança são **da cobrança**: nunca chamar de "login do e-commerce" nem pedir a "senha do e-commerce".
- Para conversar e documentar, usar "projeto de cobrança". O projeto Supabase `EFR_ecommerce_tirapedidos` só **hospeda** o banco (compartilhado com outros sistemas, por enquanto).
- Os logins `edimilson@efr.com` e `ryan@efr.com` existem no Supabase, mas **não têm senha definida para a cobrança**: cada um define a própria (ver `docs/11`). Senhas nunca vão para o chat, o repositório ou o código.

## Stack

- Supabase (Postgres, Auth, Realtime, Storage, Edge Functions) — migrations em `supabase/migrations/`
- Painel web em `apps/painel/`, app do motoqueiro em `apps/motoqueiro/`

## Estado do front (demonstração)

Painel (`apps/painel/`), app do motoqueiro (`apps/motoqueiro/`) e regras de negócio com testes (`apps/compartilhado/`) existem em modo demonstração, com dados fictícios no `localStorage`; publicam no Cloudflare como um só site (`wrangler.jsonc`, `npm run build`). Detalhes e como trocar pelo Supabase em `docs/10-front-cloudflare.md`. O banco será o projeto Supabase `EFR_ecommerce_tirapedidos`, no padrão de nomes dele (grupo `cob`, colunas com o prefixo da tabela, ex.: `cob02_nome`); detalhes, decisões e pendências em `docs/11-banco-de-dados-padrao.md`. Painel e app do motoqueiro já têm o **modo real** (Supabase) atrás de `?real=1` (docs/12); a demonstração continua sendo a padrão até a validação com o banco real. O ambiente do Claude não acessa esse projeto: o SQL é escrito e mostrado por escrito, e quem aplica é o Edimilson ou o Ryan. Nunca aplicar nada sem "pode aplicar" explícito e nunca em `painel-workspaces`, `admfullcontrolefinanceiro` ou `data-platform`.
