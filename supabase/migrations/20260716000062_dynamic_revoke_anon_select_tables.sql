-- Migration 062: Revoke anon SELECT on all public tables
--              (pg_graphql_anon_table_exposed — table sweep)
--
-- Source: 200-commit audit — advisor check after migration 061
-- Findings addressed: pg_graphql_anon_table_exposed (123 remaining hits from tables)
--
-- ─── Root Cause ──────────────────────────────────────────────────────────────
--
-- Migrations 058 (matviews) and 060 (regular views) revoked anon SELECT from
-- non-table relations. 123 pg_graphql_anon_table_exposed findings remain from
-- regular tables (relkind='r') and partitioned tables (relkind='p') that still
-- carry the default PUBLIC SELECT grant.
--
-- When PostgreSQL creates a table, PUBLIC (every role including anon) gets
-- default privileges unless ALTER DEFAULT PRIVILEGES removes them. Supabase
-- uses RLS to control row-level access, but the SELECT privilege on the table
-- itself is not automatically revoked — PostgREST introspection still sees
-- the table as accessible to anon and flags it.
--
-- ─── Safety Analysis ─────────────────────────────────────────────────────────
--
-- Revoking SELECT from anon on public tables is safe because:
--
--   1. All B2B catalog routes are behind <ProtectedRoute /> — no legitimate
--      anon API access to tables is expected.
--
--   2. Auth flow (login, rate limiting, quote submission) uses SECURITY DEFINER
--      functions (check_login_rate_limit, fn_check_login_allowed,
--      get_quote_token_by_value, submit_quote_response). These functions run
--      as their owner (postgres/supabase_admin), not as anon — so they do NOT
--      need anon SELECT privilege on the underlying tables.
--
--   3. RLS is already enabled on all tables (migrations 040-046) with
--      RESTRICTIVE deny policies on tables with zero policies (migration 055).
--      Revoking SELECT goes one step further: instead of "anon can query but
--      gets 0 rows", anon now gets a permission-denied error — stricter and
--      more correct for this B2B platform.
--
--   4. service_role (BYPASSRLS) and postgres superuser are unaffected by
--      privilege revokes on application roles.
--
-- ─── Idempotency ─────────────────────────────────────────────────────────────
--
-- REVOKE on a privilege that doesn't exist → no-op in PostgreSQL.
-- Re-running is safe.

-- ═══════════════════════════════════════════════════════════════════════════════
-- Phase 1: Revoke anon SELECT on all public tables
-- ═══════════════════════════════════════════════════════════════════════════════

DO $$
DECLARE
  r      RECORD;
  v_ok   int := 0;
  v_fail int := 0;
BEGIN
  FOR r IN
    SELECT c.relname AS tablename, c.oid
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relkind IN ('r', 'p')   -- regular and partitioned tables
      AND has_table_privilege('anon', c.oid, 'SELECT')
    ORDER BY c.relname
  LOOP
    BEGIN
      EXECUTE format('REVOKE SELECT ON public.%I FROM anon', r.tablename);
      v_ok := v_ok + 1;
      RAISE NOTICE '[062] REVOKE SELECT ON public.% FROM anon', r.tablename;
    EXCEPTION WHEN OTHERS THEN
      v_fail := v_fail + 1;
      RAISE WARNING '[062] Failed to revoke SELECT on %: %', r.tablename, SQLERRM;
    END;
  END LOOP;

  RAISE NOTICE '[062] Table sweep: revoked=%, failed=%', v_ok, v_fail;

  IF v_fail > 0 THEN
    RAISE WARNING '[062] % revocation(s) failed', v_fail;
  END IF;

  IF v_ok = 0 THEN
    RAISE NOTICE '[062] No tables with anon SELECT found — already clean';
  END IF;
END;
$$;

-- ═══════════════════════════════════════════════════════════════════════════════
-- Phase 2: Validate — no public table/view/matview should be anon SELECT-able
-- ═══════════════════════════════════════════════════════════════════════════════

DO $$
DECLARE
  v_remaining      int := 0;
  v_total_anon_rel int := 0;
  r                RECORD;
BEGIN
  -- Remaining tables with anon SELECT
  SELECT count(*) INTO v_remaining
  FROM pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public'
    AND c.relkind IN ('r', 'p')
    AND has_table_privilege('anon', c.oid, 'SELECT');

  IF v_remaining = 0 THEN
    RAISE NOTICE '[062] All public tables: anon SELECT revoked';
  ELSE
    RAISE WARNING '[062] % table(s) still anon SELECT-able', v_remaining;
    FOR r IN
      SELECT c.relname
      FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public'
        AND c.relkind IN ('r', 'p')
        AND has_table_privilege('anon', c.oid, 'SELECT')
      ORDER BY c.relname
    LOOP
      RAISE WARNING '[062] Still accessible: %', r.relname;
    END LOOP;
  END IF;

  -- Combined sweep: ALL public relations
  SELECT count(*) INTO v_total_anon_rel
  FROM pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public'
    AND c.relkind IN ('r', 'p', 'm', 'v')  -- tables, partitioned, matviews, views
    AND has_table_privilege('anon', c.oid, 'SELECT');

  IF v_total_anon_rel = 0 THEN
    RAISE NOTICE '[062] No public relation (table/matview/view/partitioned) is SELECT-able by anon — pg_graphql_anon_table_exposed cleared';
  ELSE
    RAISE WARNING '[062] % public relation(s) still anon SELECT-able after full sweep', v_total_anon_rel;
  END IF;

  RAISE NOTICE 'Migration 062 complete — pg_graphql_anon_table_exposed should clear on next advisor run.';
END;
$$;
