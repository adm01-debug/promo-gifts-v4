-- Limpeza final de índices de supplier_products_raw (pós-cutover status).
-- Remove índices sem consumidor de leitura: a fila quente do motor usa
-- idx_spr_unprocessed (WHERE status <> 'processed'); estes tinham 0 scans e
-- nenhuma query que os use como caminho de leitura (os matches de
-- status='pending'/'failed' em funções/views são writes SET ou agregações
-- full-scan de dashboard, que não usam índice parcial).
--   - idx_spr_content_hash (4 MB): nada faz WHERE content_hash = ...; a detecção
--     de mudança em insert_supplier_product_raw usa o índice único de
--     (supplier_id, supplier_reference) no ON CONFLICT, não lookup por hash.
--   - idx_spr_queue (status='pending'): redundante com idx_spr_unprocessed.
--   - idx_spr_images_queue / idx_spr_failed: sem consumidor de leitura.
-- Resultado: 13 -> 8 índices; ~12 MB -> ~6,7 MB de índices.
DROP INDEX IF EXISTS public.idx_spr_content_hash;
DROP INDEX IF EXISTS public.idx_spr_queue;
DROP INDEX IF EXISTS public.idx_spr_images_queue;
DROP INDEX IF EXISTS public.idx_spr_failed;
