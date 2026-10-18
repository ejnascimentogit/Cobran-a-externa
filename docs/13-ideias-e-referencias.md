# Ideias e referências guardadas

Anotações soltas a pedido do Edimilson. Não são requisitos nem estão no roadmap: ficam aqui para não se perder.

## Google Maps Scraper Kit (guardado em 2026-10-18)

- **Origem:** Reel do Instagram da conta 99hud (print em `docs/referencias/google-maps-scraper-kit-reel.jpg`). Legenda: "Comenta 'LEAD' e eu te passo o caminho…".
- **Repositório citado:** `github.com/Mahanaicoach/google-maps-scraper-kit` (não verificado por nós; o ambiente do Claude não o abriu).
- **O que o Reel diz:** "Run a free Google Maps scraper locally, driven by Claude". Marcadores: Local Docker, Claude skill, Clean leads (leads limpos).
- **Para que serve:** coletar empresas/contatos do Google Maps (prospecção de leads) rodando localmente.
- **Possível uso (sugestão, sem decisão):** prospecção de clientes para vender a Cobrança Externa. Antes de usar, conferir os termos de uso do Google Maps e a LGPD (coleta de dados de contato).
- **Avaliação (2026-10-18, a partir do que o print descreve; o repositório não foi aberto):**
  - **Pode ajudar:** (1) **prospecção para vender a Cobrança Externa**: listar por cidade e ramo distribuidoras, atacadistas e empresas que vendem a prazo (nome, endereço, telefone); (2) **completar cadastro** (endereço, telefone) de empresa cliente quando o ERP vier incompleto, só como apoio de conferência.
  - **Não serve para:** coordenadas dos devedores (para isso, geocodificação por API, como Nominatim/OpenStreetMap, que combina com o Leaflet que já usamos; propor quando o Ryan trouxer os dados do ERP) nem para dados do devedor (quem tem é o ERP).
  - **Cuidados:** raspar o Google Maps costuma violar os termos do Google, então não embutir no produto vendido; telefones e nomes entram na LGPD (registrar a finalidade, B2B por legítimo interesse); rodar em Docker na máquina pessoal, não na da empresa.
  - **Antes de usar:** abrir o repositório e conferir licença e o que ele faz de fato.
- **Status:** só guardado. Nada foi implementado nem testado.
