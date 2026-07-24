-- ============================================================================
-- product_images :: re-afirmar baseline seguro de leitura (RLS)  (Migration 2/5)
-- ----------------------------------------------------------------------------
-- O ambiente (Lovable/jobs) já removeu a policy permissiva `*_anon_select USING(true)`
-- que permitia ao papel anônimo ler imagens inativas. Esta migration é DEFENSIVA e
-- idempotente: neutraliza a policy permissiva caso ela ressurja e fixa
-- `product_images_select` na forma canônica segura.
--   - anônimo: vê apenas is_active = true
--   - autenticado: vê tudo
--   - escrita (INSERT/UPDATE/DELETE): restrita a org owner/admin (policies já existentes)
-- ============================================================================

DROP POLICY IF EXISTS product_images_anon_select ON public.product_images;

DROP POLICY IF EXISTS product_images_select ON public.product_images;
CREATE POLICY product_images_select ON public.product_images
  FOR SELECT
  TO public
  USING ((is_active = true) OR ((SELECT auth.uid()) IS NOT NULL));
