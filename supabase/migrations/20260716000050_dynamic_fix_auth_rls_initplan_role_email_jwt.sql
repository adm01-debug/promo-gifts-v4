-- Migration 050: Dynamic auth_rls_initplan fix — auth.role(), auth.email(), auth.jwt()
--
-- Source: 200-commit audit — complement to migration 045 (which fixed auth.uid() only)
-- Findings addressed: auth_rls_initplan (auth.role / auth.email / auth.jwt variants)
--
-- ─── Why 045 is incomplete ────────────────────────────────────────────────────
--
-- Migration 045 fixed ALL bare auth.uid() occurrences in public schema policies.
-- However the Supabase advisor auth_rls_initplan rule covers ALL auth.* functions:
--
--   Remaining bare calls found in migrations (affected policy snapshots):
--     auth.role()  — 20250103100000, 20250103110000, 20260519121346,
--                    20260522113832, 20260529192405, 20251231023800
--     auth.email() — 20260427213016, 20260427212820
--     auth.jwt()   — 20260527193640, 20260527193804, 20260527193835,
--                    20260619151002, 20260619153422
--
-- All of these functions, when used without (SELECT ...) wrapper in RLS USING /
-- WITH CHECK clauses, are re-evaluated once per row (correlated evaluation).
-- The (SELECT ...) wrapper promotes the call to an init-plan (evaluated once
-- per query), eliminating N redundant calls per query on large tables.
--
-- ─── auth.jwt() special handling ─────────────────────────────────────────────
--
-- auth.jwt() is often used as:
--   auth.jwt() ->> 'role'          →  (SELECT auth.jwt()) ->> 'role'
--   auth.jwt()->>'role'            →  (SELECT auth.jwt())->>'role'
--   (auth.jwt() ->> 'role') = 'x' →  ((SELECT auth.jwt()) ->> 'role') = 'x'
--
-- The simple text substitution auth.jwt() → (SELECT auth.jwt()) handles all
-- variants because the ->> operator remains attached to the new expression.
--
-- ─── Strategy ─────────────────────────────────────────────────────────────────
--
-- Three independent passes, one per function:
--   Pass 1: auth.role()  → (SELECT auth.role())
--   Pass 2: auth.email() → (SELECT auth.email())
--   Pass 3: auth.jwt()   → (SELECT auth.jwt())
--
-- Each pass uses the triple-swap technique from migration 045:
--   Step 1: Replace already-wrapped occurrences with a placeholder
--   Step 2: Replace remaining bare calls with wrapped form
--   Step 3: Restore placeholder to wrapped form
--
-- ALTER POLICY ... USING/WITH CHECK preserves policy grants and metadata.
-- Exception handling per policy prevents one failure from aborting the pass.
-- Idempotent: already-wrapped policies don't match the bare-call filter.

-- ═══════════════════════════════════════════════════════════════════════════════
-- Pass 1: Fix bare auth.role() in public schema RLS policies
-- ═══════════════════════════════════════════════════════════════════════════════

DO $$
DECLARE
  r          RECORD;
  v_ok       int := 0;
  v_skip     int := 0;
  v_fail     int := 0;
  v_qual     text;
  v_check    text;
  c_ph       CONSTANT text := '<<AUTH_ROLE_ALREADY_WRAPPED>>';
