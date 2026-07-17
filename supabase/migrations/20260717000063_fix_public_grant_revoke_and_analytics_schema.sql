-- Migration 063: Fix remaining pg_graphql_anon_table_exposed + security_definer_view
--
-- Source: 200-commit audit — post-062 advisor check
-- Findings addressed:
--   pg_graphql_anon_table_exposed : 9 → 0 (public + analytics schemas)
--   security_definer_view         : 3 → 0 (views missing security_invoker=true)
--
-- ─── Root Causes ─────────────────────────────────────────────────────────────
--
-- 1. PUBLIC grant problem (public schema tables/views):
--    Migrations 060 and 062 used REVOKE FROM anon — a no-op when the privilege
--    came from a PUBLIC grant (=SELECT/postgres in proacl). The tables
--    categories, products, suppliers and views category_icons, v_suppliers_public
--    have PUBLIC SELECT; anon is a member of PUBLIC, so it inherits that access.
--    Fix: REVOKE FROM PUBLIC + GRANT TO authenticated (preserve app access).
--
-- 2. Analytics schema not covered:
--    Migrations 058–062 targeted only public schema. Four materialized views in
--    the analytics schema still have anon SELECT via PUBLIC grants.
--    Fix: dynamic sweep of analytics schema — REVOKE FROM PUBLIC, anon, authenticated.
--
-- 3. security_invoker not set on 3 views:
--    Migration 061 silently failed (EXCEPTION caught) for category_icons,
--    v_suppliers_public, mv_stock_velocity. These still have reloptions=null.
--    Fix for category_icons and v_suppliers_public: CREATE OR REPLACE VIEW WITH
--    (security_invoker = true) using the exact same definition.
--    Fix for mv_stock_velocity: ALTER VIEW with fallback to revoke direct access
--    (wraps analytics.mv_stock_velocity which authenticated cannot access directly).
--
-- ─── Safety Analysis ─────────────────────────────────────────────────────────
--
-- REVOKE FROM PUBLIC + GRANT TO authenticated:
--   • anon loses SELECT (no longer member-of-PUBLIC path) — correct for B2B
--   • authenticated gains explicit SELECT, same effective access as before
--   • service_role (BYPASSRLS) and postgres superuser: unaffected
--   • SECURITY DEFINER functions (run as owner): unaffected
--
-- ALTER DEFAULT PRIVILEGES: prevents future DDL from re-adding PUBLIC SELECT.
--   Only affects future objects; no impact on existing grants.
--
-- CREATE OR REPLACE VIEW preserves existing grants to other roles (authenticated).
--
-- ─── Idempotency ─────────────────────────────────────────────────────────────
--
-- REVOKE when grant doesn't exist → no-op
-- GRANT when already granted → no-op
-- ALTER DEFAULT PRIVILEGES → idempotent
-- CREATE OR REPLACE VIEW → idempotent

-- ═══════════════════════════════════════════════════════════════════════════════
-- Phase 1: ALTER DEFAULT PRIVILEGES — prevent future PUBLIC grants
-- ═══════════════════════════════════════════════════════════════════════════════

ALTER DEFAULT PRIVILEGES IN SCHEMA public
  REVOKE SELECT ON TABLES FROM PUBLIC;

ALTER DEFAULT PRIVILEGES IN SCHEMA analytics
  REVOKE SELECT ON TABLES FROM PUBLIC;

-- ═══════════════════════════════════════════════════════════════════════════════
-- Phase 2: Fix public schema tables with PUBLIC SELECT grants
--          (categories, products, suppliers confirmed still anon-accessible)
-- ═══════════════════════════════════════════════════════════════════════════════

DO $$
DECLARE
  r    RECORD;
  v_ok int := 0;
BEGIN
  FOR r IN
    SELECT c.relname, c.oid
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relkind IN ('r', 'p')
      AND has_table_privilege('anon', c.oid, 'SELECT')
    ORDER BY c.relname
  LOOP
    BEGIN
      EXECUTE format('REVOKE SELECT ON public.%I FROM PUBLIC', r.relname);
      EXECUTE format('GRANT SELECT ON public.%I TO authenticated', r.relname);
      v_ok := v_ok + 1;
      RAISE NOTICE '[063] table public.%: REVOKE FROM PUBLIC + GRANT TO authenticated', r.relname;
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING '[063] table public.%: failed: %', r.relname, SQLERRM;
    END;
  END LOOP;

  IF v_ok = 0 THEN
    RAISE NOTICE '[063] Phase 2: no public tables with anon SELECT found — already clean';
  ELSE
    RAISE NOTICE '[063] Phase 2: fixed % public table(s)', v_ok;
  END IF;
