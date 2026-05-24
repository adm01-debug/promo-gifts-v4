-- ============================================================================
-- P1 Database hardening — OPS-001 + PERF-001 + PERF-002
-- ============================================================================
-- Source: auditoria back-end sênior 2026-05-22 (PR #55, agora mergeado).
--
-- OPS-001 — Cron jobs órfãos:
--   `stock_mv_intelligence_refresh` e `stock_mv_velocity_refresh` referenciam
--   materialized views inexistentes (mv_product_intelligence, mv_stock_velocity).
--   Confirmado em cron.job_run_details: failed ERROR "is not a table or
--   materialized view" toda noite. Como as MVs foram dropadas em alguma
--   migration de recovery, os jobs ficaram órfãos. Drop dos jobs.
--
-- PERF-001 — Auth RLS init-plan:
--   35+ policies em 15 tabelas chamam `auth.uid()` (ou helpers que a recebem
--   como argumento) diretamente, fazendo o Postgres reavaliar a função por
--   linha. Padrão recomendado pela Supabase: `(SELECT auth.uid())` — evaluated
--   uma vez por query via InitPlan. Migração faz DROP+CREATE de cada policy
--   com a forma cached.
--
-- PERF-002 — Multiple permissive policies em `profiles`:
--   Tabela tem 5 policies sobrepostas (legado + novas). Algumas usam `user_id`
--   (coluna nullable, NULL em 9/13 rows = quebrada) e outras `id` (PK NOT NULL,
--   correta). Consolidamos para 3 policies: SELECT, UPDATE, INSERT — todas
--   usando `id`.
--
-- Idempotência: DROP POLICY IF EXISTS + CREATE POLICY em todas as operações.
-- ============================================================================

BEGIN;

-- ============================================================================
-- OPS-001 — Drop orphan cron jobs
-- ============================================================================

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'stock_mv_intelligence_refresh') THEN
    PERFORM cron.unschedule('stock_mv_intelligence_refresh');
  END IF;
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'stock_mv_velocity_refresh') THEN
    PERFORM cron.unschedule('stock_mv_velocity_refresh');
  END IF;
END $$;

-- ============================================================================
-- PERF-001 — Refactor RLS policies to use (SELECT auth.uid())
-- ============================================================================
-- Padrão de fix: `auth.uid()` → `(SELECT auth.uid())`
-- O `has_role(auth.uid(), …)` vira `has_role((SELECT auth.uid()), …)`.
-- O Postgres avalia o subselect uma única vez por query e injeta o resultado
-- como constante no plano — vs. invocação por linha no padrão antigo.
-- ============================================================================

-- admin_settings
DROP POLICY IF EXISTS "Admins can insert admin_settings" ON public.admin_settings;
CREATE POLICY "Admins can insert admin_settings" ON public.admin_settings
  FOR INSERT TO authenticated
  WITH CHECK (has_role((SELECT auth.uid()), 'admin'::app_role));

DROP POLICY IF EXISTS "Admins can update admin_settings" ON public.admin_settings;
CREATE POLICY "Admins can update admin_settings" ON public.admin_settings
  FOR UPDATE TO authenticated
  USING (has_role((SELECT auth.uid()), 'admin'::app_role))
  WITH CHECK (has_role((SELECT auth.uid()), 'admin'::app_role));

DROP POLICY IF EXISTS "Admins can view admin_settings" ON public.admin_settings;
CREATE POLICY "Admins can view admin_settings" ON public.admin_settings
  FOR SELECT TO authenticated
  USING (has_role((SELECT auth.uid()), 'admin'::app_role));

-- ai_insights_cache
DROP POLICY IF EXISTS "Users can delete their own cached insights" ON public.ai_insights_cache;
CREATE POLICY "Users can delete their own cached insights" ON public.ai_insights_cache
  FOR DELETE TO authenticated
  USING (((SELECT auth.uid()) = user_id) OR has_role((SELECT auth.uid()), 'admin'::app_role));

