-- Migration 058: Dynamic revoke of direct anon/authenticated access to all
--               public materialized views (materialized_view_in_api sweep)
--
-- Source: 200-commit audit — Supabase security advisor finding
-- Findings addressed: materialized_view_in_api (lint 0005) — comprehensive sweep
--
-- ─── Why matview access is dangerous ─────────────────────────────────────────
--
-- Materialized views (relkind = 'm') do NOT support Row Level Security.
-- Regardless of the calling role's privileges, a matview:
--   • Returns ALL rows stored at the last REFRESH time
--   • Cannot filter rows based on auth.uid() or auth.role()
--   • Cannot honour per-user or per-organization RLS policies
--
-- For a B2B wholesale platform, direct matview access via PostgREST exposes:
--   • Internal aggregate data (pricing, inventory, intelligence)
--   • Cross-organization data that should be isolated per org
--   • Data that should only be visible to authenticated/admin users
--
-- Migration 040 addressed one specific matview (mv_product_leaf_category).
-- This migration dynamically covers ALL remaining matviews in public schema
-- that still have anon or authenticated SELECT grants.
--
-- ─── Strategy ────────────────────────────────────────────────────────────────
--
-- For each matview in public schema:
--   1. Check if anon or authenticated has SELECT privilege via has_table_privilege
--   2. If so: REVOKE SELECT ON <matview> FROM anon, authenticated
--   3. The matview remains accessible to:
--      • service_role (bypass via BYPASSRLS or explicit GRANT, unaffected)
--      • postgres/supabase_admin (superusers, unaffected)
--      • SECURITY DEFINER views/functions that wrap the matview (unaffected —
--        they run as their owner, not as the calling role)
--
-- ─── Access pattern after this migration ─────────────────────────────────────
--
-- MatViews should be accessed via SECURITY DEFINER wrapper views or functions
-- that apply appropriate WHERE clauses (active, org-scoped, etc.).
-- Migration 040 already converted v_products_public to SECURITY DEFINER mode.
-- This migration completes the pattern for all remaining matviews.
--
-- ─── Idempotency ─────────────────────────────────────────────────────────────
--
-- REVOKE on a privilege that doesn't exist is a no-op.
-- Re-running is safe.

-- ═══════════════════════════════════════════════════════════════════════════════
-- Phase 1: Revoke anon/authenticated SELECT on all public matviews
-- ═══════════════════════════════════════════════════════════════════════════════

DO $$
DECLARE
  r          RECORD;
  v_ok       int := 0;
  v_clean    int := 0;
  v_fail     int := 0;
  v_anon_ok  boolean;
  v_auth_ok  boolean;
BEGIN
  FOR r IN
    SELECT c.relname AS matview_name, c.oid
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relkind = 'm'   -- materialized view
    ORDER BY c.relname
  LOOP
    -- Check current privileges
    BEGIN
      v_anon_ok := has_table_privilege('anon',          r.oid, 'SELECT');
    EXCEPTION WHEN OTHERS THEN
      v_anon_ok := false;
    END;
    BEGIN
      v_auth_ok := has_table_privilege('authenticated', r.oid, 'SELECT');
    EXCEPTION WHEN OTHERS THEN
      v_auth_ok := false;
    END;

    IF NOT v_anon_ok AND NOT v_auth_ok THEN
      v_clean := v_clean + 1;
      RAISE NOTICE '[058] CLEAN — %: anon/authenticated have no SELECT on this matview already',
        r.matview_name;
      CONTINUE;
    END IF;

    -- Revoke from whichever roles have access
    BEGIN
      IF v_anon_ok AND v_auth_ok THEN
        EXECUTE format('REVOKE SELECT ON public.%I FROM anon, authenticated', r.matview_name);
        v_ok := v_ok + 1;
        RAISE NOTICE '✓ [058] REVOKE SELECT ON % FROM anon, authenticated (both had access)',
          r.matview_name;
      ELSIF v_anon_ok THEN
        EXECUTE format('REVOKE SELECT ON public.%I FROM anon', r.matview_name);
        v_ok := v_ok + 1;
        RAISE NOTICE '✓ [058] REVOKE SELECT ON % FROM anon (authenticated was already restricted)',
          r.matview_name;
      ELSE
        EXECUTE format('REVOKE SELECT ON public.%I FROM authenticated', r.matview_name);
        v_ok := v_ok + 1;
        RAISE NOTICE '✓ [058] REVOKE SELECT ON % FROM authenticated (anon was already restricted)',
          r.matview_name;
      END IF;
    EXCEPTION WHEN OTHERS THEN
      v_fail := v_fail + 1;
      RAISE WARNING '[058] ✗ Could not revoke SELECT on %: %', r.matview_name, SQLERRM;
    END;
  END LOOP;

  RAISE NOTICE '[058] Matview sweep: revoked=%, already_clean=%, failed=%',
    v_ok, v_clean, v_fail;

  IF v_fail > 0 THEN
    RAISE WARNING '[058] % revocation(s) failed — check warnings above', v_fail;
  END IF;

  IF v_ok = 0 AND v_clean > 0 THEN
    RAISE NOTICE '[058] All matviews already restricted — materialized_view_in_api was already addressed';
  END IF;
END;
$$;

-- ═══════════════════════════════════════════════════════════════════════════════
-- Phase 2: Validate — no public matview should be directly accessible to anon
--           or authenticated
-- ═══════════════════════════════════════════════════════════════════════════════

DO $$
DECLARE
  v_remaining int := 0;
  r           RECORD;
BEGIN
  FOR r IN
    SELECT c.relname AS matview_name, c.oid
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relkind = 'm'
    ORDER BY c.relname
  LOOP
    DECLARE
      v_anon_ok boolean;
      v_auth_ok boolean;
    BEGIN
      BEGIN
        v_anon_ok := has_table_privilege('anon',          r.oid, 'SELECT');
      EXCEPTION WHEN OTHERS THEN
        v_anon_ok := false;
      END;
      BEGIN
        v_auth_ok := has_table_privilege('authenticated', r.oid, 'SELECT');
      EXCEPTION WHEN OTHERS THEN
        v_auth_ok := false;
      END;

      IF v_anon_ok OR v_auth_ok THEN
        v_remaining := v_remaining + 1;
        RAISE WARNING '[058] Still accessible: % (anon=%  authenticated=%)',
          r.matview_name, v_anon_ok, v_auth_ok;
      ELSE
        RAISE NOTICE '✓ [058] % — no direct anon/authenticated SELECT', r.matview_name;
      END IF;
    END;
  END LOOP;

  IF v_remaining = 0 THEN
    RAISE NOTICE '✓ [058] All public matviews: anon/authenticated SELECT revoked — materialized_view_in_api cleared';
  ELSE
    RAISE WARNING '[058] % matview(s) still accessible to anon/authenticated — investigate', v_remaining;
  END IF;

  RAISE NOTICE 'Migration 058 complete — materialized_view_in_api should clear on next advisor run.';
END;
$$;
