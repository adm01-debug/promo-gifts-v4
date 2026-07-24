-- BUG-SF-IDX-VARIANTS: compound partial index on product_variants for color filtering.
-- useColorEnrichment and useProductsByColor filter: is_active=true AND color_id IN (...) AND product_id IN (...).
-- Without this index, each color enrichment batch (up to 80 products × N color_ids) did full scans.
-- (color_id, product_id) covers both the IN-list predicates and enables index-only scans
-- when only product_id is needed after filtering by color_id.

CREATE INDEX IF NOT EXISTS idx_variants_color_id_active
  ON public.product_variants (color_id, product_id)
  WHERE is_active = true;
