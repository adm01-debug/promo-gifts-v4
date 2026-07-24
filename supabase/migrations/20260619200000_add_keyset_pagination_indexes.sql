-- Keyset pagination indexes for stockFetcher.ts (fetchPaginatedFromBridge).
--
-- Pattern:  SELECT ... FROM <table> WHERE is_active = true AND id > $lastId
--           ORDER BY id ASC LIMIT 1000;
--
-- Without a partial index, PostgreSQL performs a full sequential scan filtered
-- by is_active and then sorts by id — O(N) for every page. With a partial index
-- on (id ASC) WHERE is_active = true, the planner uses a forward index scan
-- starting exactly at lastId, stopping after 1000 rows: O(page_size) per page.
--
-- Tables covered (all three have `is_active = true` filter in stockFetcher):
--   1. products              — filtered via v_products_public view (active alias)
--   2. product_variants      — is_active = true
--   3. variant_supplier_sources — is_active = true
--
-- categories / suppliers / product_images / mv_stock_velocity are fetched
-- without an is_active filter; their primary key already serves the keyset
-- ORDER BY id scan, so no extra index is needed.

-- 1. products: keyset scan WHERE is_active = true ORDER BY id
CREATE INDEX IF NOT EXISTS idx_products_keyset_active
  ON public.products (id ASC)
  WHERE is_active = true;

-- 2. product_variants: keyset scan WHERE is_active = true ORDER BY id
CREATE INDEX IF NOT EXISTS idx_product_variants_keyset_active
  ON public.product_variants (id ASC)
  WHERE is_active = true;

-- 3. variant_supplier_sources: keyset scan WHERE is_active = true ORDER BY id
CREATE INDEX IF NOT EXISTS idx_variant_supplier_sources_keyset_active
  ON public.variant_supplier_sources (id ASC)
  WHERE is_active = true;
