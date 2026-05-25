-- =============================================================
-- P1 — FK sem cobertura (advisor 0001_unindexed_foreign_keys)
-- =============================================================
CREATE INDEX IF NOT EXISTS idx_collection_products_product_id
  ON public.collection_products(product_id);
