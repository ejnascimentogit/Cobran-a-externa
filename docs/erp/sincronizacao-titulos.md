# Sincronização de títulos com o WinThor (proposta, 2026-10-20)

Requisitos do Edimilson: trazer **toda a base de clientes com título vencido em aberto**; **não trazer de novo** o que já está no Supabase; a cada nova varredura, conferir se os títulos que estavam em aberto **continuam em aberto**; ao ser pago, **preencher a data de pagamento**; e saber se o título pago era **monitorado** (esteve numa rota), para mostrar em relatórios e dashboard que a cobrança por rota deu certo. Só títulos **vencidos** entram.

## Chave do título
`filial + duplicata + prestação` (confirmar no WinThor se `NUMTRANSVENDA + PREST` é mais estável). Única por empresa no Supabase. É ela que impede duplicar.

## Rotina (diária de madrugada; a etapa 3 pode rodar várias vezes ao dia)
1. **Lista leve de chaves:** o ERP devolve só as chaves (e vencimento e valor) de todos os títulos vencidos em aberto.
2. **Só os novos:** o Supabase compara com o que já tem. Para as chaves que **não existem**, busca o detalhe completo (título e cliente: endereço, telefone, coordenadas) e grava como `aberto`. Cliente que já existe é atualizado, não duplicado.
3. **Quem sumiu da lista:** títulos que o Supabase tem como `aberto` e que **não vieram mais** na etapa 1 são consultados por chave no ERP: com data de pagamento → `pago` (grava `data_pagamento` e `valor_pago`); sem pagamento mas fora do aberto (cancelado, desdobrado, renegociado) → `encerrado_sem_pagamento` com o motivo. Nunca apagar.
4. **Quem continua em aberto:** só atualiza `ultima_confirmacao_em` (e os dias de atraso são calculados na tela).

## Título monitorado
É o título que entrou numa parada de rota (visita planejada). Ao marcar o título como `pago`, o sistema confere se há registro de monitoramento: se houver, o pagamento conta para a cobrança por rota.
**Regra de atribuição (a decidir):** pagamento **depois** da visita e em até N dias (sugestão: 7). Pagamento antes da visita não conta.

## Relatórios e dashboard (para mostrar que a rota funcionou)
- Recuperado pela rota: R$ e % do valor monitorado que foi pago no prazo.
- Títulos monitorados: pagos x em aberto x encerrados.
- Por motoqueiro, por regra de dias de atraso, por praça e por motivo do check-in (promessa, pagou no ato etc.).
- Tempo médio da visita ao pagamento.
- **Comparação justa (grupo de controle):** taxa de pagamento dos clientes visitados x de clientes parecidos (mesma faixa de atraso e praça) que não foram visitados. Sem isso o número mostra pagamento, não prova que foi a rota.
- Evolução semanal e total em atraso (aging) da carteira.

## Tabelas (nomes e colunas a decidir juntos antes de criar)
- `int05_titulo_erp`: chave, cliente, vencimento, valor, situação (`aberto`, `pago`, `encerrado_sem_pagamento`), data e valor do pagamento, primeira vez visto, última confirmação.
- `cob07_rota_parada_titulo` e `cob10_titulo_monitorado`: ligam título, parada e visita.
