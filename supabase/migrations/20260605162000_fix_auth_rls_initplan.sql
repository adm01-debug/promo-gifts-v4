
-- ════════════════════════════════════════════════════════════════
-- Performance fix: auth_rls_initplan — replace bare auth.uid()
-- with (SELECT auth.uid()) so PostgreSQL caches it per-statement
-- instead of re-evaluating per row. Affects 8 hot tables.
-- ════════════════════════════════════════════════════════════════

-- ── access_blocked_log ───────────────────────────────────────
DROP POLICY IF EXISTS access_blocked_log_admin_read   ON public.access_blocked_log;
DROP POLICY IF EXISTS access_blocked_log_admin_insert ON public.access_blocked_log;
CREATE POLICY access_blocked_log_admin_read   ON public.access_blocked_log
  FOR SELECT TO authenticated USING (is_admin_or_above((SELECT auth.uid())));
CREATE POLICY access_blocked_log_admin_insert ON public.access_blocked_log
  FOR INSERT TO authenticated WITH CHECK (is_admin_or_above((SELECT auth.uid())));

-- ── catalog_analytics ────────────────────────────────────────
DROP POLICY IF EXISTS users_read_own_analytics   ON public.catalog_analytics;
DROP POLICY IF EXISTS users_insert_own_analytics ON public.catalog_analytics;
CREATE POLICY users_read_own_analytics   ON public.catalog_analytics
  FOR SELECT TO authenticated USING ((SELECT auth.uid()) = user_id);
CREATE POLICY users_insert_own_analytics ON public.catalog_analytics
  FOR INSERT TO authenticated WITH CHECK ((SELECT auth.uid()) = user_id);

-- ── navigation_analytics ─────────────────────────────────────
DROP POLICY IF EXISTS users_read_own_nav_analytics   ON public.navigation_analytics;
DROP POLICY IF EXISTS users_insert_own_nav_analytics ON public.navigation_analytics;
CREATE POLICY users_read_own_nav_analytics   ON public.navigation_analytics
  FOR SELECT TO authenticated USING ((SELECT auth.uid()) = user_id);
CREATE POLICY users_insert_own_nav_analytics ON public.navigation_analytics
  FOR INSERT TO authenticated WITH CHECK ((SELECT auth.uid()) = user_id);

-- ── personalization_simulations ──────────────────────────────
DROP POLICY IF EXISTS "Sellers can manage own simulations" ON public.personalization_simulations;
DROP POLICY IF EXISTS persim_delete_own_or_admin           ON public.personalization_simulations;
DROP POLICY IF EXISTS persim_insert_own                    ON public.personalization_simulations;
DROP POLICY IF EXISTS persim_select_own_or_supervisor      ON public.personalization_simulations;
DROP POLICY IF EXISTS persim_update_own_or_admin           ON public.personalization_simulations;
CREATE POLICY persim_select_own_or_supervisor ON public.personalization_simulations
  FOR SELECT TO authenticated
  USING ((seller_id = (SELECT auth.uid())) OR is_supervisor_or_above((SELECT auth.uid())));
CREATE POLICY persim_insert_own ON public.personalization_simulations
  FOR INSERT TO authenticated WITH CHECK (seller_id = (SELECT auth.uid()));
CREATE POLICY persim_update_own_or_admin ON public.personalization_simulations
  FOR UPDATE TO authenticated
  USING ((seller_id = (SELECT auth.uid())) OR is_admin_or_above((SELECT auth.uid())))
  WITH CHECK ((seller_id = (SELECT auth.uid())) OR is_admin_or_above((SELECT auth.uid())));
CREATE POLICY persim_delete_own_or_admin ON public.personalization_simulations
  FOR DELETE TO authenticated
  USING ((seller_id = (SELECT auth.uid())) OR is_admin_or_above((SELECT auth.uid())));

-- ── sales_goals ──────────────────────────────────────────────
DROP POLICY IF EXISTS sales_goals_admin_read ON public.sales_goals;
DROP POLICY IF EXISTS sales_goals_owner_all  ON public.sales_goals;
CREATE POLICY sales_goals_admin_read ON public.sales_goals
  FOR SELECT TO authenticated USING (is_admin_or_above((SELECT auth.uid())));
