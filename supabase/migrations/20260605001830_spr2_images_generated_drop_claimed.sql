
ALTER TABLE public.supplier_products_raw DROP COLUMN images_processed;
ALTER TABLE public.supplier_products_raw
  ADD COLUMN images_processed boolean
  GENERATED ALWAYS AS (images_status = 'processed'::supplier_raw_status) STORED;

COMMENT ON COLUMN public.supplier_products_raw.images_processed IS
  'Derivada (GENERATED) de images_status. SSOT = images_status; nunca escrever direto.';

ALTER TABLE public.supplier_products_raw DROP COLUMN claimed_at;

UPDATE public.supplier_products_raw
   SET imported_at = COALESCE(imported_at, created_at, now())
 WHERE imported_at IS NULL;
UPDATE public.supplier_products_raw
   SET created_at = COALESCE(created_at, imported_at, now())
 WHERE created_at IS NULL;
UPDATE public.supplier_products_raw
   SET updated_at = COALESCE(updated_at, created_at, now())
 WHERE updated_at IS NULL;

ALTER TABLE public.supplier_products_raw
  ALTER COLUMN imported_at SET NOT NULL,
  ALTER COLUMN created_at  SET NOT NULL,
  ALTER COLUMN updated_at  SET NOT NULL;

COMMENT ON COLUMN public.supplier_products_raw.attempts IS
  'No de tentativas de processamento. Incrementada pelo trigger fn_spr_before_write a cada novo erro.';
COMMENT ON COLUMN public.supplier_products_raw.last_error IS
  'Ultimo process_errors observado (mantido pelo trigger). Historico de falha da linha.';
