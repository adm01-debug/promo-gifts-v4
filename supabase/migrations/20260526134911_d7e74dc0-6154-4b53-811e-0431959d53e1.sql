-- Fix user_roles policies
DROP POLICY IF EXISTS "Admins insert roles" ON public.user_roles;
DROP POLICY IF EXISTS "Admins update roles" ON public.user_roles;
DROP POLICY IF EXISTS "Admins delete roles" ON public.user_roles;
DROP POLICY IF EXISTS "user_roles_supervisor_read" ON public.user_roles;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'user_roles' AND policyname = 'user_roles_org_admin_manage'
  ) THEN
    CREATE POLICY "user_roles_org_admin_manage" 
ON public.user_roles 
FOR ALL 
TO authenticated 
USING (
  is_admin_strict(auth.uid()) AND (
    is_dev(auth.uid()) OR 
    EXISTS (
      SELECT 1 FROM public.organization_members om_me
      JOIN public.organization_members om_target ON om_me.organization_id = om_target.organization_id
      WHERE om_me.user_id = auth.uid() AND om_target.user_id = user_roles.user_id
    )
  )
);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'user_roles' AND policyname = 'user_roles_supervisor_read_v2'
  ) THEN
    CREATE POLICY "user_roles_supervisor_read_v2" 
ON public.user_roles 
FOR SELECT 
TO authenticated 
USING (
  is_supervisor_or_above(auth.uid()) AND (
    is_dev(auth.uid()) OR 
    EXISTS (
      SELECT 1 FROM public.organization_members om_me
      JOIN public.organization_members om_target ON om_me.organization_id = om_target.organization_id
      WHERE om_me.user_id = auth.uid() AND om_target.user_id = user_roles.user_id
    )
  )
);
  END IF;
END $$;

-- Fix order_items policies
DROP POLICY IF EXISTS "order_items_select_v2" ON public.order_items;
DROP POLICY IF EXISTS "order_items_manage_v2" ON public.order_items;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'order_items' AND policyname = 'order_items_select_v3'
  ) THEN
    CREATE POLICY "order_items_select_v3" 
ON public.order_items 
FOR SELECT 
TO authenticated 
USING (
  EXISTS (
    SELECT 1 FROM public.orders o
    WHERE o.id = order_items.order_id 
    AND (
      o.seller_id = auth.uid() OR 
      o.organization_id IN (SELECT get_user_org_ids(auth.uid())) OR 
      can_view_all_sales(auth.uid())
    )
  )
);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'order_items' AND policyname = 'order_items_insert_v3'
  ) THEN
    CREATE POLICY "order_items_insert_v3" 
ON public.order_items 
FOR INSERT 
TO authenticated 
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.orders o
    WHERE o.id = order_items.order_id 
    AND (
      o.seller_id = auth.uid() OR 
      o.organization_id IN (SELECT get_user_org_ids(auth.uid())) OR 
      can_view_all_sales(auth.uid())
    )
  )
);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'order_items' AND policyname = 'order_items_update_v3'
  ) THEN
    CREATE POLICY "order_items_update_v3" 
ON public.order_items 
FOR UPDATE 
TO authenticated 
USING (
  EXISTS (
    SELECT 1 FROM public.orders o
    WHERE o.id = order_items.order_id 
    AND (
      o.seller_id = auth.uid() OR 
      o.organization_id IN (SELECT get_user_org_ids(auth.uid())) OR 
      can_view_all_sales(auth.uid())
    )
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.orders o
    WHERE o.id = order_items.order_id 
    AND (
      o.seller_id = auth.uid() OR 
      o.organization_id IN (SELECT get_user_org_ids(auth.uid())) OR 
      can_view_all_sales(auth.uid())
    )
  )
);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'order_items' AND policyname = 'order_items_delete_v3'
  ) THEN
    CREATE POLICY "order_items_delete_v3" 
ON public.order_items 
FOR DELETE 
TO authenticated 
USING (
  EXISTS (
    SELECT 1 FROM public.orders o
    WHERE o.id = order_items.order_id 
    AND (
      o.seller_id = auth.uid() OR 
      o.organization_id IN (SELECT get_user_org_ids(auth.uid())) OR 
      can_view_all_sales(auth.uid())
    )
  )
);
  END IF;
END $$;

-- Fix admin_audit_log policies
DROP POLICY IF EXISTS "admin_audit_log_scoped_read" ON public.admin_audit_log;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'admin_audit_log' AND policyname = 'admin_audit_log_insert_self'
  ) THEN
    CREATE POLICY "admin_audit_log_insert_self" 
ON public.admin_audit_log 
FOR INSERT 
TO authenticated 
WITH CHECK (auth.uid() = user_id OR is_dev(auth.uid()));
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'admin_audit_log' AND policyname = 'admin_audit_log_read_scoped'
  ) THEN
    CREATE POLICY "admin_audit_log_read_scoped" 
ON public.admin_audit_log 
FOR SELECT 
TO authenticated 
USING (
  is_admin_strict(auth.uid()) AND (
    is_dev(auth.uid()) OR 
    EXISTS (
      SELECT 1 FROM public.organization_members om_me
      JOIN public.organization_members om_target ON om_me.organization_id = om_target.organization_id
      WHERE om_me.user_id = auth.uid() AND om_target.user_id = admin_audit_log.user_id
    )
  )
);
  END IF;
END $$;

-- Grants
GRANT ALL ON public.user_roles TO authenticated, service_role;
GRANT ALL ON public.order_items TO authenticated, service_role;
GRANT ALL ON public.admin_audit_log TO authenticated, service_role;