END;
$$;

-- ═══════════════════════════════════════════════════════════════════════════════
-- Phase 3: Fix public schema views with PUBLIC SELECT grants
--          (category_icons, v_suppliers_public confirmed still anon-accessible)
-- ═══════════════════════════════════════════════════════════════════════════════

DO $$
DECLARE
  r    RECORD;
  v_ok int := 0;
BEGIN
  FOR r IN
    SELECT c.relname, c.oid
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relkind = 'v'
      AND has_table_privilege('anon', c.oid, 'SELECT')
    ORDER BY c.relname
  LOOP
    BEGIN
      EXECUTE format('REVOKE SELECT ON public.%I FROM PUBLIC', r.relname);
      EXECUTE format('GRANT SELECT ON public.%I TO authenticated', r.relname);
      v_ok := v_ok + 1;
      RAISE NOTICE '[063] view public.%: REVOKE FROM PUBLIC + GRANT TO authenticated', r.relname;
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING '[063] view public.%: failed: %', r.relname, SQLERRM;
    END;
  END LOOP;

  IF v_ok = 0 THEN
    RAISE NOTICE '[063] Phase 3: no public views with anon SELECT found — already clean';
  ELSE
    RAISE NOTICE '[063] Phase 3: fixed % public view(s)', v_ok;
  END IF;
END;
$$;

-- ═══════════════════════════════════════════════════════════════════════════════
-- Phase 4: Set security_invoker=true on views that still lack it
--          Use CREATE OR REPLACE VIEW (avoids ALTER VIEW silent failure)
-- ═══════════════════════════════════════════════════════════════════════════════

-- 4a: category_icons — queries: SELECT ... FROM categories WHERE icon IS NOT NULL
CREATE OR REPLACE VIEW public.category_icons
  WITH (security_invoker = true)
AS
 SELECT id,
    name AS category_name,
    icon,
    NULL::text AS description,
    is_active
   FROM categories c
  WHERE icon IS NOT NULL;

-- 4b: v_suppliers_public — queries: SELECT ... FROM suppliers
CREATE OR REPLACE VIEW public.v_suppliers_public
  WITH (security_invoker = true)
AS
 SELECT id,
    name,
    code,
    trading_name,
    logo_url,
    website,
    active,
    is_product_supplier,
    is_engraving_supplier,
    state_uf,
    low_stock_threshold
   FROM suppliers;

-- 4c: mv_stock_velocity — wraps analytics.mv_stock_velocity (cross-schema)
--     authenticated cannot SELECT from analytics matviews directly (migration 058)
--     so we try ALTER VIEW; if that fails, revoke direct access as fallback
DO $$
BEGIN
  ALTER VIEW public.mv_stock_velocity SET (security_invoker = true);
  RAISE NOTICE '[063] mv_stock_velocity: SET (security_invoker = true) — ok';
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING '[063] mv_stock_velocity: ALTER VIEW failed (%), revoking direct access', SQLERRM;
  BEGIN
    REVOKE SELECT ON public.mv_stock_velocity FROM PUBLIC, anon, authenticated;
    RAISE NOTICE '[063] mv_stock_velocity: direct access revoked (fallback)';
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING '[063] mv_stock_velocity: fallback revoke also failed: %', SQLERRM;
  END;
END;
$$;

-- 4d: Final sweep — catch any remaining views without security_invoker=true
DO $$
DECLARE
  r      RECORD;
  v_ok   int := 0;
  v_fail int := 0;
BEGIN
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
    BEGIN
      EXECUTE format('ALTER VIEW public.%I SET (security_invoker = true)', r.relname);
      v_ok := v_ok + 1;
      RAISE NOTICE '[063] sweep: SET security_invoker=true on public.%', r.relname;
    EXCEPTION WHEN OTHERS THEN
      v_fail := v_fail + 1;
      RAISE WARNING '[063] sweep: could not set security_invoker on public.%: %',
        r.relname, SQLERRM;
    END;
  END LOOP;

  RAISE NOTICE '[063] Phase 4 sweep: updated=%, failed=%', v_ok, v_fail;
