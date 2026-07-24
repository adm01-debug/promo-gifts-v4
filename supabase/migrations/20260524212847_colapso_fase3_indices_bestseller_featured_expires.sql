-- Partial indexes for bestseller/featured expiration queries.
-- Some clean schemas do not include these legacy public.products columns, so
-- each index is created only when its full column contract is present.

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'products'
      AND column_name = 'is_bestseller'
  ) AND EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'products'
      AND column_name = 'is_bestseller_expires_at'
  ) THEN
    CREATE INDEX IF NOT EXISTS idx_products_bestseller_expires
      ON public.products (is_bestseller_expires_at)
      WHERE is_bestseller = true AND is_bestseller_expires_at IS NOT NULL;

    COMMENT ON INDEX public.idx_products_bestseller_expires IS
      'Partial index for bestseller expiration cleanup queries. Created in 2026-05-24 phase 3.';
  ELSE
    RAISE NOTICE '[colapso_fase3] Skipped idx_products_bestseller_expires: required columns are missing';
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'products'
      AND column_name = 'is_featured'
  ) AND EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'products'
      AND column_name = 'is_featured_expires_at'
  ) THEN
    CREATE INDEX IF NOT EXISTS idx_products_featured_expires
      ON public.products (is_featured_expires_at)
      WHERE is_featured = true AND is_featured_expires_at IS NOT NULL;

    COMMENT ON INDEX public.idx_products_featured_expires IS
      'Partial index for featured expiration cleanup queries. Created in 2026-05-24 phase 3.';
  ELSE
    RAISE NOTICE '[colapso_fase3] Skipped idx_products_featured_expires: required columns are missing';
  END IF;
END $$;
