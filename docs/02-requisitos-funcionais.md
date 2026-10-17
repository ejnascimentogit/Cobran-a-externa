# Requisitos funcionais

São seis módulos, na ordem em que o dia de cobrança acontece.

## M1. Regras de cobrança por faixa de atraso

- Consulta os clientes inadimplentes no sistema de clientes / ERP.
- O analista cadastra faixas de dias em atraso, cada uma gerando sua própria consulta. Exemplo: 3–5 dias, 6–10 dias, 11–20 dias, e assim por diante.
- Cada regra é configurável e pode ser ativada ou desativada.

## M2. Montagem e distribuição da rota

- O resultado das regras é agrupado por rota.
- Ao selecionar uma rota, o sistema traz todos os inadimplentes daquela faixa, exibidos em mapa.
- O sistema informa a quantidade de títulos e o valor total da rota.
- O analista define quantos clientes o motoqueiro vai visitar na rota.
- O analista escolhe a rota e escolhe o motoqueiro (pré-cadastrado).
- Se a rota passar da demanda normal, o analista pode:
  - dividir a rota entre dois motoqueiros;
  - juntar duas rotas próximas em uma nova rota para outro motoqueiro.
- A rota é enviada para o app do motoqueiro.

## M3. App do motoqueiro

- Recebe a rota com a sequência de clientes a visitar.
- Mostra no mapa o trajeto previsto e a previsão, atualizando conforme ele avança.
- Check-in em cada cliente, registrando:
  - se foi atendido ou não;
  - se houve negociação ou não;
  - se o cliente pagou ou não;
  - texto livre com o que foi dito;
  - motivo, a partir da lista pré-cadastrada.
- Check-in de finalização da rota ao terminar e voltar para a empresa.

## M4. Acompanhamento em mapa (analista)

- **Cabeçalho da rota:** quantidade de clientes, valor total em cobrança e quanto cada cliente representa em valor.
- **Mapa ao vivo:** posição do motoqueiro e cada check-in aparecendo no ponto do cliente assim que é feito.
- **Detalhe ao passar o mouse** em cada ponto: quantidade de títulos, valor e demais informações do cliente.

## M5. Relatório em tempo real (abaixo do mapa)

- Atualizado a cada deslocamento e check-in, por cliente, com o que cada motoqueiro informou.
- Totais por motoqueiro: quantidade de títulos, valor total, valores alcançados (recebidos) e valores negociados.
- Resultados separados por motivo pré-cadastrado.
- Visão do previsto (preparado) versus executado ao longo do dia.
- Ao fim da rota, o analista vê todas as cobranças feitas, pelo mapa e pelo relatório.

## M6. Acompanhamento pós-cobrança (aba de títulos monitorados)

- Aba separada com todos os títulos que passaram por tratativa na rota.
- Nos dias seguintes, o sistema confere se foram pagos (baixados) e mostra:
  - títulos monitorados;
  - baixados e não baixados;
  - aguardando (dentro do prazo prometido);
  - prometido, negociado e pago;
  - prometido e não pago.
