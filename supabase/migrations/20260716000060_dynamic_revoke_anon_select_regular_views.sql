-- Migration 060: Revoke anon SELECT on all public regular views
--              (pg_graphql_anon_table_exposed sweep)
--
-- Source: 200-commit audit — post-059 advisor check
-- Findings addressed: pg_graphql_anon_table_exposed (181 hits on regular views)
--
-- ─── Root Cause ──────────────────────────────────────────────────────────────
--
-- PostgreSQL default privileges: any object created in the public schema
-- automatically receives a PUBLIC grant (equivalent to granting to all roles
-- including anon). Migration 058 removed this for materialized views (relkind='m').
-- Regular views (relkind='v') were not covered by that sweep.
--
-- Supabase's pg_graphql/PostgREST introspects privilege via has_table_privilege.
-- If anon has SELECT on a view, PostgREST exposes it in the anon API schema
-- regardless of whether RLS on underlying tables would block actual rows.
-- This causes the pg_graphql_anon_table_exposed advisor finding.
--
-- ─── Strategy ────────────────────────────────────────────────────────────────
--
-- For each regular view in public schema:
--   1. Check if anon has SELECT via has_table_privilege
--   2. If yes: REVOKE SELECT FROM anon
--   3. Do NOT revoke from authenticated (catalog views must stay accessible
--      to authenticated users — authenticated_table_exposed is expected/intentional
--      for a B2B catalog platform where all routes are behind ProtectedRoute)
--
-- This removes 181 views from the anon PostgREST/pg_graphql introspection schema.
--
-- ─── Safety ──────────────────────────────────────────────────────────────────
--
-- Revoking SELECT on a view from anon does NOT affect:
--   • authenticated users (separate privilege, untouched)
--   • service_role (BYPASSRLS, owns/superuser-equivalent)
--   • SECURITY DEFINER views — they run as their owner, unaffected
--   • RLS policies on underlying tables — still enforced
--
-- ─── Idempotency ─────────────────────────────────────────────────────────────
--
-- REVOKE on a privilege that doesn't exist → no-op (PostgreSQL silently ignores)
-- Re-running is safe.

-- ═══════════════════════════════════════════════════════════════════════════════
-- Phase 1: Revoke anon SELECT on all public regular views
-- ═══════════════════════════════════════════════════════════════════════════════

DO $$
DECLARE
  r         RECORD;
  v_ok      int := 0;
  v_clean   int := 0;
  v_fail    int := 0;
  v_anon_ok boolean;
BEGIN
  FOR r IN
    SELECT c.relname AS view_name, c.oid
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relkind = 'v'   -- regular views only (matviews handled by migration 058)
    ORDER BY c.relname
  LOOP
    BEGIN
      v_anon_ok := has_table_privilege('anon', r.oid, 'SELECT');
    EXCEPTION WHEN OTHERS THEN
      v_anon_ok := false;
    END;

    IF NOT v_anon_ok THEN
      v_clean := v_clean + 1;
      CONTINUE;
    END IF;

    BEGIN
      EXECUTE format('REVOKE SELECT ON public.%I FROM anon', r.view_name);
      v_ok := v_ok + 1;
      RAISE NOTICE '[060] REVOKE SELECT ON public.% FROM anon', r.view_name;
    EXCEPTION WHEN OTHERS THEN
      v_fail := v_fail + 1;
      RAISE WARNING '[060] Could not revoke SELECT on %: %', r.view_name, SQLERRM;
    END;
  END LOOP;

  RAISE NOTICE '[060] View sweep: revoked=%, already_clean=%, failed=%',
    v_ok, v_clean, v_fail;

  IF v_fail > 0 THEN
    RAISE WARNING '[060] % revocation(s) failed', v_fail;
  END IF;

  IF v_ok = 0 AND v_clean > 0 THEN
    RAISE NOTICE '[060] All regular views already had no anon SELECT — pg_graphql_anon_table_exposed was already clear for views';
  END IF;
END;
$$;

-- ═══════════════════════════════════════════════════════════════════════════════
-- Phase 2: Validate — no regular view should be directly accessible to anon
-- ═══════════════════════════════════════════════════════════════════════════════

DO $$
DECLARE
  v_remaining int := 0;
  r           RECORD;
BEGIN
  FOR r IN
    SELECT c.relname AS view_name, c.oid
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relkind = 'v'
    ORDER BY c.relname
  LOOP
    DECLARE
      v_anon_ok boolean;
    BEGIN
      v_anon_ok := has_table_privilege('anon', r.oid, 'SELECT');
    EXCEPTION WHEN OTHERS THEN
      v_anon_ok := false;
    END;

    IF v_anon_ok THEN
      v_remaining := v_remaining + 1;
      RAISE WARNING '[060] Still anon-accessible view: %', r.view_name;
    END IF;
  END LOOP;

  IF v_remaining = 0 THEN
    RAISE NOTICE '[060] All public regular views: anon SELECT revoked — pg_graphql_anon_table_exposed (views) cleared';
  ELSE
    RAISE WARNING '[060] % view(s) still anon-accessible — investigate', v_remaining;
  END IF;

  -- Combined check: tables + matviews + regular views
  DECLARE
    v_total_anon_rels int;
  BEGIN
    SELECT count(*) INTO v_total_anon_rels
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relkind IN ('r', 'm', 'v')  -- tables, matviews, views
      AND has_table_privilege('anon', c.oid, 'SELECT');

    IF v_total_anon_rels = 0 THEN
      RAISE NOTICE '[060] No public relation (table/matview/view) is directly SELECT-able by anon';
    ELSE
      RAISE WARNING '[060] % public relation(s) still anon SELECT-able — check for remaining exposure', v_total_anon_rels;
    END IF;
  END;

  RAISE NOTICE 'Migration 060 complete — pg_graphql_anon_table_exposed (views) should clear on next advisor run.';
END;
$$;
