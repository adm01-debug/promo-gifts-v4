-- Fix user_roles policies
DROP POLICY IF EXISTS "user_roles_select_v1" ON public.user_roles;
CREATE POLICY "user_roles_select_v2" 
ON public.user_roles 
FOR SELECT 
TO authenticated 
USING (true);

DROP POLICY IF EXISTS "user_roles_insert_admin_v1" ON public.user_roles;
CREATE POLICY "user_roles_insert_admin_v2" 
ON public.user_roles 
FOR INSERT 
TO authenticated 
WITH CHECK (is_admin_strict(auth.uid()) OR is_dev(auth.uid()));

DROP POLICY IF EXISTS "user_roles_update_admin_v1" ON public.user_roles;
CREATE POLICY "user_roles_update_admin_v2" 
ON public.user_roles 
FOR UPDATE 
TO authenticated 
USING (is_admin_strict(auth.uid()) OR is_dev(auth.uid()));

DROP POLICY IF EXISTS "user_roles_delete_admin_v1" ON public.user_roles;
CREATE POLICY "user_roles_delete_admin_v2" 
ON public.user_roles 
FOR DELETE 
TO authenticated 
USING (is_admin_strict(auth.uid()) OR is_dev(auth.uid()));

-- Fix order_items policies (Cleanup old versions and consolidate)
DROP POLICY IF EXISTS "order_items_select_v4" ON public.order_items;
DROP POLICY IF EXISTS "order_items_insert_v4" ON public.order_items;
DROP POLICY IF EXISTS "order_items_update_v4" ON public.order_items;
DROP POLICY IF EXISTS "order_items_delete_v4" ON public.order_items;
DROP POLICY IF EXISTS "order_items_select_v6" ON public.order_items;
DROP POLICY IF EXISTS "order_items_insert_v6" ON public.order_items;
DROP POLICY IF EXISTS "order_items_update_v6" ON public.order_items;
DROP POLICY IF EXISTS "order_items_delete_v6" ON public.order_items;

CREATE POLICY "order_items_select_v7" 
ON public.order_items 
FOR SELECT 
TO authenticated 
USING (
  EXISTS (
    SELECT 1 FROM orders o
    WHERE o.id = order_items.order_id
    AND (
      o.seller_id = auth.uid() OR 
      o.client_id = auth.uid() OR 
      o.created_by = auth.uid() OR 
      o.organization_id IN (SELECT organization_id FROM get_user_org_ids(auth.uid())) OR
      can_view_all_sales(auth.uid())
    )
  )
);

CREATE POLICY "order_items_insert_v7" 
ON public.order_items 
FOR INSERT 
TO authenticated 
WITH CHECK (
  EXISTS (
    SELECT 1 FROM orders o
    WHERE o.id = order_items.order_id
    AND (
      o.seller_id = auth.uid() OR 
      o.created_by = auth.uid() OR 
      o.organization_id IN (SELECT organization_id FROM get_user_org_ids(auth.uid()))
    )
  )
);

CREATE POLICY "order_items_update_v7" 
ON public.order_items 
FOR UPDATE 
TO authenticated 
USING (
  EXISTS (
    SELECT 1 FROM orders o
    WHERE o.id = order_items.order_id
    AND (
      o.seller_id = auth.uid() OR 
      o.organization_id IN (SELECT organization_id FROM get_user_org_ids(auth.uid())) OR
      is_admin_strict(auth.uid())
    )
  )
);

CREATE POLICY "order_items_delete_v7" 
ON public.order_items 
FOR DELETE 
TO authenticated 
USING (
  EXISTS (
    SELECT 1 FROM orders o
    WHERE o.id = order_items.order_id
    AND (
      o.seller_id = auth.uid() OR 
      o.organization_id IN (SELECT organization_id FROM get_user_org_ids(auth.uid())) OR
      is_admin_strict(auth.uid())
    )
  )
);

-- Fix admin_audit_log policies
DROP POLICY IF EXISTS "admin_audit_log_read_admin_v4" ON public.admin_audit_log;
CREATE POLICY "admin_audit_log_read_admin_v5" 
ON public.admin_audit_log 
FOR SELECT 
TO authenticated 
USING (is_admin_strict(auth.uid()) OR is_dev(auth.uid()));

DROP POLICY IF EXISTS "admin_audit_log_insert_admin_v4" ON public.admin_audit_log;
CREATE POLICY "admin_audit_log_insert_admin_v5" 
ON public.admin_audit_log 
FOR INSERT 
TO authenticated 
WITH CHECK (is_admin_strict(auth.uid()) OR is_dev(auth.uid()));

GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_roles TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.order_items TO authenticated, service_role;
GRANT SELECT, INSERT ON public.admin_audit_log TO authenticated, service_role;
