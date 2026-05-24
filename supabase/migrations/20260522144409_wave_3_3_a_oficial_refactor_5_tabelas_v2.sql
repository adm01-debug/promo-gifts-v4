-- Wave 3.3.A v2 - 5 tabelas
DROP POLICY IF EXISTS ck_insert_self ON public.custom_kits;
CREATE POLICY ck_insert_self ON public.custom_kits FOR INSERT TO authenticated WITH CHECK (user_id = (SELECT auth.uid()));

ALTER TABLE public.custom_kits
  DROP COLUMN IF EXISTS reference_code, DROP COLUMN IF EXISTS packaging_product_id,
  DROP COLUMN IF EXISTS packaging_name, DROP COLUMN IF EXISTS packaging_sku,
  DROP COLUMN IF EXISTS packaging_price, DROP COLUMN IF EXISTS packaging_volume_liters,
  DROP COLUMN IF EXISTS packaging_personalization, DROP COLUMN IF EXISTS items,
  DROP COLUMN IF EXISTS items_count, DROP COLUMN IF EXISTS items_total_price,
  DROP COLUMN IF EXISTS volume_used_liters, DROP COLUMN IF EXISTS volume_available_liters,
  DROP COLUMN IF EXISTS volume_percentage, DROP COLUMN IF EXISTS grand_total,
  DROP COLUMN IF EXISTS created_by, DROP COLUMN IF EXISTS customer_name,
  DROP COLUMN IF EXISTS customer_email, DROP COLUMN IF EXISTS customer_phone,
  DROP COLUMN IF EXISTS notes;

ALTER TABLE public.favorite_items_trash ADD COLUMN IF NOT EXISTS expires_at timestamptz DEFAULT (now()+interval '30 days');
ALTER TABLE public.quote_item_personalizations ADD COLUMN IF NOT EXISTS location_code text, ADD COLUMN IF NOT EXISTS location_name text;
ALTER TABLE public.saved_filters ADD COLUMN IF NOT EXISTS description text, ADD COLUMN IF NOT EXISTS icon text, ADD COLUMN IF NOT EXISTS color text;
