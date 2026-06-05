-- Limpeza final: remove índices sem consumidor de leitura pós-cutover.
-- idx_spr_unprocessed (status <> 'processed') cobre a fila quente do motor.
-- Os abaixo têm 0 scans e nenhuma query que os use como caminho de leitura.
DROP INDEX IF EXISTS public.idx_spr_content_hash;   -- 4 MB; nada faz WHERE content_hash =
DROP INDEX IF EXISTS public.idx_spr_queue;          -- status='pending' redundante c/ idx_spr_unprocessed
DROP INDEX IF EXISTS public.idx_spr_images_queue;   -- images_status='pending' sem consumidor
DROP INDEX IF EXISTS public.idx_spr_failed;         -- status='failed' sem consumidor de leitura