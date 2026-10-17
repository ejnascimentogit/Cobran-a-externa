# Roadmap

A Fase 1 já resolve o dia de cobrança de ponta a ponta com rota manual; cada fase seguinte só começa quando o critério de passagem é atingido num piloto com uma rota real.

| Fase | Entregas | Critério para passar |
| --- | --- | --- |
| 1 · MVP | Regras por faixa; rota e motoqueiro; app com check-in; mapa ao vivo; relatório do dia | Piloto validado com uma rota real |
| 2 · Escala | Dividir e juntar rotas; ordem otimizada; títulos monitorados; conferência automática de baixas | Baixas conferidas corretamente contra o ERP |
| 3 · Recebimento | Aviso por WhatsApp; Pix no app; foto e GPS validado; modo offline | Pix homologado |
| 4 · Gestão | Painel por cobrador; mapa de calor; comissão; KPIs de recuperação | — |

## Fase 1 em tarefas

- [ ] Schema inicial no Supabase (migrations) com RLS
- [ ] Carga de dados de teste em `clientes_cache` e `titulos_cache` enquanto a integração não fica pronta
- [ ] Cadastros: cobradores, regras, motivos
- [ ] Tela de carteira por regra e montagem de rota no mapa
- [ ] App: login, rota do dia, check-in, finalização
- [ ] Painel: mapa ao vivo, cabeçalho da rota, relatório por cliente e por motivo
