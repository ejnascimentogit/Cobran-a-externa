-- Consultas SOMENTE LEITURA (SELECT) no Oracle do WinThor para a Cobrança Externa.
-- Seguem a rotina de docs/erp/sincronizacao-titulos.md: A (chaves), B (detalhe dos novos), C (situação por chave).
-- RASCUNHO: nomes de tabela e coluna são os usuais do WinThor, mas variam por versão e por cliente.
-- Rode a consulta 0 no ambiente do cliente e ajuste o que ela não encontrar. Nenhum usuário/senha neste arquivo.
-- Só títulos VENCIDOS entram (decisão do Edimilson, 2026-10-20).
-- Chave do título (a confirmar com o Ryan): CODFILIAL | DUPLIC | PREST.
-- Binds: :dias_min e :dias_max (faixa de atraso que o cliente digita no painel), :filial (opcional, null = todas). Em B e C a API troca a lista :k1..:kN por até 500 chaves por chamada.

-- 0) DESCOBERTA: confere se as colunas existem (rodar uma vez em cada cliente).
SELECT table_name, column_name, data_type, data_length
FROM   all_tab_columns
WHERE  table_name IN ('PCPREST', 'PCCLIENT', 'PCPRACA')
AND    column_name IN ('CODCLI','CODFILIAL','DUPLIC','PREST','NUMTRANSVENDA','CODCOB','DTEMISSAO','DTVENC','VALOR','DTPAG','VPAGO',
                       'CLIENTE','FANTASIA','CGCENT','ENDERCOB','NUMEROCOB','COMPLEMENTOCOB','BAIRROCOB','MUNICCOB','ESTCOB','CEPCOB',
                       'ENDERENT','NUMEROENT','BAIRROENT','MUNICENT','ESTENT','CEPENT','TELCOB','TELENT','TELCELENT',
                       'CODPRACA','PRACA','CODUSUR1','DTEXCLUSAO','LATITUDE','LONGITUDE')
ORDER  BY table_name, column_name;

-- 0b) DESCOBERTA DA ROTA: onde o WinThor deste cliente guarda a rota do cliente/praça (varia muito).
--     Procure no resultado a coluna que liga cliente ou praça a uma rota (ex.: PCPRACA.ROTA, PCPRACA.NUMREGIAO, PCROTAEXP.*).
SELECT table_name, column_name, data_type
FROM   all_tab_columns
WHERE  table_name LIKE 'PC%' AND column_name LIKE '%ROTA%'
ORDER  BY table_name, column_name;
SELECT column_name, data_type FROM all_tab_columns WHERE table_name = 'PCPRACA' ORDER BY column_id;

-- A) CHAVES: todos os títulos vencidos em aberto, de todos os clientes (leve; roda de madrugada).
SELECT p.CODFILIAL                                          AS filial,
       p.DUPLIC                                             AS duplicata,
       p.PREST                                              AS prestacao,
       p.CODCLI                                             AS cod_cliente,
       c.CODPRACA                                           AS cod_praca,
       pr.PRACA                                             AS praca,
       pr.ROTA                                              AS rota,          -- CONFIRMAR pela consulta 0b (pode ser outra tabela/coluna)
       p.DTVENC                                             AS vencimento,
       p.VALOR                                              AS valor
FROM   PCPREST p
JOIN   PCCLIENT c  ON c.CODCLI = p.CODCLI
LEFT   JOIN PCPRACA pr ON pr.CODPRACA = c.CODPRACA
WHERE  p.DTPAG IS NULL
AND    TRUNC(SYSDATE) - TRUNC(p.DTVENC) BETWEEN :dias_min AND :dias_max   -- faixa de atraso digitada no painel (ex.: 30 a 180); mínimo 1 = só vencidos
AND    p.CODCOB NOT IN ('DESD', 'CANC')                     -- CONFIRMAR a lista de cobranças a excluir no cliente
AND    (:filial IS NULL OR p.CODFILIAL = :filial);

-- B) DETALHE: título + cliente, só das chaves NOVAS (a API manda as chaves que o Supabase ainda não tem).
SELECT p.CODFILIAL                                          AS filial,
       p.DUPLIC                                             AS duplicata,
       p.PREST                                              AS prestacao,
       p.NUMTRANSVENDA                                      AS num_transacao,
       p.CODCOB                                             AS cod_cobranca,
       p.DTEMISSAO                                          AS emissao,
       p.DTVENC                                             AS vencimento,
       p.VALOR                                              AS valor,
       c.CODCLI                                             AS cod_cliente,
       c.CLIENTE                                            AS nome,
       c.FANTASIA                                           AS fantasia,
       c.CGCENT                                             AS cnpj_cpf,
       c.ENDERCOB, c.NUMEROCOB, c.COMPLEMENTOCOB, c.BAIRROCOB, c.MUNICCOB, c.ESTCOB, c.CEPCOB,  -- endereço de cobrança
       c.ENDERENT, c.NUMEROENT, c.BAIRROENT, c.MUNICENT, c.ESTENT, c.CEPENT,                    -- entrega (reserva)
       c.TELCOB, c.TELENT, c.TELCELENT,
       c.CODPRACA                                           AS cod_praca,
       pr.PRACA                                             AS praca,
       pr.ROTA                                              AS rota,          -- CONFIRMAR pela consulta 0b
       c.CODUSUR1                                           AS cod_rca,
       c.LATITUDE, c.LONGITUDE                              -- se a consulta 0 não achar, tirar estas duas
FROM   PCPREST p
JOIN   PCCLIENT c  ON c.CODCLI = p.CODCLI
LEFT   JOIN PCPRACA pr ON pr.CODPRACA = c.CODPRACA
WHERE  p.CODFILIAL || '|' || p.DUPLIC || '|' || p.PREST IN (:k1, :k2 /* ... até :k500 */);

-- C) SITUAÇÃO POR CHAVE: para os títulos que o Supabase tinha em aberto e que sumiram da consulta A.
--    Com DTPAG preenchida -> pago (grava data e valor). Sem DTPAG -> saiu do aberto por outro motivo (ver COD_COBRANCA).
SELECT p.CODFILIAL   AS filial,
       p.DUPLIC      AS duplicata,
       p.PREST       AS prestacao,
       p.DTPAG       AS data_pagamento,
       p.VPAGO       AS valor_pago,
       p.CODCOB      AS cod_cobranca
FROM   PCPREST p
WHERE  p.CODFILIAL || '|' || p.DUPLIC || '|' || p.PREST IN (:k1, :k2 /* ... até :k500 */);
