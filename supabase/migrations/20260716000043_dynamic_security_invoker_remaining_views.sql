-- Migration 043: Dynamic security_invoker=on for all remaining public views
--
-- Source: 200-commit audit — follow-up on migrations 006 and 023 (point-in-time)
-- Findings addressed: security_definer_view (all remaining)
--
-- ─── Why migrations 006 and 023 are insufficient ─────────────────────────────
--
-- Migration 006 converted ~80+ internal/admin views to security_invoker=on.
-- Migration 023 converted 54 additional "public catalog" views to security_invoker=on.
-- However, both were point-in-time snapshots. Views created in:
--   - The broader migration history (products_*.sql, v_system_alerts_*.sql, etc.)
--   - Lovable bot commits after 2026-07-16
--   - Any migration in the 001-042 series that created new views
-- ...may not have security_invoker=on.
--
-- ─── Intentional SECURITY DEFINER exemptions ─────────────────────────────────
--
-- v_products_public:
--   Migration 040 explicitly set security_invoker=false so the view owner
--   (postgres/superuser) accesses mv_product_leaf_category directly.
--   anon/authenticated cannot SELECT from that MV (revoked in 040), so the
--   view must run as its owner to populate product data. Do NOT convert.
--
-- ─── Safety ──────────────────────────────────────────────────────────────────
--
-- Converting a view to security_invoker=on means:
--   - Queries through the view run with the CALLING ROLE's permissions
--   - RLS on underlying tables is CORRECTLY enforced (not bypassed)
--   - Authenticated users retain access because they still have SELECT on the view
--   - Anon users: queries run as anon, which has had SELECT revoked from most
--     underlying tables in migrations 027-032 → view returns empty (correct for B2B)
--
-- This is a correctness improvement: views that were silently bypassing RLS
-- now correctly enforce it per caller, closing the privilege-escalation path.
--
-- ALTER VIEW ... SET (security_invoker = on) is idempotent in PG15+/PG17.

-- ═══════════════════════════════════════════════════════════════════════════════
-- Dynamic conversion of all public views to security_invoker=on
-- Exemption: v_products_public (intentionally SECURITY DEFINER — migration 040)
-- ═══════════════════════════════════════════════════════════════════════════════

DO $$
DECLARE
  r           RECORD;
  v_ok        int := 0;
  v_skip      int := 0;
  v_fail      int := 0;
  v_exempt    text[] := ARRAY['v_products_public'];
BEGIN
  FOR r IN
    SELECT c.relname AS viewname
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relkind = 'v'                   -- regular views only
      AND NOT (c.relname = ANY(v_exempt))   -- exclude intentional exemptions
      AND NOT (                             -- skip already-converted views
        EXISTS (
          SELECT 1 FROM unnest(c.reloptions) AS opt
          WHERE opt = 'security_invoker=on'
        )
      )
    ORDER BY c.relname
  LOOP
    BEGIN
      EXECUTE format('ALTER VIEW public.%I SET (security_invoker = on)', r.viewname);
      v_ok := v_ok + 1;
      RAISE NOTICE '✓ [043] security_invoker=on: %', r.viewname;
    EXCEPTION WHEN OTHERS THEN
      v_fail := v_fail + 1;
      RAISE WARNING '[043] ✗ Could not convert %: %', r.viewname, SQLERRM;
    END;
  END LOOP;

  -- Count already-converted views (should be most of them after 006+023)
  SELECT count(*) INTO v_skip
  FROM pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public'
    AND c.relkind = 'v'
    AND NOT (c.relname = ANY(v_exempt))
    AND EXISTS (
      SELECT 1 FROM unnest(c.reloptions) AS opt
      WHERE opt = 'security_invoker=on'
    );

  RAISE NOTICE '[043] Views converted=%  already_done=%  failed=%', v_ok, v_skip, v_fail;

  IF v_fail > 0 THEN
    RAISE WARNING '[043] % view(s) could not be converted — review warnings above', v_fail;
  END IF;
END;
$$;

-- ─── Validation ───────────────────────────────────────────────────────────────
DO $$
DECLARE
  v_total_views     int;
  v_invoker_views   int;
  v_still_definer   int;
BEGIN
  SELECT count(*) INTO v_total_views
  FROM pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public' AND c.relkind = 'v';

  SELECT count(*) INTO v_invoker_views
  FROM pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public'
    AND c.relkind = 'v'
    AND EXISTS (
      SELECT 1 FROM unnest(c.reloptions) AS opt
      WHERE opt = 'security_invoker=on'
    );

  v_still_definer := v_total_views - v_invoker_views;

  RAISE NOTICE '[043] Public views: total=%, security_invoker=on=%, remaining_definer=%',
    v_total_views, v_invoker_views, v_still_definer;

  -- The only expected SECURITY DEFINER view is v_products_public
  IF v_still_definer <= 1 THEN
    RAISE NOTICE '✓ [043] security_definer_view cleared (1 intentional exemption: v_products_public)';
  ELSE
    RAISE WARNING '[043] % view(s) still SECURITY DEFINER — expected 1 (v_products_public)',
      v_still_definer;
  END IF;

  -- Verify v_products_public is still SECURITY DEFINER (intentional)
  IF NOT EXISTS (
    SELECT 1 FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relname = 'v_products_public'
      AND c.relkind = 'v'
      AND EXISTS (
        SELECT 1 FROM unnest(c.reloptions) AS opt
        WHERE opt = 'security_invoker=on'
      )
  ) THEN
    RAISE NOTICE '✓ [043] v_products_public retains SECURITY DEFINER mode (required by migration 040)';
  ELSE
    RAISE WARNING '[043] v_products_public was converted to security_invoker=on — this may break product API!';
  END IF;

  RAISE NOTICE 'Migration 043 complete — security_definer_view findings should clear on next advisor run.';
END;
$$;
