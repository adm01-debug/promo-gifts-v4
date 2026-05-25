-- Partial index for public product listing queries.
-- Replay-safe: only create it when the clean schema includes all referenced
-- public.products columns.

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'products'
      AND column_name = 'name'
  ) AND EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'products'
      AND column_name = 'is_active'
  ) AND EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'products'
      AND column_name = 'is_deleted'
  ) THEN
    CREATE INDEX IF NOT EXISTS idx_products_is_active_not_deleted_name
      ON public.products (name)
      WHERE is_active = true AND is_deleted = false;

    COMMENT ON INDEX public.idx_products_is_active_not_deleted_name IS
      'Partial index for public listing queries: is_active=true, is_deleted=false, ordered by name.';
  ELSE
    RAISE NOTICE '[colapso_fase3] Skipped idx_products_is_active_not_deleted_name: required columns are missing';
  END IF;
END $$;
