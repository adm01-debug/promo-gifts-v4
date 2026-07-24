
-- ════════════════════════════════════════════════════════════════
-- Fix: 6 tables found without RLS during post-merge validation.
--
-- Silver tables (silver_products, silver_variants, silver_print_areas,
-- silver_images_queue) are written by SECURITY DEFINER functions that
-- bypass RLS, so enabling RLS here does not break pipeline writes.
-- Adding authenticated READ so admins can query normalized data.
--
-- Backup tables are internal-only: service_role exclusively.
-- Idempotente: DROP POLICY IF EXISTS antes de CREATE.
-- ════════════════════════════════════════════════════════════════

-- ── silver_products ──────────────────────────────────────────────
ALTER TABLE public.silver_products ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS silver_products_service_all ON public.silver_products;
CREATE POLICY silver_products_service_all ON public.silver_products
  FOR ALL TO service_role USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS silver_products_authenticated_read ON public.silver_products;
CREATE POLICY silver_products_authenticated_read ON public.silver_products
  FOR SELECT TO authenticated USING (true);

-- ── silver_variants ───────────────────────────────────────────────
ALTER TABLE public.silver_variants ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS silver_variants_service_all ON public.silver_variants;
CREATE POLICY silver_variants_service_all ON public.silver_variants
  FOR ALL TO service_role USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS silver_variants_authenticated_read ON public.silver_variants;
CREATE POLICY silver_variants_authenticated_read ON public.silver_variants
  FOR SELECT TO authenticated USING (true);

-- ── silver_print_areas ────────────────────────────────────────────
ALTER TABLE public.silver_print_areas ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS silver_print_areas_service_all ON public.silver_print_areas;
CREATE POLICY silver_print_areas_service_all ON public.silver_print_areas
  FOR ALL TO service_role USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS silver_print_areas_authenticated_read ON public.silver_print_areas;
CREATE POLICY silver_print_areas_authenticated_read ON public.silver_print_areas
  FOR SELECT TO authenticated USING (true);

-- ── silver_images_queue ───────────────────────────────────────────
ALTER TABLE public.silver_images_queue ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS silver_images_queue_service_all ON public.silver_images_queue;
CREATE POLICY silver_images_queue_service_all ON public.silver_images_queue
  FOR ALL TO service_role USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS silver_images_queue_authenticated_read ON public.silver_images_queue;
CREATE POLICY silver_images_queue_authenticated_read ON public.silver_images_queue
  FOR SELECT TO authenticated USING (true);

-- ── produtos_padronizacao_bkp_20260604 ────────────────────────────
ALTER TABLE public.produtos_padronizacao_bkp_20260604 ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS pad_bkp_service_only ON public.produtos_padronizacao_bkp_20260604;
CREATE POLICY pad_bkp_service_only ON public.produtos_padronizacao_bkp_20260604
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- ── produtos_padronizacao_variantes_bkp_20260604 ──────────────────
ALTER TABLE public.produtos_padronizacao_variantes_bkp_20260604 ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS pad_var_bkp_service_only ON public.produtos_padronizacao_variantes_bkp_20260604;
CREATE POLICY pad_var_bkp_service_only ON public.produtos_padronizacao_variantes_bkp_20260604
  FOR ALL TO service_role USING (true) WITH CHECK (true);
