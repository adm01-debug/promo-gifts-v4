-- =============================================================================
-- HARDENING — auditoria de paridade 2026-05-23
-- Fecha advisors NÃO-bloqueadores: function_search_path_mutable,
-- auth_rls_initplan (RLS re-avaliando auth.* por linha) e unindexed_foreign_keys.
-- Todas as mudanças preservam a SEMÂNTICA de acesso — apenas otimizam o plano
-- (initplan caching) e fixam search_path. Nenhuma policy muda QUEM acessa O QUÊ.
-- Aplicada na live como version 20260523135203.
-- =============================================================================

-- 1) search_path imutável (security advisor: function_search_path_mutable)
ALTER FUNCTION public.check_edge_rate_limit(p_key text, p_window_ms integer, p_max_requests integer) SET search_path = public, pg_temp;
ALTER FUNCTION public.cleanup_expired_edge_rate_limits() SET search_path = public, pg_temp;
ALTER FUNCTION public.purge_expired_security_data() SET search_path = public, pg_temp;
ALTER FUNCTION public.cleanup_old_telemetry() SET search_path = public, pg_temp;

-- 2) auth_rls_initplan — envolver auth.uid()/auth.role() em subquery escalar
--    (equivalência semântica exata; avalia 1x por query em vez de por linha)

ALTER POLICY "Service role can do everything on edge_rate_limits" ON public.edge_rate_limits
  USING (((select auth.role()) = 'service_role'::text))
  WITH CHECK (((select auth.role()) = 'service_role'::text));

ALTER POLICY "Admins read all reactions" ON public.favorite_item_reactions
  USING (is_admin((select auth.uid())));

ALTER POLICY "Owners delete own list reactions" ON public.favorite_item_reactions
  USING (EXISTS ( SELECT 1 FROM favorite_lists l WHERE ((l.id = favorite_item_reactions.list_id) AND (l.user_id = (select auth.uid())))));

ALTER POLICY "Owners read own list reactions" ON public.favorite_item_reactions
  USING (EXISTS ( SELECT 1 FROM favorite_lists l WHERE ((l.id = favorite_item_reactions.list_id) AND (l.user_id = (select auth.uid())))));

ALTER POLICY "Sellers can manage own kit share tokens" ON public.kit_share_tokens
  USING ((seller_id = (select auth.uid())))
  WITH CHECK ((seller_id = (select auth.uid())));

ALTER POLICY "Admins can update password reset requests" ON public.password_reset_requests
  USING (EXISTS ( SELECT 1 FROM user_roles WHERE ((user_roles.user_id = (select auth.uid())) AND (user_roles.role = ANY (ARRAY['dev'::app_role, 'supervisor'::app_role, 'admin'::app_role])))));

ALTER POLICY "Admins can view password reset requests" ON public.password_reset_requests
  USING (EXISTS ( SELECT 1 FROM user_roles WHERE ((user_roles.user_id = (select auth.uid())) AND (user_roles.role = ANY (ARRAY['dev'::app_role, 'supervisor'::app_role, 'admin'::app_role])))));

ALTER POLICY "Admins read token failures" ON public.public_token_failures
  USING (is_admin((select auth.uid())));

ALTER POLICY "qatokens_delete_scope" ON public.quote_approval_tokens
  USING ((can_view_all_sales() OR (seller_id = (select auth.uid()))));

ALTER POLICY "qatokens_insert_scope" ON public.quote_approval_tokens
  WITH CHECK ((can_view_all_sales() OR (seller_id = (select auth.uid()))));

ALTER POLICY "qatokens_select_scope" ON public.quote_approval_tokens
  USING ((can_view_all_sales() OR (seller_id = (select auth.uid()))));

ALTER POLICY "qatokens_update_scope" ON public.quote_approval_tokens
  USING ((can_view_all_sales() OR (seller_id = (select auth.uid()))))
  WITH CHECK ((can_view_all_sales() OR (seller_id = (select auth.uid()))));

ALTER POLICY "Admins manage drift allowlist" ON public.schema_drift_allowlist
  USING (EXISTS ( SELECT 1 FROM user_roles WHERE ((user_roles.user_id = (select auth.uid())) AND (user_roles.role = 'admin'::app_role))))
  WITH CHECK (EXISTS ( SELECT 1 FROM user_roles WHERE ((user_roles.user_id = (select auth.uid())) AND (user_roles.role = 'admin'::app_role))));

ALTER POLICY "Admins read schema_drift_log" ON public.schema_drift_log
  USING (is_admin((select auth.uid())));

ALTER POLICY "Users can manage their own devices" ON public.user_known_devices
  USING (((select auth.uid()) = user_id));

ALTER POLICY "Users can view their own devices" ON public.user_known_devices
  USING (((select auth.uid()) = user_id));

-- 3) unindexed_foreign_keys — índices de cobertura
CREATE INDEX IF NOT EXISTS idx_collection_products_product_id ON public.collection_products (product_id);
CREATE INDEX IF NOT EXISTS idx_password_reset_requests_reviewed_by ON public.password_reset_requests (reviewed_by);
CREATE INDEX IF NOT EXISTS idx_password_reset_requests_user_id ON public.password_reset_requests (user_id);
CREATE INDEX IF NOT EXISTS idx_product_price_freshness_overrides_updated_by ON public.product_price_freshness_overrides (updated_by);
CREATE INDEX IF NOT EXISTS idx_quotes_parent_quote_id ON public.quotes (parent_quote_id);
