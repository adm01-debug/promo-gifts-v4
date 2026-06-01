-- Consolidação e reparo das policies de user_roles
DROP POLICY IF EXISTS "Users read own roles" ON public.user_roles;
DROP POLICY IF EXISTS "Users can view own role" ON public.user_roles;
DROP POLICY IF EXISTS "Supervisors read all roles" ON public.user_roles;

CREATE POLICY "user_roles_self_read" ON public.user_roles
    FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "user_roles_supervisor_read" ON public.user_roles
    FOR SELECT TO authenticated USING (is_supervisor_or_above(auth.uid()));

-- Reparo das policies de order_items
DROP POLICY IF EXISTS "Acesso a itens via pedido" ON public.order_items;
DROP POLICY IF EXISTS "order_items_manage_v10" ON public.order_items;

CREATE POLICY "order_items_select_v2" ON public.order_items
    FOR SELECT TO authenticated 
    USING (
        EXISTS (
            SELECT 1 FROM public.orders o 
            WHERE o.id = order_items.order_id 
            AND (
                o.seller_id = auth.uid() 
                OR (o.organization_id IN (SELECT get_user_org_ids(auth.uid())))
                OR can_view_all_sales()
            )
        )
    );

CREATE POLICY "order_items_manage_v2" ON public.order_items
    FOR ALL TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.orders o 
            WHERE o.id = order_items.order_id 
            AND (
                o.seller_id = auth.uid() 
                OR can_view_all_sales()
            )
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.orders o 
            WHERE o.id = order_items.order_id 
            AND (
                o.seller_id = auth.uid() 
                OR can_view_all_sales()
            )
        )
    );

-- Reparo das policies de admin_audit_log para isolamento por organização
DROP POLICY IF EXISTS "Admins can view all audit logs" ON public.admin_audit_log;
DROP POLICY IF EXISTS "Admins can view audit logs" ON public.admin_audit_log;

CREATE POLICY "admin_audit_log_scoped_read" ON public.admin_audit_log
    FOR SELECT TO authenticated
    USING (
        has_role(auth.uid(), 'admin'::app_role) AND (
            -- Admin global (dev) vê tudo
            is_dev(auth.uid())
            OR 
            -- Admin de org vê apenas logs de usuários da sua org
            EXISTS (
                SELECT 1 FROM public.organization_members om
                WHERE om.user_id = admin_audit_log.user_id
                AND om.organization_id IN (SELECT get_user_org_ids(auth.uid()))
            )
        )
    );
