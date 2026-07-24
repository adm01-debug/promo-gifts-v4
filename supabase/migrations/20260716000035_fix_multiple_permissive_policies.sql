-- Migration 035: Consolidate multiple permissive RLS policies
--
-- Source: 200-commit audit + performance advisor finding
-- Target finding: multiple_permissive_policies (19 findings across 9 tables)
--
-- Root cause: Tables have two or more PERMISSIVE policies applying to the same
-- role + command (SELECT), causing PostgreSQL to evaluate all of them via OR.
-- While functionally correct, this forces extra predicate evaluation per row.
--
-- Strategy per pattern:
--
--   Pattern A — FOR ALL (admin) overlaps FOR SELECT (read):
--     Fix: Drop FOR ALL, recreate as 3 separate FOR INSERT / FOR UPDATE / FOR DELETE.
--     The existing SELECT policy covers admin reads (admins ARE authenticated).
--     Tables: kit_component_enrichment_raw, kit_component_padronizacao,
--             color_synonym_map, product_qa_image_alerts, qa_image_coverage_log
--
--   Pattern B — Two FOR SELECT policies for different access paths:
--     Fix: Merge both SELECT conditions into a single policy with OR.
--     Tables: collection_items, magazine_templates, magazines
--
--   Pattern C — FOR SELECT TO public overlaps FOR SELECT TO authenticated:
--     Fix: Change the public policy to TO anon to eliminate overlap.
--     Tables: product_attributes
--
-- Safety: DROP POLICY IF EXISTS is idempotent. All operations wrapped in
-- DO blocks with table existence checks.

-- ═══════════════════════════════════════════════════════════════════════════════
-- Pattern A: Split FOR ALL admin policies into write-only (INSERT/UPDATE/DELETE)
-- ═══════════════════════════════════════════════════════════════════════════════

-- ─── 1) kit_component_enrichment_raw ────────────────────────────────────────
-- kcer_admin_all (ALL/public) overlaps kcer_read_auth (SELECT/public)
-- Fix: Drop kcer_admin_all; add write-only admin policies.
-- Admins can still SELECT via kcer_read_auth (uid IS NOT NULL).
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
             WHERE n.nspname = 'public' AND c.relname = 'kit_component_enrichment_raw') THEN
    DROP POLICY IF EXISTS kcer_admin_all ON public.kit_component_enrichment_raw;

    CREATE POLICY kcer_admin_insert ON public.kit_component_enrichment_raw
      FOR INSERT TO public
      WITH CHECK (is_admin_or_above((SELECT auth.uid())));

    CREATE POLICY kcer_admin_update ON public.kit_component_enrichment_raw
      FOR UPDATE TO public
      USING (is_admin_or_above((SELECT auth.uid())))
      WITH CHECK (is_admin_or_above((SELECT auth.uid())));

    CREATE POLICY kcer_admin_delete ON public.kit_component_enrichment_raw
      FOR DELETE TO public
      USING (is_admin_or_above((SELECT auth.uid())));

    RAISE NOTICE '✓ kit_component_enrichment_raw: split kcer_admin_all → INSERT/UPDATE/DELETE';
  ELSE
    RAISE NOTICE '- kit_component_enrichment_raw not found — skipping';
  END IF;
END;
$$;

-- ─── 2) kit_component_padronizacao ──────────────────────────────────────────
-- kcpad_admin_write (ALL/public) overlaps kcpad_read_auth (SELECT/public)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
             WHERE n.nspname = 'public' AND c.relname = 'kit_component_padronizacao') THEN
    DROP POLICY IF EXISTS kcpad_admin_write ON public.kit_component_padronizacao;

    CREATE POLICY kcpad_admin_insert ON public.kit_component_padronizacao
      FOR INSERT TO public
      WITH CHECK (is_admin_or_above((SELECT auth.uid())));

    CREATE POLICY kcpad_admin_update ON public.kit_component_padronizacao
      FOR UPDATE TO public
      USING (is_admin_or_above((SELECT auth.uid())))
      WITH CHECK (is_admin_or_above((SELECT auth.uid())));

    CREATE POLICY kcpad_admin_delete ON public.kit_component_padronizacao
      FOR DELETE TO public
      USING (is_admin_or_above((SELECT auth.uid())));

    RAISE NOTICE '✓ kit_component_padronizacao: split kcpad_admin_write → INSERT/UPDATE/DELETE';
  ELSE
    RAISE NOTICE '- kit_component_padronizacao not found — skipping';
  END IF;
