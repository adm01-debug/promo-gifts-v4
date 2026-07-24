
-- ════════════════════════════════════════════════════════════════
-- Fixes two categories of RLS advisor warnings:
--
--   1. auth_rls_initplan (9 remaining policies) — replace bare
--      auth.uid() with (SELECT auth.uid()) for per-statement cache.
--
--   2. multiple_permissive_policies (18 findings) — split ALL
--      admin policies into explicit non-SELECT commands where a
--      separate _select_authenticated policy already covers reads,
--      and merge redundant member_read policies superseded by
--      public_read=true.
-- ════════════════════════════════════════════════════════════════

-- ── 1. bitrix_clients ────────────────────────────────────────────
-- Fix initplan: bitrix_clients_write_admin uses bare auth.uid()
-- Fix permissive: ALL overlaps with bitrix_clients_select_authenticated
-- → split into INSERT/UPDATE/DELETE so SELECT has a single policy
DROP POLICY IF EXISTS bitrix_clients_write_admin ON public.bitrix_clients;
CREATE POLICY bitrix_clients_admin_insert ON public.bitrix_clients
  FOR INSERT TO authenticated
  WITH CHECK (is_admin_or_above((SELECT auth.uid())));
CREATE POLICY bitrix_clients_admin_update ON public.bitrix_clients
  FOR UPDATE TO authenticated
  USING (is_admin_or_above((SELECT auth.uid())))
  WITH CHECK (is_admin_or_above((SELECT auth.uid())));
CREATE POLICY bitrix_clients_admin_delete ON public.bitrix_clients
  FOR DELETE TO authenticated
  USING (is_admin_or_above((SELECT auth.uid())));

-- ── 2. companies ─────────────────────────────────────────────────
DROP POLICY IF EXISTS companies_write_admin ON public.companies;
CREATE POLICY companies_admin_insert ON public.companies
  FOR INSERT TO authenticated
  WITH CHECK (is_admin_or_above((SELECT auth.uid())));
CREATE POLICY companies_admin_update ON public.companies
  FOR UPDATE TO authenticated
  USING (is_admin_or_above((SELECT auth.uid())))
  WITH CHECK (is_admin_or_above((SELECT auth.uid())));
CREATE POLICY companies_admin_delete ON public.companies
  FOR DELETE TO authenticated
  USING (is_admin_or_above((SELECT auth.uid())));

-- ── 3. ip_whitelist ──────────────────────────────────────────────
-- Fix initplan only (no separate select policy exists, just fix uid())
DROP POLICY IF EXISTS ip_whitelist_admin_all ON public.ip_whitelist;
CREATE POLICY ip_whitelist_admin_all ON public.ip_whitelist
  FOR ALL TO authenticated
  USING (is_admin_or_above((SELECT auth.uid())))
  WITH CHECK (is_admin_or_above((SELECT auth.uid())));

-- ── 4. city_whitelist ────────────────────────────────────────────
DROP POLICY IF EXISTS city_whitelist_admin_all ON public.city_whitelist;
CREATE POLICY city_whitelist_admin_all ON public.city_whitelist
  FOR ALL TO authenticated
  USING (is_admin_or_above((SELECT auth.uid())))
  WITH CHECK (is_admin_or_above((SELECT auth.uid())));

-- ── 5. roles ─────────────────────────────────────────────────────
DROP POLICY IF EXISTS roles_admin_all ON public.roles;
CREATE POLICY roles_admin_all ON public.roles
  FOR ALL TO authenticated
  USING (is_admin_or_above((SELECT auth.uid())))
  WITH CHECK (is_admin_or_above((SELECT auth.uid())));

-- ── 6. product_group_components ──────────────────────────────────
DROP POLICY IF EXISTS pgcomp_write_admin ON public.product_group_components;
CREATE POLICY pgcomp_admin_insert ON public.product_group_components
  FOR INSERT TO authenticated
  WITH CHECK (is_admin_or_above((SELECT auth.uid())));
