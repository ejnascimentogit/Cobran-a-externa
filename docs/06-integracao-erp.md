# Integração com o ERP

**Responsável: Ryan.**

Este documento define só o **contrato**: o que o sistema de cobrança espera receber do ERP. Como a leitura é feita (túnel, agente local, API) é decisão do Ryan.

## Princípios

- O ERP é **somente leitura**: o sistema de cobrança nunca grava no WinThor.
- Usuário Oracle com permissão apenas nas tabelas necessárias.
- Consultas com filtro de data para não pesar no ERP.
- A baixa oficial continua no ERP; o sistema só confere.

## O que a integração precisa entregar

| Destino no Supabase | Dados | Frequência sugerida |
| --- | --- | --- |
| `clientes_cache` | Código, nome, endereço completo, telefone, praça/rota, latitude/longitude se houver | Diária (madrugada) |
| `titulos_cache` | Código do título, cliente, vencimento, valor, valor em aberto, situação | Diária (madrugada) |
| `titulos_cache.data_pagamento` | Data da baixa dos títulos monitorados | Várias vezes ao dia |

## Referência de tabelas no WinThor (confirmar no ambiente do cliente)

| Dado | Tabela provável |
| --- | --- |
| Títulos a receber | `PCPREST` |
| Cadastro do cliente | `PCCLIENT` |
| Praça e rota | `PCPRACA` / rotas de entrega |

## Opções de conexão avaliadas

| Opção | Como funciona | Observação |
| --- | --- | --- |
| Túnel TCP na porta 1521 | `cloudflared` publica o Oracle; o serviço usa `cloudflared access tcp` com service token | Expõe o banco inteiro, ainda que protegido |
| API no cliente + túnel HTTP | Serviço local consulta o Oracle e expõe só endpoints definidos via Cloudflare Tunnel | Mesmo padrão já usado na integração de NF/Boleto |
| Agente local que envia ao Supabase | Serviço roda no cliente e grava no Supabase via HTTPS de saída | Sem portas de entrada; atualização exige acesso à máquina |

## Pendências para o Ryan

- [ ] Escolher a forma de conexão.
- [ ] Confirmar tabelas e campos de títulos, clientes e baixas.
- [ ] Verificar se o cadastro já tem latitude/longitude.
- [ ] Definir como o sistema de cobrança será avisado de falha na carga.

## Desenho escolhido: API no cliente + Cloudflare Tunnel (proposta, 2026-10-20)

- **No servidor do cliente:** `cloudflared` (túnel de saída, sem porta de entrada) + uma API pequena que executa **só** as consultas fixas de `docs/erp/consultas-winthor.sql` (clientes em atraso, títulos em aberto, baixas). Nada de SQL livre pela API. Usuário Oracle só com `SELECT` nas tabelas necessárias.
- **Proteção do túnel:** Cloudflare Access com *service token* (o Supabase chama com ele); credenciais do Oracle só no servidor do cliente.
- **No Supabase:** uma Edge Function agendada (`pg_cron`) chama a API e grava em `int05_titulo_erp` e nos clientes da cobrança (papel `agente_N`). A conexão de cada empresa fica em `int02_erp`.
- **A confirmar com o Ryan:** como o e-commerce já fala com o WinThor (VPN, túnel ou agente), para reaproveitar o mesmo caminho em vez de abrir outro.
- **SQL:** `docs/erp/consultas-winthor.sql` (rascunho; rodar a consulta 0 em cada cliente para conferir nomes e versões de coluna).
