-- P1 Database hardening OPS-001 + PERF-001 + PERF-002

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'stock_mv_intelligence_refresh') THEN PERFORM cron.unschedule('stock_mv_intelligence_refresh'); END IF;
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'stock_mv_velocity_refresh') THEN PERFORM cron.unschedule('stock_mv_velocity_refresh'); END IF;
END $$;

DROP POLICY IF EXISTS "Admins can insert admin_settings" ON public.admin_settings;
CREATE POLICY "Admins can insert admin_settings" ON public.admin_settings FOR INSERT TO authenticated WITH CHECK (has_role((SELECT auth.uid()), 'admin'::app_role));
DROP POLICY IF EXISTS "Admins can update admin_settings" ON public.admin_settings;
CREATE POLICY "Admins can update admin_settings" ON public.admin_settings FOR UPDATE TO authenticated USING (has_role((SELECT auth.uid()), 'admin'::app_role)) WITH CHECK (has_role((SELECT auth.uid()), 'admin'::app_role));
DROP POLICY IF EXISTS "Admins can view admin_settings" ON public.admin_settings;
CREATE POLICY "Admins can view admin_settings" ON public.admin_settings FOR SELECT TO authenticated USING (has_role((SELECT auth.uid()), 'admin'::app_role));

DROP POLICY IF EXISTS "Users can delete their own cached insights" ON public.ai_insights_cache;
CREATE POLICY "Users can delete their own cached insights" ON public.ai_insights_cache FOR DELETE TO authenticated USING (((SELECT auth.uid()) = user_id) OR has_role((SELECT auth.uid()), 'admin'::app_role));
DROP POLICY IF EXISTS "Users can insert their own cached insights" ON public.ai_insights_cache;
CREATE POLICY "Users can insert their own cached insights" ON public.ai_insights_cache FOR INSERT TO authenticated WITH CHECK ((SELECT auth.uid()) = user_id);
DROP POLICY IF EXISTS "Users can update their own cached insights" ON public.ai_insights_cache;
CREATE POLICY "Users can update their own cached insights" ON public.ai_insights_cache FOR UPDATE TO authenticated USING ((SELECT auth.uid()) = user_id) WITH CHECK ((SELECT auth.uid()) = user_id);
DROP POLICY IF EXISTS "Users can view their own cached insights" ON public.ai_insights_cache;
CREATE POLICY "Users can view their own cached insights" ON public.ai_insights_cache FOR SELECT TO authenticated USING (((SELECT auth.uid()) = user_id) OR has_role((SELECT auth.uid()), 'admin'::app_role));

DROP POLICY IF EXISTS "Users can insert their own usage events" ON public.ai_usage_events;
CREATE POLICY "Users can insert their own usage events" ON public.ai_usage_events FOR INSERT TO authenticated WITH CHECK ((SELECT auth.uid()) = user_id);
DROP POLICY IF EXISTS "Users can view their own usage events" ON public.ai_usage_events;
CREATE POLICY "Users can view their own usage events" ON public.ai_usage_events FOR SELECT TO authenticated USING (((SELECT auth.uid()) = user_id) OR has_role((SELECT auth.uid()), 'admin'::app_role));

DROP POLICY IF EXISTS collection_products_delete ON public.collection_products;
CREATE POLICY collection_products_delete ON public.collection_products FOR DELETE TO authenticated USING (EXISTS (SELECT 1 FROM collections c WHERE c.id = collection_products.collection_id AND c.user_id = (SELECT auth.uid())) OR is_supervisor_or_above((SELECT auth.uid())));
DROP POLICY IF EXISTS collection_products_insert ON public.collection_products;
CREATE POLICY collection_products_insert ON public.collection_products FOR INSERT TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM collections c WHERE c.id = collection_products.collection_id AND c.user_id = (SELECT auth.uid())) OR is_supervisor_or_above((SELECT auth.uid())));
DROP POLICY IF EXISTS collection_products_select ON public.collection_products;
CREATE POLICY collection_products_select ON public.collection_products FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM collections c WHERE c.id = collection_products.collection_id AND (c.user_id = (SELECT auth.uid()) OR c.is_public = true OR c.share_token IS NOT NULL)) OR is_supervisor_or_above((SELECT auth.uid())));
DROP POLICY IF EXISTS collection_products_update ON public.collection_products;
CREATE POLICY collection_products_update ON public.collection_products FOR UPDATE TO authenticated USING (EXISTS (SELECT 1 FROM collections c WHERE c.id = collection_products.collection_id AND c.user_id = (SELECT auth.uid())) OR is_supervisor_or_above((SELECT auth.uid())));

DROP POLICY IF EXISTS "Org admins/owners can insert members" ON public.organization_members;
CREATE POLICY "Org admins/owners can insert members" ON public.organization_members FOR INSERT TO authenticated WITH CHECK (has_org_role((SELECT auth.uid()), organization_id, 'owner'::org_role) OR has_org_role((SELECT auth.uid()), organization_id, 'admin'::org_role) OR (NOT org_has_any_members(organization_id) AND user_id = (SELECT auth.uid()) AND role = 'owner'::org_role));

DROP POLICY IF EXISTS "Users can view their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can insert their own profile" ON public.profiles;
DROP POLICY IF EXISTS profiles_select ON public.profiles;
CREATE POLICY profiles_select ON public.profiles FOR SELECT TO public USING (((SELECT auth.uid()) = id) OR is_admin_or_above((SELECT auth.uid())));
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
DROP POLICY IF EXISTS profiles_update ON public.profiles;
CREATE POLICY profiles_update ON public.profiles FOR UPDATE TO public USING ((SELECT auth.uid()) = id) WITH CHECK ((SELECT auth.uid()) = id);
DROP POLICY IF EXISTS profiles_insert ON public.profiles;
CREATE POLICY profiles_insert ON public.profiles FOR INSERT TO public WITH CHECK ((SELECT auth.uid()) = id);

DROP POLICY IF EXISTS quotes_select_scope ON public.quotes;
CREATE POLICY quotes_select_scope ON public.quotes FOR SELECT TO public USING (user_is_org_member(organization_id) AND (is_coord_or_above((SELECT auth.uid())) OR seller_id = (SELECT auth.uid()) OR created_by = (SELECT auth.uid()) OR assigned_to = (SELECT auth.uid())));
DROP POLICY IF EXISTS quotes_update_scope ON public.quotes;
CREATE POLICY quotes_update_scope ON public.quotes FOR UPDATE TO public USING (user_is_org_member(organization_id) AND (is_coord_or_above((SELECT auth.uid())) OR seller_id = (SELECT auth.uid()) OR created_by = (SELECT auth.uid()) OR assigned_to = (SELECT auth.uid())));
