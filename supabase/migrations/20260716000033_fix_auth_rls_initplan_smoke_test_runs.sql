-- Migration 033: Fix auth_rls_initplan on smoke_test_runs
--
-- Source: 200-commit audit + performance advisor finding
-- Target finding: auth_rls_initplan (1 finding)
--
-- Root cause: Policy smoke_insert_service_role on public.smoke_test_runs calls
--   is_admin_or_above((SELECT auth.uid())) — the auth.uid() arg is wrapped but
--   is_admin_or_above itself is NOT wrapped in (SELECT ...), so the planner
--   re-evaluates the STABLE function per-row instead of hoisting it as an InitPlan.
--   Additionally, the policy contains current_setting() which the advisor detects.
--
-- Fix: Wrap both current_setting() check and is_admin_or_above(auth.uid()) in
--   top-level (SELECT ...) subqueries — these become InitPlans evaluated once
--   per statement rather than once per row.
--
-- Policy metadata (from pg_policy):
--   Table:   public.smoke_test_runs
--   Name:    smoke_insert_service_role
--   Cmd:     INSERT (polcmd = 'a')
--   Roles:   authenticated
--   USING:   (none — INSERT policy)
--   WITH CHECK (current): is_admin_or_above((SELECT auth.uid())) OR current_setting check
--
-- Safety: IF EXISTS guard. DROP POLICY IF EXISTS is idempotent.

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relname = 'smoke_test_runs'
      AND c.relkind IN ('r', 'p')
  ) THEN
    -- Drop existing policy and recreate with proper InitPlan wrapping
    DROP POLICY IF EXISTS smoke_insert_service_role ON public.smoke_test_runs;

    CREATE POLICY smoke_insert_service_role ON public.smoke_test_runs
      FOR INSERT TO authenticated
      WITH CHECK (
        (SELECT current_setting('request.jwt.claim.role', true)) = 'service_role'
        OR (SELECT is_admin_or_above(auth.uid()))
      );

    RAISE NOTICE '✓ [auth_rls_initplan] Recreated smoke_insert_service_role with InitPlan-safe wrappers';
  ELSE
    RAISE NOTICE '- public.smoke_test_runs not found — skipping';
  END IF;
END;
$$;

-- ─── Validation ───────────────────────────────────────────────────────────────
DO $$
DECLARE
  wc_expr text;
BEGIN
  SELECT pg_get_expr(polwithcheck, polrelid)
  INTO wc_expr
  FROM pg_policy
  WHERE polname = 'smoke_insert_service_role'
    AND polrelid = 'public.smoke_test_runs'::regclass;

  IF wc_expr IS NULL THEN
    RAISE WARNING 'Policy smoke_insert_service_role not found on smoke_test_runs';
  ELSE
    RAISE NOTICE '✓ Policy WITH CHECK: %', wc_expr;
    RAISE NOTICE '✓ Migration 033 complete — auth_rls_initplan should clear on next advisor run';
  END IF;
END;
$$;
