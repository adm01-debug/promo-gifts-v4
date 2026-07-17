-- Migration 032: Revoke anon SELECT from tables/views where anon has zero legitimate access
--
-- Source: 200-commit audit + post-031 RLS policy analysis
-- Target finding: pg_graphql_anon_table_exposed (currently 188 findings)
--
-- Selection criteria (strict):
--   A) Admin-only views still exposed to anon (missed in migration 028):
--      vw_packaging_health, vw_packaging_suppliers, vw_thermal_products
--      → No src/ frontend references; only in types.ts type definitions.
--      → All three were revoked from authenticated in migration 030 but not from anon.
--
--   B) Tables where RLS returns 0 rows to anon — revoking SELECT is functionally a no-op
--      but removes the pg_graphql_anon_table_exposed advisor flag:
--
--      kit_component_padronizacao:
--        RLS SELECT policy "kcpad_read_auth": USING = (auth.uid() IS NOT NULL)
--        → anon uid = null → 0 rows always. No anon SELECT needed.
--
--      kit_component_variant_skus:
--        RLS policy "admin_only": ALL cmd = is_admin_or_above(auth.uid())
--        No separate SELECT policy → 0 rows for anon.
--
--      kit_variants (user-created kit sizes, not catalog):
--        RLS SELECT policy "Owner can view variants":
--          USING = (EXISTS (SELECT 1 FROM custom_kits k
--                   WHERE k.id = kit_variants.kit_master_id
--                     AND k.user_id = auth.uid())) OR is_admin(auth.uid())
--        → anon uid = null → 0 rows always.
--
-- Objects intentionally NOT touched (explicitly public or via USING = true policy):
--   product_fiscal    → policy "product_fiscal_anon_select" USING = true
--   product_seo       → policy "product_seo_anon_select" USING = true
--   product_supply    → policy "product_supply_anon_select" USING = true
--   ncm_codes         → policy "auth_read_ncm_codes" USING = true
--   product_badge_definitions → policy "pbd_public_read" USING = true
--   ramo_atividade    → policy "ramo_atividade_public_read" USING = true
--   ramo_atividade_filho → policy "ramo_atividade_filho_public_read" USING = true
--   produto_ramo_atividade → policy "produto_ramo_atividade_public_read" USING = true
--   kit_typical_dims  → policy "kit_typical_dims_public_read" USING = true
--   mockup_templates  → policy "mt_select_active_or_admin" allows active templates
--
-- Safety: IF EXISTS via pg_class check. REVOKE on non-existent privilege is a no-op.

DO $$
DECLARE
  obj text;

  -- A) Admin views missed from anon REVOKE in migration 028
  admin_views text[] := ARRAY[
    'vw_packaging_health',
    'vw_packaging_suppliers',
    'vw_thermal_products'
  ];

  -- B) Tables where anon sees 0 rows due to RLS — revoke is functionally safe
  zero_row_tables text[] := ARRAY[
    'kit_component_padronizacao',
    'kit_component_variant_skus',
    'kit_variants'
  ];

BEGIN
  -- Part A: Admin views
  FOREACH obj IN ARRAY admin_views LOOP
    IF EXISTS (
      SELECT 1 FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public' AND c.relname = obj
        AND c.relkind IN ('v', 'm')
    ) THEN
      EXECUTE format('REVOKE SELECT ON public.%I FROM anon', obj);
      RAISE NOTICE '✓ [admin-view] REVOKE SELECT ON public.% FROM anon', obj;
    ELSE
      RAISE NOTICE '- public.% not found — skipping', obj;
    END IF;
  END LOOP;

  -- Part B: Tables with zero-row RLS for anon
  FOREACH obj IN ARRAY zero_row_tables LOOP
    IF EXISTS (
      SELECT 1 FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public' AND c.relname = obj
        AND c.relkind IN ('r', 'p')
    ) THEN
      EXECUTE format('REVOKE SELECT ON public.%I FROM anon', obj);
      RAISE NOTICE '✓ [zero-row-rls] REVOKE SELECT ON public.% FROM anon', obj;
    ELSE
      RAISE NOTICE '- public.% not found — skipping', obj;
    END IF;
  END LOOP;

  RAISE NOTICE 'Done: anon SELECT revoked from admin views + zero-row-RLS tables.';
END;
$$;

-- ─── Validation ───────────────────────────────────────────────────────────────
DO $$
DECLARE
  obj text;
  still_exposed text[] := ARRAY[]::text[];
  sample text[] := ARRAY[
    'vw_packaging_health',
    'vw_packaging_suppliers',
    'vw_thermal_products',
    'kit_component_padronizacao',
    'kit_component_variant_skus',
    'kit_variants'
  ];
  has_select boolean;
BEGIN
  FOREACH obj IN ARRAY sample LOOP
    SELECT EXISTS (
      SELECT 1 FROM information_schema.role_table_grants
      WHERE table_schema = 'public'
        AND table_name = obj
        AND grantee = 'anon'
        AND privilege_type = 'SELECT'
    ) INTO has_select;
    IF has_select THEN
      still_exposed := still_exposed || obj;
    END IF;
  END LOOP;

  IF array_length(still_exposed, 1) > 0 THEN
    RAISE WARNING 'anon SELECT still present on: %', array_to_string(still_exposed, ', ');
  ELSE
    RAISE NOTICE '✓ Validation OK: all 6 targets no longer expose SELECT to anon';
  END IF;

  RAISE NOTICE 'Migration 032 complete.';
END;
$$;
