-- Define consistent unique keys for product webhook upsert strategy.
-- Rule:
-- 1) external_id is the preferred identity when provided.
-- 2) sku is fallback identity when external_id is null.

CREATE UNIQUE INDEX IF NOT EXISTS ux_products_external_id_not_null
  ON public.products (external_id)
  WHERE external_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS ux_products_sku
  ON public.products (sku);
