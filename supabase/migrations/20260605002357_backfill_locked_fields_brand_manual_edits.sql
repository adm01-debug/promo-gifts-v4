
-- BUG-4 FIX: Protect manually-edited brand from being overwritten by pipeline
-- Identifies products where stored brand differs from raw data brand
-- and adds 'brand' to locked_fields

-- First, temporarily allow pipeline context for this migration
SELECT set_config('app.write_source', 'migration', true);

UPDATE products p
SET locked_fields = array_append(COALESCE(p.locked_fields, '{}'), 'brand')
WHERE p.supplier_id = 'bcfc0d02-44c6-48ae-8472-12b1a3f3d8e0'
  AND p.brand IS NOT NULL
  AND p.brand <> ''
  AND NOT ('brand' = ANY(COALESCE(p.locked_fields, '{}')))
  AND EXISTS (
      SELECT 1 FROM supplier_products_raw spr
      WHERE spr.supplier_id = p.supplier_id
        AND spr.raw_data->>'ProdReference' = p.supplier_reference
        AND spr.raw_data->>'Brand' IS NOT NULL
        AND spr.raw_data->>'Brand' <> p.brand
      LIMIT 1
  );
