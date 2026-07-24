-- ============================================================================
-- supplier_products_raw — Refactor v2 (Fase 2/5): Colunas derivadas e mortas
-- ----------------------------------------------------------------------------
--   * images_processed: hoje é espelho perfeito de images_status (drift=0),
--     mantido por trigger — mesmo anti-padrão já eliminado com `processed`.
--     Vira coluna GERADA (zero trigger, drift impossível por construção).
--   * claimed_at: 100% NULL. O motor faz claim via advisory lock +
--     FOR UPDATE SKIP LOCKED; a coluna nunca foi usada por nenhuma função,
--     view ou código de app (só aparecia nos tipos gerados). Removida.
--   * Timestamps de ciclo de vida passam a NOT NULL (nunca são nulos).
-- Pré-requisito: Fase 1 (o trigger não atribui mais images_processed).
-- ============================================================================

-- 1) images_processed: boolean comum -> coluna gerada espelhando o enum
ALTER TABLE public.supplier_products_raw DROP COLUMN images_processed;
ALTER TABLE public.supplier_products_raw
  ADD COLUMN images_processed boolean
  GENERATED ALWAYS AS (images_status = 'processed'::supplier_raw_status) STORED;

COMMENT ON COLUMN public.supplier_products_raw.images_processed IS
  'Derivada (GENERATED) de images_status. SSOT = images_status; nunca escrever direto.';

-- 2) claimed_at: coluna morta (claim é via advisory lock + SKIP LOCKED)
ALTER TABLE public.supplier_products_raw DROP COLUMN claimed_at;

-- 3) Timestamps sempre presentes -> NOT NULL (com backfill defensivo)
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
  'Nº de tentativas de processamento. Incrementada pelo trigger fn_spr_before_write a cada novo erro.';
COMMENT ON COLUMN public.supplier_products_raw.last_error IS
  'Último process_errors observado (mantido pelo trigger). Histórico de falha da linha.';
