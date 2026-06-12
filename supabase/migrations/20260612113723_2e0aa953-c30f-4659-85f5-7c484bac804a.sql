-- Update ai_insights_cache policies
-- Original: SELECT was ((auth.uid() = user_id) OR is_admin(auth.uid()))
DROP POLICY IF EXISTS "Users can view their own cached insights" ON public.ai_insights_cache;
CREATE POLICY "Authenticated users can view all cached insights" ON public.ai_insights_cache
FOR SELECT TO authenticated USING (true);

-- Update saved_trends_views policies
-- Original: ALL was (user_id = auth.uid())
DROP POLICY IF EXISTS "Users manage own saved trends views" ON public.saved_trends_views;

CREATE POLICY "Users can view all saved trends views" ON public.saved_trends_views
FOR SELECT TO authenticated USING (true);

CREATE POLICY "Users can manage their own saved trends views" ON public.saved_trends_views
FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

GRANT SELECT ON public.ai_insights_cache TO authenticated;
GRANT SELECT ON public.saved_trends_views TO authenticated;
