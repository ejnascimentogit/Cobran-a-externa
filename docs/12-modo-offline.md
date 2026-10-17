# Modo offline do app do motoqueiro

Requisito do Edimilson (2026-10-17): em área sem sinal o motoqueiro continua a rota, faz check-in e finalização, e tudo sobe para a nuvem quando a internet voltar. **Este documento é o desenho proposto; nada disto foi aplicado no banco nem implementado ainda.**

## Como vai funcionar

1. **Baixar a rota com sinal.** Ao abrir o app com internet, a rota enviada (paradas, clientes, coordenadas, valores) é copiada para o aparelho (IndexedDB). A parada já é uma cópia completa do cliente (`cob06_*`), então não depende de consultar o banco depois.
2. **App carrega sem sinal.** O service worker guarda os arquivos do app (hoje só guarda o que já foi aberto).
3. **Fila de eventos no aparelho.** Cada ação (início, visita, finalização, pontos de posição) vira um evento com **identificador gerado no aparelho** (uuid) e a **hora do aparelho**. Fica na fila até enviar.
4. **Sincronização.** Quando o sinal volta (ou ao abrir o app), os eventos sobem **em ordem** (início, visitas, finalização). O envio é **idempotente**: reenviar o mesmo evento não duplica (o banco ignora o uuid repetido). O app mostra "N pendentes de envio" e avisa antes de sair da conta com pendências.
5. **Erros de regra na subida** (ex.: motivo desativado entretanto) não apagam o evento: ele fica marcado para o motoqueiro ou o analista resolver.

## O que muda no banco (a propor e aprovar antes de aplicar)

Hoje o banco **força a hora do servidor** e só aceita gravar com a rota em andamento. Offline isso quebra, porque tudo chegaria com a hora do envio.

- `cob08_checkin` e `cob09_rastreamento`: nova coluna com a **hora do aparelho** (`*_aparelho_em`). `*_criado_em` continua sendo a hora do servidor (quando chegou). Relatórios e a linha do tempo usam a hora do aparelho.
- Plausibilidade da hora do aparelho: não pode estar no futuro (tolerância de poucos minutos) nem antes do início do dia da rota; prazo máximo de atraso a definir. O que for suspeito é gravado **marcado para revisão** ou recusado (decisão aberta).
- A validação do check-in (`cob08_validar_checkin`) passa a usar a **data do evento** (não a data do envio) para "data prometida não pode estar no passado", e o estado da rota **na ordem dos eventos**.
- O rastreamento enviado depois da finalização precisa ser aceito se a hora do aparelho está **entre o início e o fim** da rota (hoje a policy exige rota em andamento no momento do envio).
- Envio repetido: o `uuid` das duas tabelas passa a poder vir do aparelho (já é único).

## Limites reais de um PWA (a decidir)

- **GPS em segundo plano:** o navegador **não registra posição com a tela apagada ou o app em segundo plano**. O rastreamento contínuo só funciona com o app aberto e a tela ligada (dá para pedir "manter tela ligada"). Para rastrear de verdade em segundo plano, o caminho é app nativo (Expo).
- **Sincronização em segundo plano:** no iPhone o PWA **não envia sozinho** com o app fechado; sincroniza quando o motoqueiro abre o app. No Android (Chrome) é possível em parte.
- **Mapa sem sinal:** os blocos de mapa (OpenStreetMap) precisam de internet e **a política deles proíbe baixar em massa para uso offline**. Sem sinal o app mostra a **lista de clientes e as coordenadas**; o mapa só aparece nas áreas já vistas. Mapa offline completo exige provedor pago (ex.: Mapbox) ou app nativo com mapa baixado.
- **Sessão:** o login expira se ficar muito tempo offline. Eventos já guardados não se perdem, mas só sobem depois de renovar a sessão com internet. Se o acesso do motoqueiro for desativado enquanto ele está offline, os eventos pendentes não sobem (avisar).

## Decisões (2026-10-17, seguindo as recomendações)

1. **PWA no piloto e app nativo (Expo) na produção.** O piloto aceita as limitações acima (tela ligada para rastrear, sincronizar ao abrir o app no iPhone).
2. **Prazo para sincronizar: 72 horas**, parâmetro `cob11_prazo_sincronizacao_horas` por empresa. Passando disso, o evento é gravado **marcado como suspeito**.
3. **Sem sinal o app mostra a lista de clientes e as coordenadas.** Mapa offline fica para o app nativo ou para um provedor pago, se necessário.
4. **Hora do aparelho incoerente (futuro além da tolerância, passado além do prazo, antes do dia da rota ou antes do início): grava marcada** (`*_hora_suspeita`) e usa a hora do servidor, para não perder a visita por um relógio errado. A tolerância é `cob11_tolerancia_relogio_min` (5 minutos).

## Ajuste do banco (`supabase/migrations/20261017020000_cobranca_modo_offline.sql`, a aplicar)

- `cob11_config`: `cob11_prazo_sincronizacao_horas` (72) e `cob11_tolerancia_relogio_min` (5).
- `cob08_checkin`: `cob08_aparelho_em` (hora do aparelho; `cob08_criado_em` segue sendo a hora em que o servidor recebeu) e `cob08_hora_suspeita`.
- `cob09_rastreamento`: `cob09_uuid` (único, vem do aparelho), `cob09_aparelho_em` e `cob09_hora_suspeita`.
- `cob08_validar_checkin()`: recusa evento repetido com `23505` (o app trata como "já recebido"), confere a hora do aparelho e valida "data prometida não pode estar no passado" pela **data do evento**.
- `cob08_efeitos_checkin()`: início e fim da rota gravam a hora do aparelho.
- `cob09_forca_hora()` e a policy `cobrador_registra` do rastreamento: o ponto vale se a hora do aparelho está entre o início e o fim da rota (pontos offline podem chegar depois da finalização).
- Regra para o app: **enviar um evento por vez, na ordem**, e tratar `23505` como sucesso. Pontos de posição podem ir em lotes, mas se um lote falhar o app reenvia ponto a ponto.

## Ordem de trabalho proposta

1. ~~Decidir~~ decidido (acima).
2. Ajuste do banco (SQL mostrado e aprovado antes, como nas outras tabelas): **escrito, a aplicar**.
3. Ligar o app ao Supabase já com a fila offline e o service worker completo.
4. Testes com o aparelho em modo avião, antes do piloto.