END;
$$;

-- ─── 3) color_synonym_map ───────────────────────────────────────────────────
-- csm_write_admin (ALL/authenticated) overlaps csm_read_authenticated (SELECT/authenticated)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
             WHERE n.nspname = 'public' AND c.relname = 'color_synonym_map') THEN
    DROP POLICY IF EXISTS csm_write_admin ON public.color_synonym_map;

    CREATE POLICY csm_admin_insert ON public.color_synonym_map
      FOR INSERT TO authenticated
      WITH CHECK (is_admin_or_above((SELECT auth.uid())));

    CREATE POLICY csm_admin_update ON public.color_synonym_map
      FOR UPDATE TO authenticated
      USING (is_admin_or_above((SELECT auth.uid())))
      WITH CHECK (is_admin_or_above((SELECT auth.uid())));

    CREATE POLICY csm_admin_delete ON public.color_synonym_map
      FOR DELETE TO authenticated
      USING (is_admin_or_above((SELECT auth.uid())));

    RAISE NOTICE '✓ color_synonym_map: split csm_write_admin → INSERT/UPDATE/DELETE';
  ELSE
    RAISE NOTICE '- color_synonym_map not found — skipping';
  END IF;
END;
$$;

-- ─── 4) product_qa_image_alerts ─────────────────────────────────────────────
-- qa_alerts_write_admin (ALL/authenticated) overlaps qa_alerts_read_authenticated (SELECT/authenticated)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
             WHERE n.nspname = 'public' AND c.relname = 'product_qa_image_alerts') THEN
    DROP POLICY IF EXISTS qa_alerts_write_admin ON public.product_qa_image_alerts;

    CREATE POLICY qa_alerts_admin_insert ON public.product_qa_image_alerts
      FOR INSERT TO authenticated
      WITH CHECK (is_admin_or_above((SELECT auth.uid())));

    CREATE POLICY qa_alerts_admin_update ON public.product_qa_image_alerts
      FOR UPDATE TO authenticated
      USING (is_admin_or_above((SELECT auth.uid())))
      WITH CHECK (is_admin_or_above((SELECT auth.uid())));

    CREATE POLICY qa_alerts_admin_delete ON public.product_qa_image_alerts
      FOR DELETE TO authenticated
      USING (is_admin_or_above((SELECT auth.uid())));

    RAISE NOTICE '✓ product_qa_image_alerts: split qa_alerts_write_admin → INSERT/UPDATE/DELETE';
  ELSE
    RAISE NOTICE '- product_qa_image_alerts not found — skipping';
  END IF;
END;
$$;

-- ─── 5) qa_image_coverage_log ───────────────────────────────────────────────
-- qa_coverage_write_admin (ALL/authenticated) overlaps qa_coverage_read_authenticated (SELECT/authenticated)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
             WHERE n.nspname = 'public' AND c.relname = 'qa_image_coverage_log') THEN
    DROP POLICY IF EXISTS qa_coverage_write_admin ON public.qa_image_coverage_log;

    CREATE POLICY qa_coverage_admin_insert ON public.qa_image_coverage_log
      FOR INSERT TO authenticated
      WITH CHECK (is_admin_or_above((SELECT auth.uid())));

    CREATE POLICY qa_coverage_admin_update ON public.qa_image_coverage_log
      FOR UPDATE TO authenticated
      USING (is_admin_or_above((SELECT auth.uid())))
      WITH CHECK (is_admin_or_above((SELECT auth.uid())));

    CREATE POLICY qa_coverage_admin_delete ON public.qa_image_coverage_log
      FOR DELETE TO authenticated
      USING (is_admin_or_above((SELECT auth.uid())));

    RAISE NOTICE '✓ qa_image_coverage_log: split qa_coverage_write_admin → INSERT/UPDATE/DELETE';
  ELSE
    RAISE NOTICE '- qa_image_coverage_log not found — skipping';
  END IF;
END;
$$;

-- ═══════════════════════════════════════════════════════════════════════════════
-- Pattern B: Merge two SELECT policies into one with OR
-- ═══════════════════════════════════════════════════════════════════════════════

