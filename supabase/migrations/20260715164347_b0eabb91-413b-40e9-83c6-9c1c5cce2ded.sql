-- =========================================================
-- FIX 1: ai_insights_cache — SELECT scoped a user_id
-- =========================================================
DROP POLICY IF EXISTS "Authenticated users can view all cached insights" ON public.ai_insights_cache;

CREATE POLICY "Users can view their own cached insights"
  ON public.ai_insights_cache
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id OR public.is_admin(auth.uid()));

-- =========================================================
-- FIX 2: frontend_telemetry — remover SELECT broad
-- =========================================================
DROP POLICY IF EXISTS "Only authenticated can view telemetry" ON public.frontend_telemetry;
-- Policies "Admins can read telemetry" e "Admins can view telemetry" permanecem intactas.

-- =========================================================
-- FIX 3: saved_trends_views — remover SELECT broad
-- =========================================================
DROP POLICY IF EXISTS "Users can view all saved trends views" ON public.saved_trends_views;
-- Policy "Users can manage their own saved trends views" (ALL) permanece intacta.

-- =========================================================
-- FIX 4: storage.objects — leitura por ownership em buckets privados
-- =========================================================
DROP POLICY IF EXISTS "Authenticated direct read component-media" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated direct read personalization-images" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated direct read product-videos" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated direct read supplier-logos" ON storage.objects;

CREATE POLICY "Owner direct read component-media"
  ON storage.objects
  FOR SELECT
  TO authenticated
  USING (bucket_id = 'component-media' AND owner = auth.uid());

CREATE POLICY "Owner direct read personalization-images"
  ON storage.objects
  FOR SELECT
  TO authenticated
  USING (bucket_id = 'personalization-images' AND owner = auth.uid());

CREATE POLICY "Owner direct read product-videos"
  ON storage.objects
  FOR SELECT
  TO authenticated
  USING (bucket_id = 'product-videos' AND owner = auth.uid());

CREATE POLICY "Owner direct read supplier-logos"
  ON storage.objects
  FOR SELECT
  TO authenticated
  USING (bucket_id = 'supplier-logos' AND owner = auth.uid());