BEGIN
  FOR r IN
    SELECT p.policyname, p.tablename, p.cmd, p.qual, p.with_check
    FROM pg_policies p
    WHERE p.schemaname = 'public'
      AND (
        (p.qual       IS NOT NULL
          AND p.qual       LIKE '%auth.role()%'
          AND p.qual       NOT LIKE '%(SELECT auth.role())%')
        OR
        (p.with_check IS NOT NULL
          AND p.with_check LIKE '%auth.role()%'
          AND p.with_check NOT LIKE '%(SELECT auth.role())%')
      )
    ORDER BY p.tablename, p.policyname
  LOOP
    -- Triple-swap: preserve wrapped → sub bare → restore
    v_qual  := replace(r.qual,       '(SELECT auth.role())', c_ph);
    v_check := replace(r.with_check, '(SELECT auth.role())', c_ph);

    v_qual  := replace(v_qual,  'auth.role()', '(SELECT auth.role())');
    v_check := replace(v_check, 'auth.role()', '(SELECT auth.role())');

    v_qual  := replace(v_qual,  c_ph, '(SELECT auth.role())');
    v_check := replace(v_check, c_ph, '(SELECT auth.role())');

    BEGIN
      IF r.qual IS NOT NULL AND r.with_check IS NOT NULL THEN
        EXECUTE format(
          'ALTER POLICY %I ON public.%I USING (%s) WITH CHECK (%s)',
          r.policyname, r.tablename, v_qual, v_check
        );
      ELSIF r.qual IS NOT NULL THEN
        EXECUTE format(
          'ALTER POLICY %I ON public.%I USING (%s)',
          r.policyname, r.tablename, v_qual
        );
      ELSIF r.with_check IS NOT NULL THEN
        EXECUTE format(
          'ALTER POLICY %I ON public.%I WITH CHECK (%s)',
          r.policyname, r.tablename, v_check
        );
      ELSE
        v_skip := v_skip + 1;
        CONTINUE;
      END IF;

      v_ok := v_ok + 1;
      RAISE NOTICE '✓ [050] auth.role() wrapped: %.% (%)', r.tablename, r.policyname, r.cmd;
    EXCEPTION WHEN OTHERS THEN
      v_fail := v_fail + 1;
      RAISE WARNING '[050] ✗ auth.role() — could not optimize %.% (%): %',
        r.tablename, r.policyname, r.cmd, SQLERRM;
    END;
  END LOOP;

  RAISE NOTICE '[050] Pass 1 auth.role(): optimized=%, skipped=%, failed=%',
    v_ok, v_skip, v_fail;

  IF v_fail > 0 THEN
    RAISE WARNING '[050] % auth.role() policy/policies could not be optimized', v_fail;
  END IF;
END;
$$;

-- ═══════════════════════════════════════════════════════════════════════════════
-- Pass 2: Fix bare auth.email() in public schema RLS policies
-- ═══════════════════════════════════════════════════════════════════════════════

DO $$
DECLARE
  r          RECORD;
  v_ok       int := 0;
  v_skip     int := 0;
  v_fail     int := 0;
  v_qual     text;
  v_check    text;
  c_ph       CONSTANT text := '<<AUTH_EMAIL_ALREADY_WRAPPED>>';
BEGIN
  FOR r IN
    SELECT p.policyname, p.tablename, p.cmd, p.qual, p.with_check
    FROM pg_policies p
    WHERE p.schemaname = 'public'
      AND (
        (p.qual       IS NOT NULL
          AND p.qual       LIKE '%auth.email()%'
          AND p.qual       NOT LIKE '%(SELECT auth.email())%')
        OR
        (p.with_check IS NOT NULL
          AND p.with_check LIKE '%auth.email()%'
          AND p.with_check NOT LIKE '%(SELECT auth.email())%')
      )
    ORDER BY p.tablename, p.policyname
  LOOP
    v_qual  := replace(r.qual,       '(SELECT auth.email())', c_ph);
    v_check := replace(r.with_check, '(SELECT auth.email())', c_ph);

    v_qual  := replace(v_qual,  'auth.email()', '(SELECT auth.email())');
    v_check := replace(v_check, 'auth.email()', '(SELECT auth.email())');

    v_qual  := replace(v_qual,  c_ph, '(SELECT auth.email())');
    v_check := replace(v_check, c_ph, '(SELECT auth.email())');

    BEGIN
      IF r.qual IS NOT NULL AND r.with_check IS NOT NULL THEN
        EXECUTE format(
          'ALTER POLICY %I ON public.%I USING (%s) WITH CHECK (%s)',
          r.policyname, r.tablename, v_qual, v_check
        );
      ELSIF r.qual IS NOT NULL THEN
        EXECUTE format(
          'ALTER POLICY %I ON public.%I USING (%s)',
          r.policyname, r.tablename, v_qual
        );
      ELSIF r.with_check IS NOT NULL THEN
        EXECUTE format(
          'ALTER POLICY %I ON public.%I WITH CHECK (%s)',
          r.policyname, r.tablename, v_check
        );
      ELSE
        v_skip := v_skip + 1;
        CONTINUE;
      END IF;

      v_ok := v_ok + 1;
      RAISE NOTICE '✓ [050] auth.email() wrapped: %.% (%)', r.tablename, r.policyname, r.cmd;
    EXCEPTION WHEN OTHERS THEN
      v_fail := v_fail + 1;
      RAISE WARNING '[050] ✗ auth.email() — could not optimize %.% (%): %',
        r.tablename, r.policyname, r.cmd, SQLERRM;
    END;
  END LOOP;

  RAISE NOTICE '[050] Pass 2 auth.email(): optimized=%, skipped=%, failed=%',
    v_ok, v_skip, v_fail;

  IF v_fail > 0 THEN
    RAISE WARNING '[050] % auth.email() policy/policies could not be optimized', v_fail;
  END IF;
