-- P3: remove a tabela de backup pontual criada na remediação de 2026-06-04.
-- supplier_products_raw_bkp_20260604 (~36 MB, sem PK) era um snapshot de segurança
-- e não é referenciada por nenhuma FK/função. Janela de confiança encerrada.
DROP TABLE IF EXISTS public.supplier_products_raw_bkp_20260604;
