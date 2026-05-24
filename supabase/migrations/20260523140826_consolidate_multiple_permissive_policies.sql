-- =============================================================================
-- Aplicada na live como version 20260523140826.
-- CONSOLIDAÇÃO de multiple_permissive_policies (auditoria 2026-05-23)
-- Reduz overhead de RLS unindo/segmentando policies permissivas redundantes.
-- SEMÂNTICA DE ACESSO PRESERVADA EXATAMENTE em todos os casos (uniões por OR
-- e segmentação de ALL→escrita; leitura inalterada).
-- =============================================================================

-- 1) user_known_devices — a policy SELECT é idêntica à policy ALL (mesma USING).
--    Redundância pura → remove a SELECT; a ALL já cobre SELECT igual.
DROP POLICY IF EXISTS "Users can view their own devices" ON public.user_known_devices;

-- 2) Tipo "admin ALL + leitura true": converte a policy admin-ALL em escrita-só
--    (INSERT/UPDATE/DELETE). SELECT passa a ter só a policy de leitura (true),
--    eliminando a sobreposição. Admin continua com escrita; todos autenticados leem.

-- 2a) component_media
DROP POLICY IF EXISTS "Admins can manage component media" ON public.component_media;
CREATE POLICY "Admins insert component media" ON public.component_media FOR INSERT TO authenticated
  WITH CHECK (has_role((select auth.uid()), 'admin'::app_role));
CREATE POLICY "Admins update component media" ON public.component_media FOR UPDATE TO authenticated
  USING (has_role((select auth.uid()), 'admin'::app_role))
  WITH CHECK (has_role((select auth.uid()), 'admin'::app_role));
CREATE POLICY "Admins delete component media" ON public.component_media FOR DELETE TO authenticated
  USING (has_role((select auth.uid()), 'admin'::app_role));

-- 2b) product_component_locations
DROP POLICY IF EXISTS "Admins manage component locations" ON public.product_component_locations;
CREATE POLICY "Admins insert component locations" ON public.product_component_locations FOR INSERT TO authenticated
  WITH CHECK (has_role((select auth.uid()), 'admin'::app_role));
CREATE POLICY "Admins update component locations" ON public.product_component_locations FOR UPDATE TO authenticated
  USING (has_role((select auth.uid()), 'admin'::app_role))
  WITH CHECK (has_role((select auth.uid()), 'admin'::app_role));
CREATE POLICY "Admins delete component locations" ON public.product_component_locations FOR DELETE TO authenticated
  USING (has_role((select auth.uid()), 'admin'::app_role));

-- 2c) product_components (ALL tinha with_check=null → default=USING para INSERT/UPDATE)
DROP POLICY IF EXISTS "Admins can manage components" ON public.product_components;
CREATE POLICY "Admins insert components" ON public.product_components FOR INSERT TO authenticated
  WITH CHECK (has_role((select auth.uid()), 'admin'::app_role));
CREATE POLICY "Admins update components" ON public.product_components FOR UPDATE TO authenticated
  USING (has_role((select auth.uid()), 'admin'::app_role))
  WITH CHECK (has_role((select auth.uid()), 'admin'::app_role));
CREATE POLICY "Admins delete components" ON public.product_components FOR DELETE TO authenticated
  USING (has_role((select auth.uid()), 'admin'::app_role));

-- 2d) product_group_members
DROP POLICY IF EXISTS "Admins can manage members" ON public.product_group_members;
CREATE POLICY "Admins insert group members" ON public.product_group_members FOR INSERT TO authenticated
  WITH CHECK (has_role((select auth.uid()), 'admin'::app_role));
CREATE POLICY "Admins update group members" ON public.product_group_members FOR UPDATE TO authenticated
  USING (has_role((select auth.uid()), 'admin'::app_role))
  WITH CHECK (has_role((select auth.uid()), 'admin'::app_role));
CREATE POLICY "Admins delete group members" ON public.product_group_members FOR DELETE TO authenticated
  USING (has_role((select auth.uid()), 'admin'::app_role));

-- 2e) product_groups
DROP POLICY IF EXISTS "Admins can manage groups" ON public.product_groups;
CREATE POLICY "Admins insert groups" ON public.product_groups FOR INSERT TO authenticated
  WITH CHECK (has_role((select auth.uid()), 'admin'::app_role));
CREATE POLICY "Admins update groups" ON public.product_groups FOR UPDATE TO authenticated
  USING (has_role((select auth.uid()), 'admin'::app_role))
  WITH CHECK (has_role((select auth.uid()), 'admin'::app_role));
CREATE POLICY "Admins delete groups" ON public.product_groups FOR DELETE TO authenticated
  USING (has_role((select auth.uid()), 'admin'::app_role));

-- 3) favorite_item_reactions — funde as 3 policies SELECT permissivas em uma.
--    União por OR preserva: admin lê tudo; dono lê da sua lista; qualquer um lê
--    de lista compartilhada válida. anon só satisfaz o ramo "shared" (uid nulo).
DROP POLICY IF EXISTS "Admins read all reactions" ON public.favorite_item_reactions;
DROP POLICY IF EXISTS "Owners read own list reactions" ON public.favorite_item_reactions;
DROP POLICY IF EXISTS "Public can read reactions of shared lists" ON public.favorite_item_reactions;
CREATE POLICY "Read reactions: admin, owner or shared list" ON public.favorite_item_reactions FOR SELECT TO anon, authenticated
  USING (
    is_admin((select auth.uid()))
    OR EXISTS ( SELECT 1 FROM favorite_lists l WHERE ((l.id = favorite_item_reactions.list_id) AND (l.user_id = (select auth.uid()))))
    OR EXISTS ( SELECT 1 FROM favorite_lists l WHERE ((l.id = favorite_item_reactions.list_id) AND (l.shared_token IS NOT NULL) AND ((l.shared_expires_at IS NULL) OR (l.shared_expires_at > now()))))
  );

-- 4) organization_members — funde as 2 policies INSERT permissivas em uma.
--    União por OR (org owner/admin, bootstrap do 1º owner, ou admin do sistema).
--    Role {public}: anon não satisfaz nenhum ramo (todos exigem uid válido).
DROP POLICY IF EXISTS "Org admins/owners can insert members" ON public.organization_members;
DROP POLICY IF EXISTS "org_members_admin_insert" ON public.organization_members;
CREATE POLICY "Insert org members: org admin/owner, bootstrap or sys admin" ON public.organization_members FOR INSERT TO public
  WITH CHECK (
    has_org_role((select auth.uid()), organization_id, 'owner'::org_role)
    OR has_org_role((select auth.uid()), organization_id, 'admin'::org_role)
    OR ((NOT org_has_any_members(organization_id)) AND (user_id = (select auth.uid())) AND (role = 'owner'::org_role))
    OR is_admin((select auth.uid()))
  );
