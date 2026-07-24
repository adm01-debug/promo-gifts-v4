-- Repair RLS policies for user_roles, order_items, and admin_audit_log (Corrected)

-- 1. USER_ROLES
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;

DROP POLICY IF EXISTS "user_roles_self_read_v3" ON public.user_roles;
DROP POLICY IF EXISTS "user_roles_supervisor_read_v3" ON public.user_roles;
DROP POLICY IF EXISTS "user_roles_admin_manage_v3" ON public.user_roles;

CREATE POLICY "user_roles_self_read_v4" 
ON public.user_roles FOR SELECT 
TO authenticated 
USING (auth.uid() = user_id);

CREATE POLICY "user_roles_supervisor_read_v4" 
ON public.user_roles FOR SELECT 
TO authenticated 
USING (
  is_supervisor_or_above(auth.uid()) AND 
  (is_dev(auth.uid()) OR EXISTS (
    SELECT 1 FROM organization_members om_me
    JOIN organization_members om_target ON om_me.organization_id = om_target.organization_id
    WHERE om_me.user_id = auth.uid() AND om_target.user_id = user_roles.user_id
  ))
);

CREATE POLICY "user_roles_admin_manage_v4" 
ON public.user_roles FOR ALL 
TO authenticated 
USING (
  is_dev(auth.uid()) OR (
    is_admin_strict(auth.uid()) AND EXISTS (
      SELECT 1 FROM organization_members om_me
      JOIN organization_members om_target ON om_me.organization_id = om_target.organization_id
      WHERE om_me.user_id = auth.uid() AND om_target.user_id = user_roles.user_id
    )
  )
)
WITH CHECK (
  is_dev(auth.uid()) OR (
    is_admin_strict(auth.uid()) AND EXISTS (
      SELECT 1 FROM organization_members om_me
      JOIN organization_members om_target ON om_me.organization_id = om_target.organization_id
      WHERE om_me.user_id = auth.uid() AND om_target.user_id = user_roles.user_id
    )
  )
);

-- 2. ORDER_ITEMS
GRANT SELECT, INSERT, UPDATE, DELETE ON public.order_items TO authenticated;
GRANT ALL ON public.order_items TO service_role;

DROP POLICY IF EXISTS "order_items_select_v5" ON public.order_items;
DROP POLICY IF EXISTS "order_items_insert_v5" ON public.order_items;
DROP POLICY IF EXISTS "order_items_update_v5" ON public.order_items;
DROP POLICY IF EXISTS "order_items_delete_v5" ON public.order_items;

CREATE POLICY "order_items_select_v6" 
ON public.order_items FOR SELECT 
TO authenticated 
USING (
  EXISTS (
    SELECT 1 FROM orders o
    WHERE o.id = order_items.order_id AND (
      o.seller_id = auth.uid() OR 
      o.client_id = auth.uid() OR 
      o.created_by = auth.uid() OR 
      o.organization_id IN (SELECT organization_id FROM get_user_org_ids(auth.uid())) OR 
      can_view_all_sales(auth.uid())
    )
  )
);

CREATE POLICY "order_items_insert_v6" 
ON public.order_items FOR INSERT 
TO authenticated 
WITH CHECK (
  EXISTS (
    SELECT 1 FROM orders o
    WHERE o.id = order_items.order_id AND (
      o.seller_id = auth.uid() OR 
      o.created_by = auth.uid() OR 
      o.organization_id IN (SELECT organization_id FROM get_user_org_ids(auth.uid()))
    )
  )
);

CREATE POLICY "order_items_update_v6" 
ON public.order_items FOR UPDATE 
TO authenticated 
USING (
  EXISTS (
    SELECT 1 FROM orders o
    WHERE o.id = order_items.order_id AND (
      o.seller_id = auth.uid() OR 
      o.organization_id IN (SELECT organization_id FROM get_user_org_ids(auth.uid())) OR
      is_admin_strict(auth.uid())
    )
  )
);

CREATE POLICY "order_items_delete_v6" 
ON public.order_items FOR DELETE 
TO authenticated 
USING (
  EXISTS (
    SELECT 1 FROM orders o
    WHERE o.id = order_items.order_id AND (
      o.seller_id = auth.uid() OR 
      o.organization_id IN (SELECT organization_id FROM get_user_org_ids(auth.uid())) OR
      is_admin_strict(auth.uid())
    )
  )
);

-- 3. ADMIN_AUDIT_LOG
GRANT SELECT, INSERT ON public.admin_audit_log TO authenticated;
GRANT ALL ON public.admin_audit_log TO service_role;

DROP POLICY IF EXISTS "admin_audit_log_read_v2" ON public.admin_audit_log;
DROP POLICY IF EXISTS "admin_audit_log_insert_v2" ON public.admin_audit_log;

CREATE POLICY "admin_audit_log_read_v3" 
ON public.admin_audit_log FOR SELECT 
TO authenticated 
USING (
  is_admin_strict(auth.uid()) OR 
  is_dev(auth.uid()) OR 
  auth.uid() = user_id
);

CREATE POLICY "admin_audit_log_insert_v3" 
ON public.admin_audit_log FOR INSERT 
TO authenticated 
WITH CHECK (
  auth.uid() = user_id OR is_dev(auth.uid())
);