END;
$$;

-- ═══════════════════════════════════════════════════════════════════════════════
-- Pass 3: Fix bare auth.jwt() in public schema RLS policies
-- ═══════════════════════════════════════════════════════════════════════════════
--
-- auth.jwt() is typically used as:
--   auth.jwt() ->> 'key'     (text extraction)
--   auth.jwt() -> 'key'      (json extraction)
-- Wrapping auth.jwt() → (SELECT auth.jwt()) covers both operators correctly.

DO $$
DECLARE
  r          RECORD;
  v_ok       int := 0;
  v_skip     int := 0;
  v_fail     int := 0;
  v_qual     text;
  v_check    text;
  c_ph       CONSTANT text := '<<AUTH_JWT_ALREADY_WRAPPED>>';
BEGIN
  FOR r IN
    SELECT p.policyname, p.tablename, p.cmd, p.qual, p.with_check
    FROM pg_policies p
    WHERE p.schemaname = 'public'
      AND (
        (p.qual       IS NOT NULL
          AND p.qual       LIKE '%auth.jwt()%'
          AND p.qual       NOT LIKE '%(SELECT auth.jwt())%')
        OR
        (p.with_check IS NOT NULL
          AND p.with_check LIKE '%auth.jwt()%'
          AND p.with_check NOT LIKE '%(SELECT auth.jwt())%')
      )
    ORDER BY p.tablename, p.policyname
  LOOP
    v_qual  := replace(r.qual,       '(SELECT auth.jwt())', c_ph);
    v_check := replace(r.with_check, '(SELECT auth.jwt())', c_ph);

    v_qual  := replace(v_qual,  'auth.jwt()', '(SELECT auth.jwt())');
    v_check := replace(v_check, 'auth.jwt()', '(SELECT auth.jwt())');

    v_qual  := replace(v_qual,  c_ph, '(SELECT auth.jwt())');
    v_check := replace(v_check, c_ph, '(SELECT auth.jwt())');

    BEGIN
      IF r.qual IS NOT NULL AND r.with_check IS NOT NULL THEN
        EXECUTE format(
          'ALTER POLICY %I ON public.%I USING (%s) WITH CHECK (%s)',
          r.policyname, r.tablename, v_qual, v_check
        );
      ELSIF r.qual IS NOT NULL THEN
        EXECUTE format(
          'ALTER POLICY %I ON public.%I USING (%s)',
          r.policyname, r.tablename, v_qual
        );
      ELSIF r.with_check IS NOT NULL THEN
        EXECUTE format(
          'ALTER POLICY %I ON public.%I WITH CHECK (%s)',
          r.policyname, r.tablename, v_check
        );
      ELSE
        v_skip := v_skip + 1;
        CONTINUE;
      END IF;

      v_ok := v_ok + 1;
      RAISE NOTICE '✓ [050] auth.jwt() wrapped: %.% (%)', r.tablename, r.policyname, r.cmd;
    EXCEPTION WHEN OTHERS THEN
      v_fail := v_fail + 1;
      RAISE WARNING '[050] ✗ auth.jwt() — could not optimize %.% (%): %',
        r.tablename, r.policyname, r.cmd, SQLERRM;
    END;
  END LOOP;

  RAISE NOTICE '[050] Pass 3 auth.jwt(): optimized=%, skipped=%, failed=%',
    v_ok, v_skip, v_fail;

  IF v_fail > 0 THEN
    RAISE WARNING '[050] % auth.jwt() policy/policies could not be optimized', v_fail;
  END IF;
END;
$$;

-- ═══════════════════════════════════════════════════════════════════════════════
-- Validation: Confirm no remaining bare auth.role/email/jwt() in public policies
-- ═══════════════════════════════════════════════════════════════════════════════

DO $$
DECLARE
  v_bare_role   int;
  v_bare_email  int;
  v_bare_jwt    int;
  v_total       int;
  r             RECORD;
