-- SEC P2: Harden mockup-assets storage bucket
--
-- Problem A: "Anyone can view mockup assets" SELECT policy allows anon to LIST
--   all files via the Supabase Storage API (/storage/v1/object/list/mockup-assets).
--   This exposes customer order patterns and filenames.
--   NOTE: The bucket's public=true flag remains so existing public URLs
--   (getPublicUrl()) continue serving files to shared-quote viewers — that path
--   goes through the CDN and does NOT require a SELECT storage policy.
--
-- Problem B: UPDATE + DELETE policies use bare auth.uid() (InitPlan per-row
--   instead of SubPlan constant). Fixed with (SELECT auth.uid()).
--
-- Problem C: No INSERT policy — edge functions use service_role (bypasses RLS)
--   so uploads are correct. Adding an explicit INSERT for authenticated users
--   scoped to their own folder ensures client-side uploads also work safely.

-- ─── (A) Replace public SELECT with authenticated-only ────────────────────────
DROP POLICY IF EXISTS "Anyone can view mockup assets" ON storage.objects;

CREATE POLICY "Authenticated users can view mockup assets"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'mockup-assets');

-- ─── (B) Fix InitPlan in UPDATE ───────────────────────────────────────────────
DROP POLICY IF EXISTS "Users can update their own mockup assets" ON storage.objects;

CREATE POLICY "Users can update their own mockup assets"
  ON storage.objects FOR UPDATE TO authenticated
  USING (
    bucket_id = 'mockup-assets'
    AND (SELECT auth.uid())::text = (storage.foldername(name))[1]
  )
  WITH CHECK (
    bucket_id = 'mockup-assets'
    AND (SELECT auth.uid())::text = (storage.foldername(name))[1]
  );

-- ─── (C) Fix InitPlan in DELETE ──────────────────────────────────────────────
DROP POLICY IF EXISTS "Users can delete their own mockup assets" ON storage.objects;

CREATE POLICY "Users can delete their own mockup assets"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'mockup-assets'
    AND (SELECT auth.uid())::text = (storage.foldername(name))[1]
  );

-- ─── (D) Add scoped INSERT for client-side uploads ───────────────────────────
-- Edge functions use service_role (bypasses RLS).
-- This policy enables authenticated client uploads into their own folder only.
DROP POLICY IF EXISTS "Users can upload to their own mockup folder" ON storage.objects;

CREATE POLICY "Users can upload to their own mockup folder"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'mockup-assets'
    AND (SELECT auth.uid())::text = (storage.foldername(name))[1]
  );

-- ─── Validate ─────────────────────────────────────────────────────────────────
DO $$
DECLARE
  v_anon_select boolean;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage'
      AND tablename = 'objects'
      AND cmd = 'SELECT'
      AND roles && ARRAY['public', 'anon']::name[]
      AND qual LIKE '%mockup-assets%'
  ) INTO v_anon_select;

  IF v_anon_select THEN
    RAISE EXCEPTION 'mockup-assets hardening FAILED — anon SELECT policy still exists';
  END IF;
  RAISE NOTICE 'mockup-assets storage hardening OK — anon enumeration removed';
END;
$$;