-- ─── 6) collection_items ────────────────────────────────────────────────────
-- "Public can view items of public collections" (SELECT/public) +
-- collection_items_own_select (SELECT/authenticated) — both match authenticated users
-- Fix: Merge into one SELECT/public policy with OR
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
             WHERE n.nspname = 'public' AND c.relname = 'collection_items') THEN
    DROP POLICY IF EXISTS "Public can view items of public collections" ON public.collection_items;
    DROP POLICY IF EXISTS collection_items_own_select ON public.collection_items;

    CREATE POLICY collection_items_select ON public.collection_items
      FOR SELECT TO public
      USING (
        -- Own collections (auth.uid() returns NULL for anon → this branch is false for anon)
        EXISTS (
          SELECT 1 FROM collections
          WHERE collections.id = collection_items.collection_id
            AND collections.user_id = (SELECT auth.uid())
        )
        -- Public shared collections (accessible to anon and authenticated alike)
        OR EXISTS (
          SELECT 1 FROM collections c
          WHERE c.id = collection_items.collection_id
            AND c.is_public = true
            AND c.share_token IS NOT NULL
            AND (c.share_expires_at IS NULL OR c.share_expires_at > now())
        )
      );

    RAISE NOTICE '✓ collection_items: merged two SELECT policies → collection_items_select';
  ELSE
    RAISE NOTICE '- collection_items not found — skipping';
  END IF;
END;
$$;

-- ─── 7) magazine_templates ───────────────────────────────────────────────────
-- templates_org_read (SELECT/authenticated) + templates_owner_all (ALL/authenticated)
-- Fix: Merge SELECT conditions; split templates_owner_all into write-only policies
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
             WHERE n.nspname = 'public' AND c.relname = 'magazine_templates') THEN
    DROP POLICY IF EXISTS templates_org_read ON public.magazine_templates;
    DROP POLICY IF EXISTS templates_owner_all ON public.magazine_templates;

    -- Unified SELECT: owner OR org-shared member
    CREATE POLICY magazine_templates_select ON public.magazine_templates
      FOR SELECT TO authenticated
      USING (
        owner_id = (SELECT auth.uid())
        OR (
          shared_in_org = true
          AND organization_id IS NOT NULL
          AND EXISTS (
            SELECT 1 FROM organization_members om
            WHERE om.organization_id = magazine_templates.organization_id
              AND om.user_id = (SELECT auth.uid())
          )
        )
      );

    -- Write policies: owner only
    CREATE POLICY magazine_templates_insert ON public.magazine_templates
      FOR INSERT TO authenticated
      WITH CHECK (owner_id = (SELECT auth.uid()));

    CREATE POLICY magazine_templates_update ON public.magazine_templates
      FOR UPDATE TO authenticated
      USING (owner_id = (SELECT auth.uid()))
      WITH CHECK (owner_id = (SELECT auth.uid()));

    CREATE POLICY magazine_templates_delete ON public.magazine_templates
      FOR DELETE TO authenticated
      USING (owner_id = (SELECT auth.uid()));

    RAISE NOTICE '✓ magazine_templates: merged SELECT + split write → 4 policies';
  ELSE
    RAISE NOTICE '- magazine_templates not found — skipping';
  END IF;
END;
$$;

