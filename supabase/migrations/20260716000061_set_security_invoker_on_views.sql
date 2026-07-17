-- Migration 061: Set security_invoker = true on public views
--              (security_definer_view advisor finding)
--
-- Source: 200-commit audit — advisor check after migration 060
-- Findings addressed: security_definer_view (3 hits)
--
-- ─── Root Cause ──────────────────────────────────────────────────────────────
--
-- By default (and in PostgreSQL < 15), views run as the view OWNER (usually
-- postgres / supabase_admin). This means:
--   • When a user SELECTs from the view, the underlying tables are accessed
--     with the owner's privileges — effectively bypassing RLS on those tables.
--   • A malicious user who can influence filter pushdown could access data
--     beyond what the calling role's RLS policies permit.
--
-- PostgreSQL 15+ (Supabase uses PG17) introduces the security_invoker view
-- option. When security_invoker = true:
--   • The view runs as the CALLING user, not the owner.
--   • RLS is enforced on underlying tables based on auth.uid(), auth.role(), etc.
--   • The calling user must have SELECT on the underlying tables (or pass RLS).
--
-- Supabase Security Advisor flags views without security_invoker = true as
-- "security_definer_view" because the default (owner-privilege) mode is the
-- security-equivalent of a SECURITY DEFINER function on every call.
--
-- ─── Strategy ────────────────────────────────────────────────────────────────
--
-- For each regular view in the public schema that does NOT already have
-- security_invoker = true:
--   ALTER VIEW public.<name> SET (security_invoker = true);
--
-- This is safe because:
--   1. All underlying tables now have RLS enabled (migrations 040-046).
--   2. Authenticated users have explicit SELECT grants (or PERMISSIVE RLS
--      policies) on catalog tables.
--   3. The view logic (WHERE clauses, JOINs) remains identical — only the
--      execution context changes from owner to caller.
--   4. service_role bypasses RLS regardless, so backend/admin operations
--      are unaffected.
--
-- ─── Idempotency ─────────────────────────────────────────────────────────────
--
-- ALTER VIEW SET (security_invoker = true) is idempotent.
-- Setting it on a view that already has it is a no-op in PostgreSQL.
-- Re-running is safe.

-- ═══════════════════════════════════════════════════════════════════════════════
-- Phase 1: Set security_invoker = true on all public regular views
-- ═══════════════════════════════════════════════════════════════════════════════

DO $$
DECLARE
  r      RECORD;
  v_ok   int := 0;
  v_skip int := 0;
  v_fail int := 0;
BEGIN
  FOR r IN
    SELECT c.relname AS view_name
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relkind = 'v'
      -- Only views that do NOT already have security_invoker=true
      AND NOT (
        c.reloptions IS NOT NULL
        AND 'security_invoker=true' = ANY(c.reloptions)
      )
    ORDER BY c.relname
  LOOP
    BEGIN
      EXECUTE format(
        'ALTER VIEW public.%I SET (security_invoker = true)',
        r.view_name
      );
      v_ok := v_ok + 1;
      RAISE NOTICE '[061] SET security_invoker=true on view: %', r.view_name;
    EXCEPTION WHEN OTHERS THEN
      v_fail := v_fail + 1;
      RAISE WARNING '[061] Could not set security_invoker on %: %', r.view_name, SQLERRM;
    END;
  END LOOP;

  RAISE NOTICE '[061] security_invoker sweep: updated=%, skipped_already_set=%, failed=%',
    v_ok, v_skip, v_fail;

  IF v_fail > 0 THEN
    RAISE WARNING '[061] % view(s) could not be updated — check warnings above', v_fail;
  END IF;

  IF v_ok = 0 THEN
    RAISE NOTICE '[061] All views already had security_invoker=true — security_definer_view was already clear';
  END IF;
END;
$$;

-- ═══════════════════════════════════════════════════════════════════════════════
-- Phase 2: Validate — all public views should have security_invoker = true
-- ═══════════════════════════════════════════════════════════════════════════════

DO $$
DECLARE
  v_remaining int;
  v_total     int;
  r           RECORD;
BEGIN
  -- Count views without security_invoker = true
  SELECT count(*) INTO v_remaining
  FROM pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public'
    AND c.relkind = 'v'
    AND NOT (
      c.reloptions IS NOT NULL
      AND 'security_invoker=true' = ANY(c.reloptions)
    );

  -- Count total views
  SELECT count(*) INTO v_total
  FROM pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public'
    AND c.relkind = 'v';

  IF v_remaining = 0 THEN
    RAISE NOTICE '[061] All % public views have security_invoker=true — security_definer_view cleared', v_total;
  ELSE
    RAISE WARNING '[061] % of % views still missing security_invoker=true', v_remaining, v_total;

    FOR r IN
      SELECT c.relname
      FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public'
        AND c.relkind = 'v'
        AND NOT (
          c.reloptions IS NOT NULL
          AND 'security_invoker=true' = ANY(c.reloptions)
        )
      ORDER BY c.relname
    LOOP
      RAISE WARNING '[061] Missing security_invoker: %', r.relname;
    END LOOP;
  END IF;

  RAISE NOTICE 'Migration 061 complete — security_definer_view should clear on next advisor run.';
END;
$$;
