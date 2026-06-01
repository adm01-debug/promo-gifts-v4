-- =============================================================================
-- FIX-004: Replace app.current_org_id (forgeable) with user_belongs_to_org()
-- Bug: Client can SET LOCAL app.current_org_id = '<other-org-uuid>' to access
--      data from other organizations in 5 tables (12 policies total)
-- Applied: 2026-05-26
-- =============================================================================

-- color_groups
DROP POLICY IF EXISTS color_groups_isolation_delete ON public.color_groups;
DROP POLICY IF EXISTS color_groups_isolation_insert ON public.color_groups;
DROP POLICY IF EXISTS color_groups_isolation_update ON public.color_groups;

CREATE POLICY color_groups_insert_own_org
  ON public.color_groups FOR INSERT TO public
  WITH CHECK (user_belongs_to_org(organization_id));

CREATE POLICY color_groups_update_own_org
  ON public.color_groups FOR UPDATE TO public
  USING (user_belongs_to_org(organization_id))
  WITH CHECK (user_belongs_to_org(organization_id));

CREATE POLICY color_groups_delete_own_org
  ON public.color_groups FOR DELETE TO public
  USING (user_belongs_to_org(organization_id));

-- color_nuances
DROP POLICY IF EXISTS color_nuances_isolation ON public.color_nuances;
CREATE POLICY color_nuances_own_org
  ON public.color_nuances FOR ALL TO public
  USING (user_belongs_to_org(organization_id))
  WITH CHECK (user_belongs_to_org(organization_id));

-- color_variations
DROP POLICY IF EXISTS color_variations_isolation ON public.color_variations;
CREATE POLICY color_variations_own_org
  ON public.color_variations FOR ALL TO public
  USING (user_belongs_to_org(organization_id))
  WITH CHECK (user_belongs_to_org(organization_id));

-- material_groups
DROP POLICY IF EXISTS mg_delete ON public.material_groups;
DROP POLICY IF EXISTS mg_insert ON public.material_groups;
DROP POLICY IF EXISTS mg_select ON public.material_groups;
DROP POLICY IF EXISTS mg_update ON public.material_groups;

CREATE POLICY material_groups_select_own_org
  ON public.material_groups FOR SELECT TO public
  USING (user_belongs_to_org(organization_id));
CREATE POLICY material_groups_insert_own_org
  ON public.material_groups FOR INSERT TO public
  WITH CHECK (user_belongs_to_org(organization_id));
CREATE POLICY material_groups_update_own_org
  ON public.material_groups FOR UPDATE TO public
  USING (user_belongs_to_org(organization_id))
  WITH CHECK (user_belongs_to_org(organization_id));
CREATE POLICY material_groups_delete_own_org
  ON public.material_groups FOR DELETE TO public
  USING (user_belongs_to_org(organization_id));

-- product_materials
DROP POLICY IF EXISTS product_materials_isolation ON public.product_materials;
CREATE POLICY product_materials_own_org
  ON public.product_materials FOR ALL TO authenticated
  USING (user_belongs_to_org(organization_id))
  WITH CHECK (user_belongs_to_org(organization_id));
