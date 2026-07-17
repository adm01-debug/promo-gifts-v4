-- Migration 064: Revoke direct anon SELECT on remaining 3 public objects
--
-- Source: 200-commit audit — post-063 ACL inspection
-- Findings addressed: pg_graphql_anon_table_exposed (remaining 3 real hits)
--
-- ─── Root Cause ──────────────────────────────────────────────────────────────
--
-- After migration 063 revoked the PUBLIC SELECT grant:
--   • products and suppliers became clean (anon had only PUBLIC access)
--   • categories, category_icons, v_suppliers_public still have anon access
--
-- Direct ACL inspection reveals explicit grants to anon:
--   categories       → anon=rm/postgres  (SELECT+MAINTAIN directly granted to anon)
--   category_icons   → anon=rm/postgres  (same)
--   v_suppliers_public → anon=rm/postgres  (same)
--
-- These explicit grants survived REVOKE FROM PUBLIC because they are separate
-- ACL entries. The fix is REVOKE SELECT FROM anon (not FROM PUBLIC).
--
-- ─── Safety Analysis ─────────────────────────────────────────────────────────
--
-- • categories: authenticated=arwdxtm (has SELECT) — revoke only affects anon
-- • category_icons: authenticated=rm (has SELECT) — revoke only affects anon
-- • v_suppliers_public: authenticated=rm (has SELECT) — revoke only affects anon
--
-- Auth flow functions (SECURITY DEFINER, run as owner): unaffected.
-- service_role (BYPASSRLS): unaffected.
--
-- ─── Idempotency ─────────────────────────────────────────────────────────────
--
-- REVOKE when grant doesn't exist → no-op in PostgreSQL.

-- ═══════════════════════════════════════════════════════════════════════════════
-- Phase 1: Revoke explicit anon SELECT on the 3 remaining objects
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
      -- REVOKE explicit anon SELECT (direct grant, not via PUBLIC)
      EXECUTE format('REVOKE SELECT ON public.%I FROM anon', r.relname);
      v_ok := v_ok + 1;
      RAISE NOTICE '[064] REVOKE SELECT ON public.% FROM anon (relkind=%)',
        r.relname, r.relkind;
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING '[064] Failed REVOKE on public.%: %', r.relname, SQLERRM;
    END;
  END LOOP;

  IF v_ok = 0 THEN
    RAISE NOTICE '[064] Phase 1: No public objects with anon SELECT found — already clean';
  ELSE
    RAISE NOTICE '[064] Phase 1: Revoked anon SELECT on % object(s)', v_ok;
  END IF;
END;
$$;

-- ═══════════════════════════════════════════════════════════════════════════════
-- Phase 2: Also ensure no PUBLIC grant lingered (belt-and-suspenders)
-- ═══════════════════════════════════════════════════════════════════════════════

DO $$
DECLARE
  r    RECORD;
  v_ok int := 0;
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
      v_ok := v_ok + 1;
      RAISE NOTICE '[064] Belt-and-suspenders: REVOKE FROM PUBLIC on public.%', r.relname;
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING '[064] Failed PUBLIC revoke on public.%: %', r.relname, SQLERRM;
    END;
  END LOOP;

  IF v_ok = 0 THEN
    RAISE NOTICE '[064] Phase 2: No residual PUBLIC grants found';
  ELSE
    RAISE NOTICE '[064] Phase 2: Removed % PUBLIC grant(s)', v_ok;
  END IF;
END;
$$;

-- ═══════════════════════════════════════════════════════════════════════════════
-- Phase 3: Validate
-- ═══════════════════════════════════════════════════════════════════════════════

DO $$
DECLARE
  v_remaining int;
  r           RECORD;
BEGIN
  SELECT count(*) INTO v_remaining
  FROM pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public'
    AND c.relkind IN ('r', 'p', 'v', 'm')
    AND has_table_privilege('anon', c.oid, 'SELECT');

  IF v_remaining = 0 THEN
    RAISE NOTICE '[064] All public relations: anon SELECT fully revoked — pg_graphql_anon_table_exposed (public) CLEARED';
  ELSE
    RAISE WARNING '[064] % public relation(s) still anon-accessible:', v_remaining;
    FOR r IN
      SELECT c.relname, c.relkind
      FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public'
        AND c.relkind IN ('r', 'p', 'v', 'm')
        AND has_table_privilege('anon', c.oid, 'SELECT')
      ORDER BY c.relname
    LOOP
      RAISE WARNING '[064]   still accessible: public.% (relkind=%)', r.relname, r.relkind;
    END LOOP;
  END IF;

  RAISE NOTICE 'Migration 064 complete.';
END;
$$;