CREATE POLICY pgcomp_admin_update ON public.product_group_components
  FOR UPDATE TO authenticated
  USING (is_admin_or_above((SELECT auth.uid())))
  WITH CHECK (is_admin_or_above((SELECT auth.uid())));
CREATE POLICY pgcomp_admin_delete ON public.product_group_components
  FOR DELETE TO authenticated
  USING (is_admin_or_above((SELECT auth.uid())));

-- ── 7. product_group_locations ───────────────────────────────────
DROP POLICY IF EXISTS pgloc_write_admin ON public.product_group_locations;
CREATE POLICY pgloc_admin_insert ON public.product_group_locations
  FOR INSERT TO authenticated
  WITH CHECK (is_admin_or_above((SELECT auth.uid())));
CREATE POLICY pgloc_admin_update ON public.product_group_locations
  FOR UPDATE TO authenticated
  USING (is_admin_or_above((SELECT auth.uid())))
  WITH CHECK (is_admin_or_above((SELECT auth.uid())));
CREATE POLICY pgloc_admin_delete ON public.product_group_locations
  FOR DELETE TO authenticated
  USING (is_admin_or_above((SELECT auth.uid())));

-- ── 8. product_group_location_techniques ─────────────────────────
DROP POLICY IF EXISTS pgloctech_write_admin ON public.product_group_location_techniques;
CREATE POLICY pgloctech_admin_insert ON public.product_group_location_techniques
  FOR INSERT TO authenticated
  WITH CHECK (is_admin_or_above((SELECT auth.uid())));
CREATE POLICY pgloctech_admin_update ON public.product_group_location_techniques
  FOR UPDATE TO authenticated
  USING (is_admin_or_above((SELECT auth.uid())))
  WITH CHECK (is_admin_or_above((SELECT auth.uid())));
CREATE POLICY pgloctech_admin_delete ON public.product_group_location_techniques
  FOR DELETE TO authenticated
  USING (is_admin_or_above((SELECT auth.uid())));

-- ── 9. product_component_location_techniques ─────────────────────
DROP POLICY IF EXISTS pcloctech_write_admin ON public.product_component_location_techniques;
CREATE POLICY pcloctech_admin_insert ON public.product_component_location_techniques
  FOR INSERT TO authenticated
  WITH CHECK (is_admin_or_above((SELECT auth.uid())));
CREATE POLICY pcloctech_admin_update ON public.product_component_location_techniques
  FOR UPDATE TO authenticated
  USING (is_admin_or_above((SELECT auth.uid())))
  WITH CHECK (is_admin_or_above((SELECT auth.uid())));
CREATE POLICY pcloctech_admin_delete ON public.product_component_location_techniques
  FOR DELETE TO authenticated
  USING (is_admin_or_above((SELECT auth.uid())));

-- ── 10. color_variations ─────────────────────────────────────────
-- color_variations_public_read (true) already grants SELECT to all
-- authenticated users, making color_variations_member_read redundant.
-- Removing the redundant member_read policy.
DROP POLICY IF EXISTS color_variations_member_read ON public.color_variations;

-- ── 11. product_materials ────────────────────────────────────────
-- Same pattern: product_materials_public_read (true) supersedes
-- product_materials_member_read for authenticated users.
DROP POLICY IF EXISTS product_materials_member_read ON public.product_materials;

-- ── 12. sales_goals ──────────────────────────────────────────────
-- Drop separate admin SELECT policy; expand owner_all USING to
-- include admins (WITH CHECK stays owner-only to prevent admins
-- from writing goals under other users' ids).
DROP POLICY IF EXISTS sales_goals_admin_read ON public.sales_goals;
DROP POLICY IF EXISTS sales_goals_owner_all  ON public.sales_goals;
CREATE POLICY sales_goals_owner_all ON public.sales_goals
  FOR ALL TO authenticated
  USING ((user_id = (SELECT auth.uid())) OR is_admin_or_above((SELECT auth.uid())))
  WITH CHECK (user_id = (SELECT auth.uid()));

-- ── 13. user_ip_allowlist ────────────────────────────────────────
-- Merge SELECT into one policy; split admin write into explicit ops.
DROP POLICY IF EXISTS "Admins manage user IP allowlist" ON public.user_ip_allowlist;
DROP POLICY IF EXISTS "Users can read own IP allowlist"  ON public.user_ip_allowlist;
CREATE POLICY user_ip_allowlist_select ON public.user_ip_allowlist
  FOR SELECT TO authenticated
  USING (
    (user_id = (SELECT auth.uid()))
    OR EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.user_id = (SELECT auth.uid())
        AND user_roles.role = ANY (ARRAY['admin'::app_role, 'dev'::app_role])
    )
  );
