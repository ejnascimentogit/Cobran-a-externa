# Front-end (Cloudflare) e demonstração

Painel do analista e app do motoqueiro já existem em **modo demonstração**: rodam sem Supabase e sem ERP, com dados fictícios guardados no `localStorage` do navegador. Servem para validar o fluxo e as regras com o time enquanto o banco é definido.

## O que está pronto

| Peça | Onde | Cobre |
| --- | --- | --- |
| Painel do analista (React + Vite + Leaflet) | `apps/painel/` | M1 regras, M2 montagem da rota (um motoqueiro por rota), M4 mapa ao vivo, M5 relatório, M6 títulos monitorados, cadastros |
| App do motoqueiro (PWA, instalável no celular) | `apps/motoqueiro/` | M3: rota do dia, iniciar, check-in por cliente, finalizar, consentimento de localização |
| Regras de negócio e dados de teste | `apps/compartilhado/` | Regras 1 a 7 do [documento de regras](03-regras-de-negocio.md), com 11 testes (`npm test`) |

Fora desta etapa (roadmap): dividir/juntar rotas e ordem otimizada (Fase 2), Pix, foto, modo offline e WhatsApp (Fase 3).

## Como rodar

```bash
npm install
npm run dev:painel       # painel em http://localhost:5173
npm run dev:motoqueiro   # app em http://localhost:5174/motoqueiro/
npm test                 # regras de negócio
npm run build            # gera dist/ (painel em /, app em /motoqueiro/)
```

O painel e o app são publicados **no mesmo site** de propósito: assim dividem o `localStorage` e o mapa ao vivo funciona na demonstração. Abra o painel e o app em duas abas do mesmo navegador.

No app, a posição é **simulada** por padrão (dá para testar no computador, inclusive "longe do cliente" para ver a justificativa obrigatória). Troque para "GPS do aparelho" no próprio app.

## Publicar no Cloudflare (Workers)

O `wrangler.jsonc` da raiz publica a pasta `dist/` como um Worker de arquivos estáticos (`cobranca-externa`).

**Pelo Cloudflare (recomendado, publica a cada push):** Workers & Pages → Create → Import a repository → este repositório.
- Build command: `npm run build`
- Deploy command: `npx wrangler deploy`
- Branch de produção: `main`

**Pela linha de comando:** `npx wrangler login` e `npm run deploy`.

Endereços: painel em `/` e app do motoqueiro em `/motoqueiro/`.

## Trocar a demonstração pelo Supabase

Só dois módulos de `apps/compartilhado/` falam com os dados: `store.js` (leitura, assinatura) e `servico.js` (gravações e regras). As telas usam `useEstado()` e as funções de `servico.js`. Para ligar o banco:

1. Aplicar as migrations (schema, RLS, views do [modelo de dados](05-modelo-de-dados.md)) no projeto Supabase confirmado, seguindo o padrão de nomes de [banco de dados e padrão](11-banco-de-dados-padrao.md) (grupo `cob`, colunas com o prefixo da tabela).
2. Reescrever `store.js` para carregar as tabelas e assinar o Realtime (`checkins`, `rastreamento`, `rotas`) e `servico.js` para gravar via Supabase. As regras 3, 4, 5 e 7 devem ir também para o banco (triggers/RLS): o front só avisa, o banco garante.
3. Trocar a escolha de motoqueiro por login (Supabase Auth, perfis `analista`, `cobrador`, `gestor`) e hospedar painel e app em origens separadas, se quiser.
4. `clientes_cache` e `titulos_cache` vêm da integração do ERP (Ryan); `simularBaixa` e os dados de `dados.js` saem.

URL e chave **publishable/anon** do Supabase podem ir no front (variáveis `VITE_*`); nunca `service_role`.

## Diferenças em relação ao modelo de dados

A demonstração precisou de três coisas que o [modelo de dados](05-modelo-de-dados.md) não descreve e que devem entrar nas migrations:

- **`rota_parada_titulos`** (parada, título, cliente): liga cada parada aos seus títulos. Sem ela não dá a regra 3 (título em outra rota aberta) nem criar `titulos_monitorados`.
- **`checkins.resultado`** (pago na visita, negociado, promessa, não atendido, sem acordo): derivado dos campos atendido/pagou/negociou/data prometida.
- **`checkins.distancia_m` e `checkins.fora_do_raio`** e **parâmetros** (raio de GPS, tolerância da promessa, minutos por visita, localização da empresa): numa tabela de configuração.
- **`dias_em_atraso`** é calculado na consulta (data de hoje menos o vencimento), não guardado.

## Decisões provisórias (pontos em aberto, ver [09](09-pontos-em-aberto.md))

- Mapa: OpenStreetMap/Leaflet, sem chave e sem custo. Trocar por Google Maps ou Mapbox só muda o componente `Mapa.jsx`.
- Raio de GPS 200 m, tolerância da promessa 2 dias **corridos** (dias úteis pedem calendário de feriados), 8 visitas por dia: tudo editável em Cadastros.
- App como PWA (pode virar app nativo depois).
- Check-in com motivo incoerente (ex.: "Pagou no ato" sem marcar que pagou) é recusado.
