-- Migration 069: Revoke anon SELECT from remaining 41 public objects
--
-- Source: 200-commit audit — post-068 security advisor check
-- Findings addressed:
--   pg_graphql_anon_table_exposed : 41 → 0
--   materialized_view_in_api      : 1 → 0 (mv_product_leaf_category loses anon access)
--
-- ─── Root Cause ──────────────────────────────────────────────────────────────
--
-- 41 public tables/views still have anon SELECT. These were either:
--   a) Created after migrations 063/064 ran (new DDL with PUBLIC grants), or
--   b) Re-granted by the Lovable bot after our revoke.
--
-- The app is a B2B catalog requiring authentication — anon users should never
-- have direct SELECT on any catalog table or view. Access is gated by RLS
-- policies on authenticated JWT.
--
-- Migration 063 set ALTER DEFAULT PRIVILEGES to block future PUBLIC grants,
-- but existing grants on tables already present were not fully swept.
--
-- ─── Strategy ────────────────────────────────────────────────────────────────
--
-- Dynamic sweep:
--   • REVOKE SELECT FROM PUBLIC (clears PUBLIC-grant path)
--   • REVOKE SELECT FROM anon (clears direct anon-grant path)
--   • GRANT SELECT TO authenticated (preserves app functionality for logged-in users)
--
-- Covers all relkinds: r (table), p (partitioned), v (view), m (matview).
--
-- ─── Safety Analysis ─────────────────────────────────────────────────────────
--
-- service_role (BYPASSRLS) and postgres: unaffected.
-- SECURITY DEFINER functions (run as owner): unaffected.
-- authenticated role gains explicit SELECT where it may have only had it via PUBLIC.
--
-- ─── Idempotency ─────────────────────────────────────────────────────────────
--
-- REVOKE when not granted → no-op.
-- GRANT when already granted → no-op.

-- ═══════════════════════════════════════════════════════════════════════════════
-- Phase 1: Revoke anon + PUBLIC, grant authenticated — on all anon-accessible objects
-- ═══════════════════════════════════════════════════════════════════════════════

DO $$
DECLARE
  r      RECORD;
  v_ok   int := 0;
  v_skip int := 0;
BEGIN
  FOR r IN
    SELECT c.relname, c.oid, c.relkind
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relkind IN ('r', 'p', 'v', 'm')
      AND has_table_privilege('anon', c.oid, 'SELECT')
    ORDER BY c.relname
  LOOP
    BEGIN
      EXECUTE format('REVOKE SELECT ON public.%I FROM PUBLIC', r.relname);
      EXECUTE format('REVOKE SELECT ON public.%I FROM anon', r.relname);
      EXECUTE format('GRANT  SELECT ON public.%I TO authenticated', r.relname);
      v_ok := v_ok + 1;
      RAISE NOTICE '[069] Fixed public.% (relkind=%): revoked anon/PUBLIC, granted authenticated',
        r.relname, r.relkind;
    EXCEPTION WHEN OTHERS THEN
      v_skip := v_skip + 1;
      RAISE WARNING '[069] Failed on public.%: %', r.relname, SQLERRM;
    END;
  END LOOP;

  IF v_ok = 0 AND v_skip = 0 THEN
    RAISE NOTICE '[069] Phase 1: No anon-accessible public objects found — already clean';
  ELSE
    RAISE NOTICE '[069] Phase 1: fixed=%, failed=%', v_ok, v_skip;
  END IF;
END;
$$;

-- ═══════════════════════════════════════════════════════════════════════════════
-- Phase 2: Belt-and-suspenders — ALTER DEFAULT PRIVILEGES (reinforce 063)
-- ═══════════════════════════════════════════════════════════════════════════════

ALTER DEFAULT PRIVILEGES IN SCHEMA public
  REVOKE SELECT ON TABLES FROM PUBLIC;

ALTER DEFAULT PRIVILEGES IN SCHEMA public
  REVOKE SELECT ON TABLES FROM anon;

-- ═══════════════════════════════════════════════════════════════════════════════
-- Phase 3: Validate
-- ═══════════════════════════════════════════════════════════════════════════════

DO $$
DECLARE
  v_anon_count int;
  r            RECORD;
BEGIN
  SELECT count(*) INTO v_anon_count
  FROM pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public'
    AND c.relkind IN ('r', 'p', 'v', 'm')
    AND has_table_privilege('anon', c.oid, 'SELECT');

  IF v_anon_count = 0 THEN
    RAISE NOTICE '[069] pg_graphql_anon_table_exposed (public): CLEARED — 0 anon-accessible objects';
  ELSE
    RAISE WARNING '[069] % public object(s) still anon-accessible:', v_anon_count;
    FOR r IN
      SELECT c.relname, c.relkind
      FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public'
        AND c.relkind IN ('r', 'p', 'v', 'm')
        AND has_table_privilege('anon', c.oid, 'SELECT')
      ORDER BY c.relname
    LOOP
      RAISE WARNING '[069]   still accessible: public.% (relkind=%)', r.relname, r.relkind;
    END LOOP;
  END IF;

  RAISE NOTICE 'Migration 069 complete.';
END;
$$;