CREATE POLICY user_ip_allowlist_admin_insert ON public.user_ip_allowlist
  FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_roles.user_id = (SELECT auth.uid())
      AND user_roles.role = ANY (ARRAY['admin'::app_role, 'dev'::app_role])
  ));
CREATE POLICY user_ip_allowlist_admin_update ON public.user_ip_allowlist
  FOR UPDATE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_roles.user_id = (SELECT auth.uid())
      AND user_roles.role = ANY (ARRAY['admin'::app_role, 'dev'::app_role])
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_roles.user_id = (SELECT auth.uid())
      AND user_roles.role = ANY (ARRAY['admin'::app_role, 'dev'::app_role])
  ));
CREATE POLICY user_ip_allowlist_admin_delete ON public.user_ip_allowlist
  FOR DELETE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_roles.user_id = (SELECT auth.uid())
      AND user_roles.role = ANY (ARRAY['admin'::app_role, 'dev'::app_role])
  ));

-- ── 14. collections — share token policy ─────────────────────────
-- "Public can view collection by valid share token" applies to the
-- public pseudo-role (all roles incl. authenticated), overlapping
-- with collections_own_select for authenticated users. Restrict it
-- to anon only; authenticated users are covered by collections_own_select.
DROP POLICY IF EXISTS "Public can view collection by valid share token" ON public.collections;
CREATE POLICY collections_anon_shared_view ON public.collections
  FOR SELECT TO anon
  USING (
    (is_public = true)
    AND (share_token IS NOT NULL)
    AND ((share_expires_at IS NULL) OR (share_expires_at > now()))
  );

-- ── 15. ai_description_queue ─────────────────────────────────────
-- ai_queue_admin_write (ALL, public role) overlaps with
-- ai_queue_insert_own_org (INSERT) and ai_queue_org_read (SELECT).
-- Fix: restrict ai_queue_admin_write to UPDATE+DELETE; merge INSERT
-- and SELECT with org membership check already in place.
DROP POLICY IF EXISTS ai_queue_admin_write ON public.ai_description_queue;
CREATE POLICY ai_queue_admin_update ON public.ai_description_queue
  FOR UPDATE TO authenticated
  USING (is_admin_or_above((SELECT auth.uid())))
  WITH CHECK (is_admin_or_above((SELECT auth.uid())));
CREATE POLICY ai_queue_admin_delete ON public.ai_description_queue
  FOR DELETE TO authenticated
  USING (is_admin_or_above((SELECT auth.uid())));
-- Expand INSERT policy to cover admins as well
DROP POLICY IF EXISTS ai_queue_insert_own_org ON public.ai_description_queue;
CREATE POLICY ai_queue_insert_own_org ON public.ai_description_queue
  FOR INSERT TO authenticated
  WITH CHECK (
    is_admin_or_above((SELECT auth.uid()))
    OR (organization_id IN (
      SELECT user_organizations.organization_id
      FROM user_organizations
      WHERE user_organizations.user_id = (SELECT auth.uid())
    ))
  );
-- Expand SELECT policy to cover admins as well
DROP POLICY IF EXISTS ai_queue_org_read ON public.ai_description_queue;
CREATE POLICY ai_queue_org_read ON public.ai_description_queue
  FOR SELECT TO authenticated
  USING (
    is_admin_or_above((SELECT auth.uid()))
    OR (organization_id IN (
      SELECT user_organizations.organization_id
      FROM user_organizations
      WHERE user_organizations.user_id = (SELECT auth.uid())
    ))
  );
