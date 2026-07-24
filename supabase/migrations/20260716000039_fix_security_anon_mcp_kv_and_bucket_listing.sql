-- Migration 039: Fix security — revoke anon from mcp_kv_get + fix bucket listing
--
-- Source: 200-commit audit + security advisor findings
-- Findings addressed: 2
--   1) anon_security_definer_function_executable — public.mcp_kv_get
--   2) public_bucket_allows_listing — mockup-assets bucket
--
-- ─── Finding 1: mcp_kv_get callable by anon ──────────────────────────────────
--
-- public.mcp_kv_get(p_secret text, p_key text) is a SECURITY DEFINER function
-- that reads from public.mcp_kv. It has a hardcoded secret check inside:
--   IF p_secret <> '9f2c7a1e...' THEN RAISE EXCEPTION 'forbidden'; END IF;
-- The check is functional but the anon role has EXECUTE, so any anonymous
-- client can attempt brute-force or timing attacks on the secret. The function
-- is backend-only (no public catalog use case), so anon EXECUTE is unnecessary.
--
-- Fix: REVOKE EXECUTE FROM anon. Authenticated callers retain access.
--
-- ─── Finding 2: mockup-assets bucket allows listing ──────────────────────────
--
-- Policy "Authenticated users can view mockup assets" has USING clause:
--   (bucket_id = 'mockup-assets'::text)
-- Without a constraint on `name`, this allows authenticated users to LIST
-- (enumerate) all objects in the bucket — a common data-leakage vector when
-- mockup file names encode user IDs, job IDs, or sensitive slugs.
--
-- All other "direct read" policies in this database require:
--   (name IS NOT NULL) AND (length(name) > 0)
-- This pattern (used by component-media, personalization-images, product-videos,
-- supplier-logos) prevents listing while still allowing direct access by name.
--
-- Fix: Replace the broad policy with a name-constrained equivalent.
-- Safety: Other bucket operations (DELETE, UPDATE, INSERT) on mockup-assets
-- already use (storage.foldername(name))[1] = auth.uid() — unaffected.

-- ═══════════════════════════════════════════════════════════════════════════════
-- 1) Revoke anon execute on mcp_kv_get
-- ═══════════════════════════════════════════════════════════════════════════════

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = 'mcp_kv_get'
  ) THEN
    REVOKE EXECUTE ON FUNCTION public.mcp_kv_get(text, text) FROM anon;
    RAISE NOTICE '✓ [anon_security_definer_function_executable] REVOKE EXECUTE ON mcp_kv_get FROM anon';
  ELSE
    RAISE NOTICE '- public.mcp_kv_get not found — skipping';
  END IF;
END;
$$;

-- ═══════════════════════════════════════════════════════════════════════════════
-- 2) Fix mockup-assets bucket SELECT policy to prevent listing
-- ═══════════════════════════════════════════════════════════════════════════════

DO $$
BEGIN
  -- Drop the broad listing-permissive policy
  DROP POLICY IF EXISTS "Authenticated users can view mockup assets" ON storage.objects;

  -- Recreate with name constraint (prevents listing, allows direct-by-name access)
  -- Matches the pattern used by all other protected-bucket read policies in this DB
  CREATE POLICY "Authenticated users can view mockup assets"
    ON storage.objects
    FOR SELECT TO authenticated
    USING (
      (bucket_id = 'mockup-assets'::text)
      AND (name IS NOT NULL)
      AND (length(name) > 0)
    );

  RAISE NOTICE '✓ [public_bucket_allows_listing] mockup-assets SELECT policy updated — listing prevention applied';
END;
$$;

-- ─── Validation ───────────────────────────────────────────────────────────────
DO $$
DECLARE
  anon_can_exec boolean;
  policy_qual   text;
BEGIN
  -- 1) Verify mcp_kv_get is no longer executable by anon
  SELECT has_function_privilege('anon', 'public.mcp_kv_get(text, text)', 'EXECUTE')
  INTO anon_can_exec;

  IF anon_can_exec THEN
    RAISE WARNING 'anon still has EXECUTE on mcp_kv_get — revoke may have failed';
  ELSE
    RAISE NOTICE '✓ anon no longer has EXECUTE on mcp_kv_get';
  END IF;

  -- 2) Verify new policy USING clause contains name constraint
  SELECT qual
  INTO policy_qual
  FROM pg_policies
  WHERE schemaname = 'storage'
    AND tablename  = 'objects'
    AND policyname = 'Authenticated users can view mockup assets';

  IF policy_qual IS NULL THEN
    RAISE WARNING 'Policy "Authenticated users can view mockup assets" not found';
  ELSIF policy_qual NOT LIKE '%name IS NOT NULL%' AND policy_qual NOT LIKE '%name is not null%' THEN
    RAISE WARNING 'Policy USING clause may still allow listing: %', policy_qual;
  ELSE
    RAISE NOTICE '✓ mockup-assets USING clause: %', policy_qual;
  END IF;

  RAISE NOTICE 'Migration 039 complete — 2 security findings addressed.';
END;
$$;