CREATE POLICY sales_goals_owner_all ON public.sales_goals
  FOR ALL TO authenticated
  USING (user_id = (SELECT auth.uid()))
  WITH CHECK (user_id = (SELECT auth.uid()));

-- ── user_2fa_settings ────────────────────────────────────────
DROP POLICY IF EXISTS user_2fa_select_own_or_admin ON public.user_2fa_settings;
DROP POLICY IF EXISTS user_2fa_insert_own_or_admin ON public.user_2fa_settings;
DROP POLICY IF EXISTS user_2fa_update_own_or_admin ON public.user_2fa_settings;
DROP POLICY IF EXISTS user_2fa_delete_own_or_admin ON public.user_2fa_settings;
CREATE POLICY user_2fa_select_own_or_admin ON public.user_2fa_settings
  FOR SELECT TO authenticated
  USING ((user_id = (SELECT auth.uid())) OR is_admin_or_above((SELECT auth.uid())));
CREATE POLICY user_2fa_insert_own_or_admin ON public.user_2fa_settings
  FOR INSERT TO authenticated
  WITH CHECK ((user_id = (SELECT auth.uid())) OR is_admin_or_above((SELECT auth.uid())));
CREATE POLICY user_2fa_update_own_or_admin ON public.user_2fa_settings
  FOR UPDATE TO authenticated
  USING ((user_id = (SELECT auth.uid())) OR is_admin_or_above((SELECT auth.uid())))
  WITH CHECK ((user_id = (SELECT auth.uid())) OR is_admin_or_above((SELECT auth.uid())));
CREATE POLICY user_2fa_delete_own_or_admin ON public.user_2fa_settings
  FOR DELETE TO authenticated
  USING ((user_id = (SELECT auth.uid())) OR is_admin_or_above((SELECT auth.uid())));

-- ── user_allowed_ips ─────────────────────────────────────────
DROP POLICY IF EXISTS user_allowed_ips_select_own_or_admin ON public.user_allowed_ips;
DROP POLICY IF EXISTS user_allowed_ips_insert_own_or_admin ON public.user_allowed_ips;
DROP POLICY IF EXISTS user_allowed_ips_update_own_or_admin ON public.user_allowed_ips;
DROP POLICY IF EXISTS user_allowed_ips_delete_own_or_admin ON public.user_allowed_ips;
CREATE POLICY user_allowed_ips_select_own_or_admin ON public.user_allowed_ips
  FOR SELECT TO authenticated
  USING ((user_id = (SELECT auth.uid())) OR is_admin_or_above((SELECT auth.uid())));
CREATE POLICY user_allowed_ips_insert_own_or_admin ON public.user_allowed_ips
  FOR INSERT TO authenticated
  WITH CHECK ((user_id = (SELECT auth.uid())) OR is_admin_or_above((SELECT auth.uid())));
CREATE POLICY user_allowed_ips_update_own_or_admin ON public.user_allowed_ips
  FOR UPDATE TO authenticated
  USING ((user_id = (SELECT auth.uid())) OR is_admin_or_above((SELECT auth.uid())))
  WITH CHECK ((user_id = (SELECT auth.uid())) OR is_admin_or_above((SELECT auth.uid())));
CREATE POLICY user_allowed_ips_delete_own_or_admin ON public.user_allowed_ips
  FOR DELETE TO authenticated
  USING ((user_id = (SELECT auth.uid())) OR is_admin_or_above((SELECT auth.uid())));

-- ── user_ip_allowlist ────────────────────────────────────────
DROP POLICY IF EXISTS "Admins manage user IP allowlist" ON public.user_ip_allowlist;
DROP POLICY IF EXISTS "Users can read own IP allowlist"  ON public.user_ip_allowlist;
CREATE POLICY "Admins manage user IP allowlist" ON public.user_ip_allowlist
  FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_roles.user_id = (SELECT auth.uid())
      AND user_roles.role = ANY (ARRAY['admin'::app_role, 'dev'::app_role])
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_roles.user_id = (SELECT auth.uid())
      AND user_roles.role = ANY (ARRAY['admin'::app_role, 'dev'::app_role])
  ));
CREATE POLICY "Users can read own IP allowlist" ON public.user_ip_allowlist
  FOR SELECT TO authenticated USING (user_id = (SELECT auth.uid()));
