-- Fix RLS for admin_audit_log
-- Allow users to see their own logs
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'admin_audit_log' AND policyname = 'admin_audit_log_select_self') THEN
        CREATE POLICY "admin_audit_log_select_self" 
        ON public.admin_audit_log 
        FOR SELECT 
        TO authenticated 
        USING (auth.uid() = user_id);
    END IF;
END $$;

-- Fix RLS for order_items
-- Update policies to include client_id and created_by checks from the parent order
DROP POLICY IF EXISTS "order_items_select_v3" ON public.order_items;
CREATE POLICY "order_items_select_v4" 
ON public.order_items 
FOR SELECT 
TO authenticated 
USING (
  EXISTS (
    SELECT 1 FROM orders o 
    WHERE o.id = order_items.order_id 
    AND (
      o.seller_id = auth.uid() 
      OR o.client_id = auth.uid() 
      OR o.created_by = auth.uid()
      OR o.organization_id IN (SELECT organization_id FROM organization_members WHERE user_id = auth.uid()) 
      OR can_view_all_sales(auth.uid())
    )
  )
);

DROP POLICY IF EXISTS "order_items_insert_v3" ON public.order_items;
CREATE POLICY "order_items_insert_v4" 
ON public.order_items 
FOR INSERT 
TO authenticated 
WITH CHECK (
  EXISTS (
    SELECT 1 FROM orders o 
    WHERE o.id = order_items.order_id 
    AND (
      o.seller_id = auth.uid() 
      OR o.client_id = auth.uid() 
      OR o.created_by = auth.uid()
      OR o.organization_id IN (SELECT organization_id FROM organization_members WHERE user_id = auth.uid()) 
      OR can_view_all_sales(auth.uid())
    )
  )
);

DROP POLICY IF EXISTS "order_items_update_v3" ON public.order_items;
CREATE POLICY "order_items_update_v4" 
ON public.order_items 
FOR UPDATE 
TO authenticated 
USING (
  EXISTS (
    SELECT 1 FROM orders o 
    WHERE o.id = order_items.order_id 
    AND (
      o.seller_id = auth.uid() 
      OR o.client_id = auth.uid() 
      OR o.created_by = auth.uid()
      OR o.organization_id IN (SELECT organization_id FROM organization_members WHERE user_id = auth.uid()) 
      OR can_view_all_sales(auth.uid())
    )
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM orders o 
    WHERE o.id = order_items.order_id 
    AND (
      o.seller_id = auth.uid() 
      OR o.client_id = auth.uid() 
      OR o.created_by = auth.uid()
      OR o.organization_id IN (SELECT organization_id FROM organization_members WHERE user_id = auth.uid()) 
      OR can_view_all_sales(auth.uid())
    )
  )
);

DROP POLICY IF EXISTS "order_items_delete_v3" ON public.order_items;
CREATE POLICY "order_items_delete_v4" 
ON public.order_items 
FOR DELETE 
TO authenticated 
USING (
  EXISTS (
    SELECT 1 FROM orders o 
    WHERE o.id = order_items.order_id 
    AND (
      o.seller_id = auth.uid() 
      OR o.client_id = auth.uid() 
      OR o.created_by = auth.uid()
      OR o.organization_id IN (SELECT organization_id FROM organization_members WHERE user_id = auth.uid()) 
      OR can_view_all_sales(auth.uid())
    )
  )
);

-- Fix RLS for user_roles
-- Ensure isolation and proper platform admin management
DROP POLICY IF EXISTS "user_roles_org_admin_manage" ON public.user_roles;
CREATE POLICY "user_roles_org_admin_manage_v2" 
ON public.user_roles 
FOR ALL 
TO authenticated 
USING (
  is_dev(auth.uid()) OR (
    is_admin_strict(auth.uid()) AND (
      EXISTS (
        SELECT 1 FROM organization_members om_me
        JOIN organization_members om_target ON om_me.organization_id = om_target.organization_id
        WHERE om_me.user_id = auth.uid() 
        AND om_target.user_id = user_roles.user_id
      )
    )
  )
);
