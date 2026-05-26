-- Drop all existing policies for the target tables to start fresh
DO $$ 
DECLARE 
    pol RECORD;
BEGIN
    FOR pol IN (
        SELECT policyname, tablename 
        FROM pg_policies 
        WHERE tablename IN ('user_roles', 'order_items', 'admin_audit_log')
    ) LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON %I', pol.policyname, pol.tablename);
    END LOOP;
END $$;

-- 1. user_roles Policies
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "user_roles_read_own" 
ON public.user_roles 
FOR SELECT 
TO authenticated 
USING (auth.uid() = user_id);

CREATE POLICY "user_roles_read_org_admin" 
ON public.user_roles 
FOR SELECT 
TO authenticated 
USING (
    is_supervisor_or_above(auth.uid()) AND (
        is_dev(auth.uid()) OR 
        EXISTS (
            SELECT 1 FROM organization_members om_me
            JOIN organization_members om_target ON om_me.organization_id = om_target.organization_id
            WHERE om_me.user_id = auth.uid() AND om_target.user_id = user_roles.user_id
        )
    )
);

CREATE POLICY "user_roles_manage_admin" 
ON public.user_roles 
FOR ALL 
TO authenticated 
USING (
    is_dev(auth.uid()) OR (
        is_admin_strict(auth.uid()) AND 
        EXISTS (
            SELECT 1 FROM organization_members om_me
            JOIN organization_members om_target ON om_me.organization_id = om_target.organization_id
            WHERE om_me.user_id = auth.uid() AND om_target.user_id = user_roles.user_id
        )
    )
)
WITH CHECK (
    is_dev(auth.uid()) OR (
        is_admin_strict(auth.uid()) AND 
        EXISTS (
            SELECT 1 FROM organization_members om_me
            JOIN organization_members om_target ON om_me.organization_id = om_target.organization_id
            WHERE om_me.user_id = auth.uid() AND om_target.user_id = user_roles.user_id
        )
    )
);

-- 2. order_items Policies
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "order_items_select" 
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

CREATE POLICY "order_items_insert" 
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

CREATE POLICY "order_items_modify" 
ON public.order_items 
FOR ALL -- Covers UPDATE and DELETE
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

-- 3. admin_audit_log Policies
ALTER TABLE public.admin_audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admin_audit_log_read" 
ON public.admin_audit_log 
FOR SELECT 
TO authenticated 
USING (is_admin_strict(auth.uid()) OR is_dev(auth.uid()));

CREATE POLICY "admin_audit_log_insert" 
ON public.admin_audit_log 
FOR INSERT 
TO authenticated 
WITH CHECK (is_admin_strict(auth.uid()) OR is_dev(auth.uid()));

-- Grants (ensure access)
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.order_items TO authenticated;
GRANT ALL ON public.order_items TO service_role;

GRANT SELECT, INSERT ON public.admin_audit_log TO authenticated;
GRANT ALL ON public.admin_audit_log TO service_role;
