-- Consultas SOMENTE LEITURA no Oracle do WinThor para a Cobrança Externa.
-- RASCUNHO: os nomes de tabela e coluna abaixo são os usuais do WinThor, mas variam por versão e por cliente.
-- Rode primeiro a consulta 0 no ambiente do cliente e ajuste o resto conforme o que ela devolver.
-- Nunca guardar usuário/senha do Oracle neste arquivo. Todas as consultas são SELECT (nada grava no ERP).
-- Parâmetros (bind): :filial (opcional), :dias_baixa (quantos dias de baixas reler, ex.: 7).

-- 0) DESCOBERTA: confere que as colunas existem (rodar uma vez, em cada cliente).
SELECT table_name, column_name, data_type, data_length
FROM   all_tab_columns
WHERE  table_name IN ('PCPREST', 'PCCLIENT', 'PCPRACA')
AND    column_name IN ('CODCLI','DUPLIC','PREST','DTEMISSAO','DTVENC','VALOR','DTPAG','VPAGO','CODCOB','CODFILIAL',
                       'NUMTRANSVENDA','CLIENTE','FANTASIA','CGCENT','ENDERCOB','BAIRROCOB','MUNICCOB','ESTCOB','CEPCOB',
                       'ENDERENT','BAIRROENT','MUNICENT','ESTENT','CEPENT','TELCOB','TELENT','TELCELENT','CODPRACA',
                       'CODUSUR1','BLOQUEIO','DTEXCLUSAO','LATITUDE','LONGITUDE','PRACA')
ORDER  BY table_name, column_name;

-- 1) TÍTULOS EM ABERTO (carga diária, madrugada) -> int05_titulo_erp
--    Em aberto = ainda sem data de pagamento. Confirmar com o financeiro do cliente quais cobranças (CODCOB)
--    não entram (ex.: cancelada, desdobrada, cartão) e se há outra coluna de situação.
SELECT p.CODCLI                                   AS cod_cliente,
       p.CODFILIAL                                AS filial,
       p.DUPLIC                                   AS duplicata,
       p.PREST                                    AS prestacao,
       p.NUMTRANSVENDA                            AS num_transacao,
       p.CODCOB                                   AS cod_cobranca,
       p.DTEMISSAO                                AS emissao,
       p.DTVENC                                   AS vencimento,
       p.VALOR                                    AS valor,
       TRUNC(SYSDATE) - TRUNC(p.DTVENC)           AS dias_atraso
FROM   PCPREST p
WHERE  p.DTPAG IS NULL
AND    p.DTVENC < TRUNC(SYSDATE)               -- só vencidos; tirar para trazer a vencer também
AND    p.CODCOB NOT IN ('DESD', 'CANC')        -- CONFIRMAR a lista no cliente
AND    (:filial IS NULL OR p.CODFILIAL = :filial);

-- 2) CLIENTES COM TÍTULO EM ATRASO (carga diária) -> tabela de clientes da cobrança (endereço, telefone, coordenadas)
--    Só quem tem título em aberto, para não trazer a base inteira.
SELECT c.CODCLI                                   AS cod_cliente,
       c.CLIENTE                                  AS nome,
       c.FANTASIA                                 AS fantasia,
       c.CGCENT                                   AS cnpj_cpf,
       c.ENDERCOB, c.BAIRROCOB, c.MUNICCOB, c.ESTCOB, c.CEPCOB,   -- endereço de cobrança
       c.ENDERENT, c.BAIRROENT, c.MUNICENT, c.ESTENT, c.CEPENT,   -- endereço de entrega (reserva)
       c.TELCOB, c.TELENT, c.TELCELENT,
       c.CODPRACA                                 AS cod_praca,
       pr.PRACA                                   AS praca,
       c.CODUSUR1                                 AS cod_rca,
       c.LATITUDE, c.LONGITUDE                    -- podem não existir nesta versão: se a consulta 0 não achar, tirar
FROM   PCCLIENT c
LEFT   JOIN PCPRACA pr ON pr.CODPRACA = c.CODPRACA
WHERE  c.DTEXCLUSAO IS NULL
AND    EXISTS (SELECT 1 FROM PCPREST p
               WHERE  p.CODCLI = c.CODCLI AND p.DTPAG IS NULL AND p.DTVENC < TRUNC(SYSDATE)
               AND    p.CODCOB NOT IN ('DESD', 'CANC'));

-- 3) BAIXAS (várias vezes ao dia) -> atualiza a data de pagamento dos títulos monitorados
--    Relê só os últimos :dias_baixa dias, para não pesar no ERP.
SELECT p.CODCLI AS cod_cliente, p.CODFILIAL AS filial, p.DUPLIC AS duplicata, p.PREST AS prestacao,
       p.DTPAG  AS data_pagamento, p.VPAGO AS valor_pago
FROM   PCPREST p
WHERE  p.DTPAG IS NOT NULL
AND    p.DTPAG >= TRUNC(SYSDATE) - :dias_baixa
AND    (:filial IS NULL OR p.CODFILIAL = :filial);
