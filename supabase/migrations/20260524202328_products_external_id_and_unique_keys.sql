-- Define consistent unique keys for the product webhook upsert strategy.
-- Rule:
-- 1) external_id is the preferred identity when provided.
-- 2) sku is the fallback identity when external_id is null.
--
-- Context / drift fix:
-- The product-webhook edge function upserts with onConflict:'external_id'
-- and onConflict:'sku', and the generated TS types declare products.external_id.
-- However the column was absent in production (earlier ADD COLUMN migrations
-- were recorded as applied but did not persist), which broke the external_id
-- upsert path. This migration restores the column and the unique key it needs.
-- The sku side is already covered by the existing unique index products_sku_key,
-- so we do not create a duplicate index for it.

ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS external_id TEXT;

-- Partial unique index: enforces uniqueness only for rows that carry an
-- external_id, allowing the sku-only fallback path to coexist.
CREATE UNIQUE INDEX IF NOT EXISTS ux_products_external_id_not_null
  ON public.products (external_id)
  WHERE external_id IS NOT NULL;