BEGIN
  SELECT count(*) INTO v_bare_role
  FROM pg_policies
  WHERE schemaname = 'public'
    AND (
      (qual       LIKE '%auth.role()%'  AND qual       NOT LIKE '%(SELECT auth.role())%')
      OR
      (with_check LIKE '%auth.role()%'  AND with_check NOT LIKE '%(SELECT auth.role())%')
    );

  SELECT count(*) INTO v_bare_email
  FROM pg_policies
  WHERE schemaname = 'public'
    AND (
      (qual       LIKE '%auth.email()%' AND qual       NOT LIKE '%(SELECT auth.email())%')
      OR
      (with_check LIKE '%auth.email()%' AND with_check NOT LIKE '%(SELECT auth.email())%')
    );

  SELECT count(*) INTO v_bare_jwt
  FROM pg_policies
  WHERE schemaname = 'public'
    AND (
      (qual       LIKE '%auth.jwt()%'   AND qual       NOT LIKE '%(SELECT auth.jwt())%')
      OR
      (with_check LIKE '%auth.jwt()%'   AND with_check NOT LIKE '%(SELECT auth.jwt())%')
    );

  v_total := v_bare_role + v_bare_email + v_bare_jwt;

  IF v_total = 0 THEN
    RAISE NOTICE '✓ [050] All auth.role/email/jwt() calls are now wrapped — auth_rls_initplan cleared for these functions';
  ELSE
    RAISE NOTICE '[050] Remaining bare calls: auth.role()=%, auth.email()=%, auth.jwt()=%',
      v_bare_role, v_bare_email, v_bare_jwt;

    -- Log remaining offenders
    FOR r IN
      SELECT tablename, policyname, cmd,
        CASE WHEN qual LIKE '%auth.role()%' AND qual NOT LIKE '%(SELECT auth.role())%'
             THEN 'auth.role() in qual'
             WHEN with_check LIKE '%auth.role()%' AND with_check NOT LIKE '%(SELECT auth.role())%'
             THEN 'auth.role() in with_check'
             WHEN qual LIKE '%auth.email()%' AND qual NOT LIKE '%(SELECT auth.email())%'
             THEN 'auth.email() in qual'
             WHEN with_check LIKE '%auth.email()%' AND with_check NOT LIKE '%(SELECT auth.email())%'
             THEN 'auth.email() in with_check'
             WHEN qual LIKE '%auth.jwt()%' AND qual NOT LIKE '%(SELECT auth.jwt())%'
             THEN 'auth.jwt() in qual'
             WHEN with_check LIKE '%auth.jwt()%' AND with_check NOT LIKE '%(SELECT auth.jwt())%'
             THEN 'auth.jwt() in with_check'
             ELSE 'unknown'
        END AS issue
      FROM pg_policies
      WHERE schemaname = 'public'
        AND (
          (qual       LIKE '%auth.role()%'  AND qual       NOT LIKE '%(SELECT auth.role())%')
          OR (with_check LIKE '%auth.role()%'  AND with_check NOT LIKE '%(SELECT auth.role())%')
          OR (qual       LIKE '%auth.email()%' AND qual       NOT LIKE '%(SELECT auth.email())%')
          OR (with_check LIKE '%auth.email()%' AND with_check NOT LIKE '%(SELECT auth.email())%')
          OR (qual       LIKE '%auth.jwt()%'   AND qual       NOT LIKE '%(SELECT auth.jwt())%')
          OR (with_check LIKE '%auth.jwt()%'   AND with_check NOT LIKE '%(SELECT auth.jwt())%')
        )
      ORDER BY tablename, policyname
    LOOP
      RAISE WARNING '[050] Still bare: %.% (%) — %',
        r.tablename, r.policyname, r.cmd, r.issue;
    END LOOP;
  END IF;

  -- Combined check with auth.uid() (from migration 045) to confirm full coverage
  DECLARE
    v_bare_uid int;
  BEGIN
    SELECT count(*) INTO v_bare_uid
    FROM pg_policies
    WHERE schemaname = 'public'
      AND (
        (qual       LIKE '%auth.uid()%'  AND qual       NOT LIKE '%(SELECT auth.uid())%')
        OR
        (with_check LIKE '%auth.uid()%'  AND with_check NOT LIKE '%(SELECT auth.uid())%')
      );

    RAISE NOTICE '[050] Post-050 bare auth.* summary: uid=%, role=%, email=%, jwt=%',
      v_bare_uid, v_bare_role, v_bare_email, v_bare_jwt;

    IF (v_bare_uid + v_total) = 0 THEN
      RAISE NOTICE '✓ [050] ALL auth.* functions wrapped in all public policies — auth_rls_initplan fully cleared';
    END IF;
  END;

  RAISE NOTICE 'Migration 050 complete.';
END;
$$;
