-- P2: remove índice redundante.
-- idx_spr_supplier (supplier_id) é prefixo redundante de 4 índices compostos
-- (uq_supplier_product_raw, uq_spr_supplier_sku, idx_spr_content_hash, idx_spr_queue),
-- que já cobrem buscas por supplier_id. Remover reduz custo de escrita numa tabela
-- com ~4x mais UPDATEs do que linhas.
DROP INDEX IF EXISTS public.idx_spr_supplier;
