-- Melhoria B: Backfill dimensions jsonb → escalares (269 produtos)
SELECT set_config('app.write_source','pipeline',true);
SELECT set_config('app.bulk_import_mode','true',true);
UPDATE public.products SET
  length_cm   = COALESCE(length_cm,   NULLIF((dimensions->>'length_cm')::text,'')::numeric),
  width_cm    = COALESCE(width_cm,    NULLIF((dimensions->>'width_cm')::text,'')::numeric),
  height_cm   = COALESCE(height_cm,   NULLIF((dimensions->>'height_cm')::text,'')::numeric),
  diameter_cm = COALESCE(diameter_cm, NULLIF((dimensions->>'diameter_cm')::text,'')::numeric)
WHERE dimensions IS NOT NULL AND (
  (length_cm IS NULL AND dimensions->>'length_cm' IS NOT NULL AND (dimensions->>'length_cm')::text ~ '^-?[0-9]+\.?[0-9]*$' AND (dimensions->>'length_cm')::numeric BETWEEN 0.1 AND 999) OR
  (width_cm IS NULL AND dimensions->>'width_cm' IS NOT NULL AND (dimensions->>'width_cm')::text ~ '^-?[0-9]+\.?[0-9]*$' AND (dimensions->>'width_cm')::numeric BETWEEN 0.1 AND 999) OR
  (height_cm IS NULL AND dimensions->>'height_cm' IS NOT NULL AND (dimensions->>'height_cm')::text ~ '^-?[0-9]+\.?[0-9]*$' AND (dimensions->>'height_cm')::numeric BETWEEN 0.1 AND 999) OR
  (diameter_cm IS NULL AND dimensions->>'diameter_cm' IS NOT NULL AND (dimensions->>'diameter_cm')::text ~ '^-?[0-9]+\.?[0-9]*$' AND (dimensions->>'diameter_cm')::numeric BETWEEN 0.1 AND 999)
);
SELECT set_config('app.write_source','ui',true);
SELECT set_config('app.bulk_import_mode','false',true);
COMMENT ON COLUMN public.products.dimensions IS 'DROPADO em 2026-06-23 (migration products_dimensions_5_drop_jsonb_column_20260623). Backfill B1 aplicado antes.';