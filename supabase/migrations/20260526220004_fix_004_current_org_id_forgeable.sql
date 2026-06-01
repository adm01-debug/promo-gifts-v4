-- =============================================================================
-- FIX-004: Replace app.current_org_id (forgeable) with user_belongs_to_org()
-- Bug: Client can SET LOCAL app.current_org_id = '<other-org-uuid>' to access
--      data from other organizations in 5 tables (12 policies total)
-- Applied: 2026-05-26
-- Guards: cada bloco verifica se a tabela E a coluna organization_id existem
-- (preview snapshots podem ter as tabelas sem a coluna).
-- =============================================================================

-- color_groups
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='color_groups' AND column_name='organization_id'
  ) THEN
    DROP POLICY IF EXISTS color_groups_isolation_delete ON public.color_groups;
    DROP POLICY IF EXISTS color_groups_isolation_insert ON public.color_groups;
    DROP POLICY IF EXISTS color_groups_isolation_update ON public.color_groups;

    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='color_groups' AND policyname='color_groups_insert_own_org') THEN
      CREATE POLICY color_groups_insert_own_org
        ON public.color_groups FOR INSERT TO public
        WITH CHECK (user_belongs_to_org(organization_id));
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='color_groups' AND policyname='color_groups_update_own_org') THEN
      CREATE POLICY color_groups_update_own_org
        ON public.color_groups FOR UPDATE TO public
        USING (user_belongs_to_org(organization_id))
        WITH CHECK (user_belongs_to_org(organization_id));
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='color_groups' AND policyname='color_groups_delete_own_org') THEN
      CREATE POLICY color_groups_delete_own_org
        ON public.color_groups FOR DELETE TO public
        USING (user_belongs_to_org(organization_id));
    END IF;
  END IF;
END $$;

-- color_nuances
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='color_nuances' AND column_name='organization_id'
  ) THEN
    DROP POLICY IF EXISTS color_nuances_isolation ON public.color_nuances;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='color_nuances' AND policyname='color_nuances_own_org') THEN
      CREATE POLICY color_nuances_own_org
        ON public.color_nuances FOR ALL TO public
        USING (user_belongs_to_org(organization_id))
        WITH CHECK (user_belongs_to_org(organization_id));
    END IF;
  END IF;
END $$;

-- color_variations
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='color_variations' AND column_name='organization_id'
  ) THEN
    DROP POLICY IF EXISTS color_variations_isolation ON public.color_variations;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='color_variations' AND policyname='color_variations_own_org') THEN
      CREATE POLICY color_variations_own_org
        ON public.color_variations FOR ALL TO public
        USING (user_belongs_to_org(organization_id))
        WITH CHECK (user_belongs_to_org(organization_id));
    END IF;
  END IF;
END $$;

-- material_groups
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='material_groups' AND column_name='organization_id'
  ) THEN
    DROP POLICY IF EXISTS mg_delete ON public.material_groups;
    DROP POLICY IF EXISTS mg_insert ON public.material_groups;
    DROP POLICY IF EXISTS mg_select ON public.material_groups;
    DROP POLICY IF EXISTS mg_update ON public.material_groups;

    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='material_groups' AND policyname='material_groups_select_own_org') THEN
      CREATE POLICY material_groups_select_own_org
        ON public.material_groups FOR SELECT TO public
        USING (user_belongs_to_org(organization_id));
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='material_groups' AND policyname='material_groups_insert_own_org') THEN
      CREATE POLICY material_groups_insert_own_org
        ON public.material_groups FOR INSERT TO public
        WITH CHECK (user_belongs_to_org(organization_id));
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='material_groups' AND policyname='material_groups_update_own_org') THEN
      CREATE POLICY material_groups_update_own_org
        ON public.material_groups FOR UPDATE TO public
        USING (user_belongs_to_org(organization_id))
        WITH CHECK (user_belongs_to_org(organization_id));
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='material_groups' AND policyname='material_groups_delete_own_org') THEN
      CREATE POLICY material_groups_delete_own_org
        ON public.material_groups FOR DELETE TO public
        USING (user_belongs_to_org(organization_id));
    END IF;
  END IF;
END $$;

-- product_materials
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='product_materials' AND column_name='organization_id'
  ) THEN
    DROP POLICY IF EXISTS product_materials_isolation ON public.product_materials;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='product_materials' AND policyname='product_materials_own_org') THEN
      CREATE POLICY product_materials_own_org
        ON public.product_materials FOR ALL TO authenticated
        USING (user_belongs_to_org(organization_id))
        WITH CHECK (user_belongs_to_org(organization_id));
    END IF;
  END IF;
END $$;