-- ─── 8) magazines ────────────────────────────────────────────────────────────
-- magazines_all (ALL/authenticated) + magazines_org_read (SELECT/authenticated)
-- Fix: Merge SELECT conditions; split write into separate policies
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
             WHERE n.nspname = 'public' AND c.relname = 'magazines') THEN
    DROP POLICY IF EXISTS magazines_all ON public.magazines;
    DROP POLICY IF EXISTS magazines_org_read ON public.magazines;

    -- Unified SELECT: admin OR owner (non-deleted) OR org member (non-deleted)
    CREATE POLICY magazines_select ON public.magazines
      FOR SELECT TO authenticated
      USING (
        has_role((SELECT auth.uid()), 'admin'::app_role)
        OR ((owner_id = (SELECT auth.uid())) AND (deleted_at IS NULL))
        OR (
          organization_id IS NOT NULL
          AND deleted_at IS NULL
          AND EXISTS (
            SELECT 1 FROM organization_members om
            WHERE om.organization_id = magazines.organization_id
              AND om.user_id = (SELECT auth.uid())
          )
        )
      );

    -- Write policies: admin OR owner
    CREATE POLICY magazines_insert ON public.magazines
      FOR INSERT TO authenticated
      WITH CHECK (
        has_role((SELECT auth.uid()), 'admin'::app_role)
        OR owner_id = (SELECT auth.uid())
      );

    CREATE POLICY magazines_update ON public.magazines
      FOR UPDATE TO authenticated
      USING (
        has_role((SELECT auth.uid()), 'admin'::app_role)
        OR ((owner_id = (SELECT auth.uid())) AND (deleted_at IS NULL))
      )
      WITH CHECK (
        has_role((SELECT auth.uid()), 'admin'::app_role)
        OR owner_id = (SELECT auth.uid())
      );

    CREATE POLICY magazines_delete ON public.magazines
      FOR DELETE TO authenticated
      USING (
        has_role((SELECT auth.uid()), 'admin'::app_role)
        OR owner_id = (SELECT auth.uid())
      );

    RAISE NOTICE '✓ magazines: merged SELECT + split write → 4 policies';
  ELSE
    RAISE NOTICE '- magazines not found — skipping';
  END IF;
END;
$$;

-- ═══════════════════════════════════════════════════════════════════════════════
-- Pattern C: Narrow TO public → TO anon to eliminate role overlap
-- ═══════════════════════════════════════════════════════════════════════════════

-- ─── 9) product_attributes ───────────────────────────────────────────────────
-- pa_select_public (SELECT/public: active+visible) overlaps pa_select_authenticated_all (SELECT/authenticated: all)
-- Fix: Replace TO public with TO anon — authenticated users already have full SELECT
--      via pa_select_authenticated_all; anon users get filtered view.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
             WHERE n.nspname = 'public' AND c.relname = 'product_attributes') THEN
    DROP POLICY IF EXISTS pa_select_public ON public.product_attributes;

    CREATE POLICY pa_select_anon ON public.product_attributes
      FOR SELECT TO anon
      USING ((is_active = true) AND (is_visible = true));

    RAISE NOTICE '✓ product_attributes: replaced pa_select_public (TO public) → pa_select_anon (TO anon)';
  ELSE
    RAISE NOTICE '- product_attributes not found — skipping';
  END IF;
END;
$$;

-- ─── Validation ────────────────────────────────────────────────────────────
DO $$
DECLARE
  dropped_still_exists text[] := ARRAY[]::text[];
  check_pairs text[][] := ARRAY[
    ARRAY['kit_component_enrichment_raw', 'kcer_admin_all'],
    ARRAY['kit_component_padronizacao',   'kcpad_admin_write'],
    ARRAY['color_synonym_map',            'csm_write_admin'],
    ARRAY['product_qa_image_alerts',      'qa_alerts_write_admin'],
    ARRAY['qa_image_coverage_log',        'qa_coverage_write_admin'],
    ARRAY['collection_items',             'Public can view items of public collections'],
    ARRAY['collection_items',             'collection_items_own_select'],
    ARRAY['magazine_templates',           'templates_org_read'],
    ARRAY['magazine_templates',           'templates_owner_all'],
    ARRAY['magazines',                    'magazines_all'],
    ARRAY['magazines',                    'magazines_org_read'],
    ARRAY['product_attributes',           'pa_select_public']
  ];
  pair text[];
  still_found boolean;
BEGIN
  FOREACH pair SLICE 1 IN ARRAY check_pairs LOOP
    SELECT EXISTS (
      SELECT 1 FROM pg_policies
      WHERE schemaname = 'public'
        AND tablename = pair[1]
        AND policyname = pair[2]
    ) INTO still_found;
    IF still_found THEN
      dropped_still_exists := dropped_still_exists || (pair[1] || '.' || pair[2]);
    END IF;
  END LOOP;

  IF array_length(dropped_still_exists, 1) > 0 THEN
    RAISE WARNING 'Policies still present after drop: %', array_to_string(dropped_still_exists, ', ');
  ELSE
    RAISE NOTICE '✓ All target policies dropped successfully';
  END IF;

  RAISE NOTICE 'Migration 035 complete — 19 multiple_permissive_policies findings addressed.';
END;
$$;