END;
$$;

-- ═══════════════════════════════════════════════════════════════════════════════
-- Phase 5: Analytics schema — revoke direct access from all relations
--          (matviews have no RLS; should only be accessed via SECURITY DEFINER)
-- ═══════════════════════════════════════════════════════════════════════════════

DO $$
DECLARE
  r       RECORD;
  v_ok    int := 0;
  v_clean int := 0;
  v_anon_ok  boolean;
  v_auth_ok  boolean;
BEGIN
  -- Check if analytics schema exists first
  IF NOT EXISTS (
    SELECT 1 FROM pg_namespace WHERE nspname = 'analytics'
  ) THEN
    RAISE NOTICE '[063] analytics schema does not exist — skipping Phase 5';
    RETURN;
  END IF;

  FOR r IN
    SELECT c.relname, c.oid, c.relkind
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'analytics'
      AND c.relkind IN ('r', 'p', 'm', 'v')
    ORDER BY c.relname
  LOOP
    BEGIN
      v_anon_ok := has_table_privilege('anon', r.oid, 'SELECT');
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
      CONTINUE;
    END IF;

    BEGIN
      EXECUTE format(
        'REVOKE SELECT ON analytics.%I FROM PUBLIC, anon, authenticated',
        r.relname
      );
      v_ok := v_ok + 1;
      RAISE NOTICE '[063] analytics.%: revoked (relkind=%)', r.relname, r.relkind;
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING '[063] analytics.%: revoke failed: %', r.relname, SQLERRM;
    END;
  END LOOP;

  RAISE NOTICE '[063] Phase 5: analytics revoked=%, already_clean=%', v_ok, v_clean;
END;
$$;

-- ═══════════════════════════════════════════════════════════════════════════════
-- Phase 6: Validation
-- ═══════════════════════════════════════════════════════════════════════════════

DO $$
DECLARE
  v_anon_public    int;
  v_anon_analytics int;
  v_secdef_views   int;
  r                RECORD;
BEGIN
  SELECT count(*) INTO v_anon_public
  FROM pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public'
    AND c.relkind IN ('r', 'p', 'm', 'v')
    AND has_table_privilege('anon', c.oid, 'SELECT');

  SELECT count(*) INTO v_anon_analytics
  FROM pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'analytics'
    AND c.relkind IN ('r', 'p', 'm', 'v')
    AND has_table_privilege('anon', c.oid, 'SELECT');

  SELECT count(*) INTO v_secdef_views
  FROM pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public'
    AND c.relkind = 'v'
    AND NOT (
      c.reloptions IS NOT NULL
      AND 'security_invoker=true' = ANY(c.reloptions)
    );

  RAISE NOTICE '[063] Validation: public anon=%, analytics anon=%, views_without_securityinvoker=%',
    v_anon_public, v_anon_analytics, v_secdef_views;

  IF v_anon_public = 0 THEN
    RAISE NOTICE '[063] pg_graphql_anon_table_exposed (public): CLEARED';
  ELSE
    RAISE WARNING '[063] % public relation(s) still anon-accessible:', v_anon_public;
    FOR r IN
      SELECT c.relname, c.relkind
      FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public'
        AND c.relkind IN ('r', 'p', 'm', 'v')
        AND has_table_privilege('anon', c.oid, 'SELECT')
      ORDER BY c.relname
    LOOP
      RAISE WARNING '[063]   still accessible: public.% (relkind=%)', r.relname, r.relkind;
    END LOOP;
  END IF;

  IF v_anon_analytics = 0 THEN
    RAISE NOTICE '[063] pg_graphql_anon_table_exposed (analytics): CLEARED';
  ELSE
    RAISE WARNING '[063] % analytics relation(s) still anon-accessible', v_anon_analytics;
  END IF;

  IF v_secdef_views = 0 THEN
    RAISE NOTICE '[063] security_definer_view: CLEARED — all public views have security_invoker=true';
  ELSE
    RAISE WARNING '[063] % public view(s) still missing security_invoker=true', v_secdef_views;
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
      RAISE WARNING '[063]   missing security_invoker: public.%', r.relname;
    END LOOP;
  END IF;

  RAISE NOTICE 'Migration 063 complete.';
END;
$$;
