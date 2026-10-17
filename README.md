# Cobrança Externa

Sistema de cobrança presencial de inadimplência por rota. Regras por faixa de atraso selecionam os títulos, o analista distribui os clientes entre motoqueiros, o motoqueiro executa a rota pelo app com check-in em cada cliente, e o analista acompanha tudo em mapa e relatório, inclusive o pagamento nos dias seguintes.

**Objetivo:** aumentar a recuperação de títulos vencidos com cobrança presencial organizada, rastreável e mensurável.

## Documentação

| Documento | Conteúdo |
| --- | --- |
| [Visão geral e atores](docs/01-visao-geral.md) | Problema, objetivo, atores e fluxo ponta a ponta |
| [Requisitos funcionais](docs/02-requisitos-funcionais.md) | Os seis módulos (M1 a M6) |
| [Regras de negócio](docs/03-regras-de-negocio.md) | Regras, status dos títulos e motivos |
| [Arquitetura](docs/04-arquitetura.md) | Componentes, stack e estrutura do repositório |
| [Modelo de dados](docs/05-modelo-de-dados.md) | Tabelas e relações no Supabase |
| [Integração com o ERP](docs/06-integracao-erp.md) | Contrato de dados esperado da integração (responsável: Ryan) |
| [Sugestões e KPIs](docs/07-sugestoes.md) | Melhorias e indicadores |
| [Roadmap](docs/08-roadmap.md) | Fases e critérios de passagem |
| [Pontos em aberto](docs/09-pontos-em-aberto.md) | Decisões pendentes |
| [Front-end e demonstração](docs/10-front-cloudflare.md) | Painel e app do motoqueiro, como rodar e publicar no Cloudflare |
| [Banco de dados e padrão](docs/11-banco-de-dados-padrao.md) | Onde fica o banco, padrão de tabelas e colunas, decisões e pendências |

## Responsáveis

| Frente | Responsável |
| --- | --- |
| Produto, arquitetura e documentação | Edimilson |
| Integração com o ERP (WinThor / Oracle) | Ryan |

## Stack prevista

- **Banco e backend:** Supabase (Postgres, Auth, Realtime, Storage, Edge Functions)
- **Painel do analista:** React + biblioteca de mapas (Leaflet ou Mapbox GL)
- **App do motoqueiro:** React Native com Expo (ou PWA no início)
- **Integração ERP:** serviço Node.js (definido pelo Ryan)