DROP POLICY IF EXISTS "Users can insert their own cached insights" ON public.ai_insights_cache;
CREATE POLICY "Users can insert their own cached insights" ON public.ai_insights_cache
  FOR INSERT TO authenticated
  WITH CHECK ((SELECT auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can update their own cached insights" ON public.ai_insights_cache;
CREATE POLICY "Users can update their own cached insights" ON public.ai_insights_cache
  FOR UPDATE TO authenticated
  USING ((SELECT auth.uid()) = user_id)
  WITH CHECK ((SELECT auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can view their own cached insights" ON public.ai_insights_cache;
CREATE POLICY "Users can view their own cached insights" ON public.ai_insights_cache
  FOR SELECT TO authenticated
  USING (((SELECT auth.uid()) = user_id) OR has_role((SELECT auth.uid()), 'admin'::app_role));

-- ai_usage_events
DROP POLICY IF EXISTS "Users can insert their own usage events" ON public.ai_usage_events;
CREATE POLICY "Users can insert their own usage events" ON public.ai_usage_events
  FOR INSERT TO authenticated
  WITH CHECK ((SELECT auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can view their own usage events" ON public.ai_usage_events;
CREATE POLICY "Users can view their own usage events" ON public.ai_usage_events
  FOR SELECT TO authenticated
  USING (((SELECT auth.uid()) = user_id) OR has_role((SELECT auth.uid()), 'admin'::app_role));

-- art_file_attachments
DROP POLICY IF EXISTS "Users delete own art files" ON public.art_file_attachments;
CREATE POLICY "Users delete own art files" ON public.art_file_attachments
  FOR DELETE TO public
  USING ((SELECT auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users insert own art files" ON public.art_file_attachments;
CREATE POLICY "Users insert own art files" ON public.art_file_attachments
  FOR INSERT TO public
  WITH CHECK ((SELECT auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users update own art files" ON public.art_file_attachments;
CREATE POLICY "Users update own art files" ON public.art_file_attachments
  FOR UPDATE TO public
  USING ((SELECT auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users view own art files" ON public.art_file_attachments;
CREATE POLICY "Users view own art files" ON public.art_file_attachments
  FOR SELECT TO public
  USING ((SELECT auth.uid()) = user_id);

-- category_icons
DROP POLICY IF EXISTS "Admins can delete category icons" ON public.category_icons;
CREATE POLICY "Admins can delete category icons" ON public.category_icons
  FOR DELETE TO authenticated
  USING (has_role((SELECT auth.uid()), 'admin'::app_role));

DROP POLICY IF EXISTS "Admins can insert category icons" ON public.category_icons;
CREATE POLICY "Admins can insert category icons" ON public.category_icons
  FOR INSERT TO authenticated
  WITH CHECK (has_role((SELECT auth.uid()), 'admin'::app_role));

DROP POLICY IF EXISTS "Admins can update category icons" ON public.category_icons;
CREATE POLICY "Admins can update category icons" ON public.category_icons
  FOR UPDATE TO authenticated
  USING (has_role((SELECT auth.uid()), 'admin'::app_role))
  WITH CHECK (has_role((SELECT auth.uid()), 'admin'::app_role));

-- collection_products
DROP POLICY IF EXISTS collection_products_delete ON public.collection_products;
CREATE POLICY collection_products_delete ON public.collection_products
  FOR DELETE TO authenticated
  USING (
    EXISTS (SELECT 1 FROM collections c WHERE c.id = collection_products.collection_id AND c.user_id = (SELECT auth.uid()))
    OR is_supervisor_or_above((SELECT auth.uid()))
  );

DROP POLICY IF EXISTS collection_products_insert ON public.collection_products;
CREATE POLICY collection_products_insert ON public.collection_products
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM collections c WHERE c.id = collection_products.collection_id AND c.user_id = (SELECT auth.uid()))
    OR is_supervisor_or_above((SELECT auth.uid()))
  );

DROP POLICY IF EXISTS collection_products_select ON public.collection_products;
CREATE POLICY collection_products_select ON public.collection_products
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM collections c
      WHERE c.id = collection_products.collection_id
        AND (c.user_id = (SELECT auth.uid()) OR c.is_public = true OR c.share_token IS NOT NULL)
    )
    OR is_supervisor_or_above((SELECT auth.uid()))
  );

DROP POLICY IF EXISTS collection_products_update ON public.collection_products;
CREATE POLICY collection_products_update ON public.collection_products
  FOR UPDATE TO authenticated
  USING (
    EXISTS (SELECT 1 FROM collections c WHERE c.id = collection_products.collection_id AND c.user_id = (SELECT auth.uid()))
    OR is_supervisor_or_above((SELECT auth.uid()))
  );

-- component_media
DROP POLICY IF EXISTS "Admins can manage component media" ON public.component_media;
CREATE POLICY "Admins can manage component media" ON public.component_media
  FOR ALL TO authenticated
  USING (has_role((SELECT auth.uid()), 'admin'::app_role))
  WITH CHECK (has_role((SELECT auth.uid()), 'admin'::app_role));

-- organization_members
DROP POLICY IF EXISTS "Org admins/owners can insert members" ON public.organization_members;
CREATE POLICY "Org admins/owners can insert members" ON public.organization_members
  FOR INSERT TO authenticated
  WITH CHECK (
    has_org_role((SELECT auth.uid()), organization_id, 'owner'::org_role)
    OR has_org_role((SELECT auth.uid()), organization_id, 'admin'::org_role)
    OR (NOT org_has_any_members(organization_id) AND user_id = (SELECT auth.uid()) AND role = 'owner'::org_role)
  );

-- product_component_locations
DROP POLICY IF EXISTS "Admins manage component locations" ON public.product_component_locations;
CREATE POLICY "Admins manage component locations" ON public.product_component_locations
  FOR ALL TO authenticated
  USING (has_role((SELECT auth.uid()), 'admin'::app_role))
  WITH CHECK (has_role((SELECT auth.uid()), 'admin'::app_role));

-- product_components
DROP POLICY IF EXISTS "Admins can manage components" ON public.product_components;
CREATE POLICY "Admins can manage components" ON public.product_components
  FOR ALL TO authenticated
  USING (has_role((SELECT auth.uid()), 'admin'::app_role));

-- product_group_members
DROP POLICY IF EXISTS "Admins can manage members" ON public.product_group_members;
CREATE POLICY "Admins can manage members" ON public.product_group_members
  FOR ALL TO authenticated
  USING (has_role((SELECT auth.uid()), 'admin'::app_role));

-- product_groups
DROP POLICY IF EXISTS "Admins can manage groups" ON public.product_groups;
CREATE POLICY "Admins can manage groups" ON public.product_groups
  FOR ALL TO authenticated
  USING (has_role((SELECT auth.uid()), 'admin'::app_role));

-- product_price_freshness_overrides
DROP POLICY IF EXISTS "Admins can delete freshness overrides" ON public.product_price_freshness_overrides;
CREATE POLICY "Admins can delete freshness overrides" ON public.product_price_freshness_overrides
  FOR DELETE TO authenticated
  USING (has_role((SELECT auth.uid()), 'admin'::app_role));

DROP POLICY IF EXISTS "Admins can insert freshness overrides" ON public.product_price_freshness_overrides;
CREATE POLICY "Admins can insert freshness overrides" ON public.product_price_freshness_overrides
  FOR INSERT TO authenticated
  WITH CHECK (has_role((SELECT auth.uid()), 'admin'::app_role));

DROP POLICY IF EXISTS "Admins can update freshness overrides" ON public.product_price_freshness_overrides;
CREATE POLICY "Admins can update freshness overrides" ON public.product_price_freshness_overrides
  FOR UPDATE TO authenticated
  USING (has_role((SELECT auth.uid()), 'admin'::app_role))
  WITH CHECK (has_role((SELECT auth.uid()), 'admin'::app_role));

-- product_sync_logs
DROP POLICY IF EXISTS "Admins insert product sync logs" ON public.product_sync_logs;
CREATE POLICY "Admins insert product sync logs" ON public.product_sync_logs
  FOR INSERT TO authenticated
  WITH CHECK (has_role((SELECT auth.uid()), 'admin'::app_role));

DROP POLICY IF EXISTS "Admins view product sync logs" ON public.product_sync_logs;
CREATE POLICY "Admins view product sync logs" ON public.product_sync_logs
  FOR SELECT TO authenticated
  USING (has_role((SELECT auth.uid()), 'admin'::app_role));

-- quotes
DROP POLICY IF EXISTS quotes_select_scope ON public.quotes;
CREATE POLICY quotes_select_scope ON public.quotes
  FOR SELECT TO public
  USING (
    user_is_org_member(organization_id)
    AND (
      is_coord_or_above((SELECT auth.uid()))
      OR seller_id = (SELECT auth.uid())
      OR created_by = (SELECT auth.uid())
      OR assigned_to = (SELECT auth.uid())
    )
  );

DROP POLICY IF EXISTS quotes_update_scope ON public.quotes;
CREATE POLICY quotes_update_scope ON public.quotes
  FOR UPDATE TO public
  USING (
    user_is_org_member(organization_id)
    AND (
      is_coord_or_above((SELECT auth.uid()))
      OR seller_id = (SELECT auth.uid())
      OR created_by = (SELECT auth.uid())
      OR assigned_to = (SELECT auth.uid())
    )
  );

-- ============================================================================
-- PERF-002 — Consolidar policies de `profiles`
-- ============================================================================
-- Estado prévio:
--   - "Users can view their own profile"   SELECT  qual:  auth.uid() = user_id   ← coluna user_id nullable, NULL em 9/13 rows!
--   - "profiles_select"                    SELECT  qual:  (SELECT auth.uid())=id OR is_admin_or_above   ← correta, usa id (PK NOT NULL)
--   - "Users can update own profile"       UPDATE  qual:  (SELECT auth.uid())=id   ← correta
--   - "Users can update their own profile" UPDATE  qual:  auth.uid() = user_id    ← quebrada para 9/13 rows
--   - "Users can insert their own profile" INSERT  check: auth.uid() = user_id    ← quebrada para 9/13 rows
-- Decisão: dropar as 3 legacy (user_id) e consolidar em 3 policies usando `id`.
-- Insert é refeito apontando para id (cf. trigger handle_new_user que popula id = auth.users.id).

DROP POLICY IF EXISTS "Users can view their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can insert their own profile" ON public.profiles;

-- profiles_select já existe e está correta, mas faz drop+create idempotente
-- para garantir a forma final (caso a definição tenha drift).
DROP POLICY IF EXISTS profiles_select ON public.profiles;
CREATE POLICY profiles_select ON public.profiles
  FOR SELECT TO public
  USING (((SELECT auth.uid()) = id) OR is_admin_or_above((SELECT auth.uid())));

DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
CREATE POLICY profiles_update ON public.profiles
  FOR UPDATE TO public
  USING ((SELECT auth.uid()) = id)
  WITH CHECK ((SELECT auth.uid()) = id);

CREATE POLICY profiles_insert ON public.profiles
  FOR INSERT TO public
  WITH CHECK ((SELECT auth.uid()) = id);

-- Comentários para auditoria
COMMENT ON POLICY profiles_select ON public.profiles IS
  'P1 hardening (2026-05-22): consolida 2 policies SELECT antigas; usa `id` (NOT NULL) e (SELECT auth.uid()) cached.';
COMMENT ON POLICY profiles_update ON public.profiles IS
  'P1 hardening (2026-05-22): consolida 2 policies UPDATE antigas; usa `id` (NOT NULL) e (SELECT auth.uid()) cached.';
COMMENT ON POLICY profiles_insert ON public.profiles IS
  'P1 hardening (2026-05-22): substitui "Users can insert their own profile" que usava user_id (nullable). Agora usa `id` (NOT NULL).';

COMMIT;
