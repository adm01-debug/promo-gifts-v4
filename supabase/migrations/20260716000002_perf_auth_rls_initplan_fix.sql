-- PERF: fix auth_rls_initplan — substituir auth.uid() bare por (SELECT auth.uid())
-- nas políticas RLS de tabelas de alto tráfego.
--
-- Motivo: auth.uid() sem subquery é um "InitPlan" que o PG reavalia por linha.
-- (SELECT auth.uid()) é um "SubPlan" constante — avaliado 1× por query.
-- Em tabelas com 10k+ rows, a diferença é 10–100× na latência da query.
--
-- Abordagem: DROP POLICY + CREATE POLICY (único caminho para alterar USING/CHECK).
-- Idempotente: DROP IF EXISTS + CREATE OR REPLACE não existe para policies.

-- ─── content_articles ────────────────────────────────────────────────────────
DROP POLICY IF EXISTS content_articles_author_delete ON public.content_articles;
CREATE POLICY content_articles_author_delete ON public.content_articles
  FOR DELETE TO authenticated
  USING (author_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS content_articles_author_insert ON public.content_articles;
CREATE POLICY content_articles_author_insert ON public.content_articles
  FOR INSERT TO authenticated
  WITH CHECK (author_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS content_articles_author_update ON public.content_articles;
CREATE POLICY content_articles_author_update ON public.content_articles
  FOR UPDATE TO authenticated
  USING (author_id = (SELECT auth.uid()))
  WITH CHECK (author_id = (SELECT auth.uid()));

-- ─── crm_callback_events ─────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Admins can view crm callback events" ON public.crm_callback_events;
CREATE POLICY "Admins can view crm callback events" ON public.crm_callback_events
  FOR SELECT TO authenticated
  USING (has_role((SELECT auth.uid()), 'admin'::app_role));

-- ─── discount_approval_audit ─────────────────────────────────────────────────
DROP POLICY IF EXISTS daa_select_scope ON public.discount_approval_audit;
CREATE POLICY daa_select_scope ON public.discount_approval_audit
  FOR SELECT TO authenticated
  USING (
    can_view_all_sales()
    OR has_role((SELECT auth.uid()), 'supervisor'::app_role)
    OR (EXISTS (
      SELECT 1 FROM discount_approval_requests r
      WHERE r.id = discount_approval_audit.request_id
        AND r.seller_id = (SELECT auth.uid())
    ))
  );

-- ─── magazine_public_view_events ──────────────────────────────────────────────
DROP POLICY IF EXISTS view_events_read_admin ON public.magazine_public_view_events;
CREATE POLICY view_events_read_admin ON public.magazine_public_view_events
  FOR SELECT TO authenticated
  USING (has_role((SELECT auth.uid()), 'admin'::app_role));

DROP POLICY IF EXISTS view_events_read_owner ON public.magazine_public_view_events;
CREATE POLICY view_events_read_owner ON public.magazine_public_view_events
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM magazines m
    WHERE m.id = magazine_public_view_events.magazine_id
      AND m.owner_id = (SELECT auth.uid())
  ));

-- ─── magazines ───────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS magazines_admin_all ON public.magazines;
CREATE POLICY magazines_admin_all ON public.magazines
  FOR ALL TO authenticated
  USING (has_role((SELECT auth.uid()), 'admin'::app_role))
  WITH CHECK (has_role((SELECT auth.uid()), 'admin'::app_role));

-- ─── product_badge_definitions ───────────────────────────────────────────────
DROP POLICY IF EXISTS pbd_admin_delete ON public.product_badge_definitions;
CREATE POLICY pbd_admin_delete ON public.product_badge_definitions
  FOR DELETE TO authenticated
  USING (is_admin_or_above((SELECT auth.uid())) AND is_system = false);

DROP POLICY IF EXISTS pbd_admin_insert ON public.product_badge_definitions;
CREATE POLICY pbd_admin_insert ON public.product_badge_definitions
  FOR INSERT TO authenticated
  WITH CHECK (is_admin_or_above((SELECT auth.uid())));

DROP POLICY IF EXISTS pbd_admin_update ON public.product_badge_definitions;
CREATE POLICY pbd_admin_update ON public.product_badge_definitions
  FOR UPDATE TO authenticated
  USING (is_admin_or_above((SELECT auth.uid())))
  WITH CHECK (is_admin_or_above((SELECT auth.uid())));

-- ─── product_views ───────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Admins can read all views" ON public.product_views;
CREATE POLICY "Admins can read all views" ON public.product_views
  FOR SELECT TO authenticated
  USING (has_role((SELECT auth.uid()), 'admin'::app_role));

DROP POLICY IF EXISTS "Users can read own views" ON public.product_views;
CREATE POLICY "Users can read own views" ON public.product_views
  FOR SELECT TO authenticated
  USING (seller_id = (SELECT auth.uid()));

-- ─── quote_history ───────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Sellers and coord view quote_history" ON public.quote_history;
CREATE POLICY "Sellers and coord view quote_history" ON public.quote_history
  FOR SELECT TO authenticated
  USING (
    is_coord_or_above((SELECT auth.uid()))
    OR (EXISTS (
      SELECT 1 FROM quotes q
      WHERE q.id = quote_history.quote_id
        AND (
          q.seller_id    = (SELECT auth.uid())
          OR q.created_by = (SELECT auth.uid())
          OR q.assigned_to = (SELECT auth.uid())
        )
    ))
  );

DROP POLICY IF EXISTS "Sellers and coord create quote_history" ON public.quote_history;
CREATE POLICY "Sellers and coord create quote_history" ON public.quote_history
  FOR INSERT TO authenticated
  WITH CHECK (
    user_id = (SELECT auth.uid())
    AND (
      is_coord_or_above((SELECT auth.uid()))
      OR (EXISTS (
        SELECT 1 FROM quotes q
        WHERE q.id = quote_history.quote_id
          AND (
            q.seller_id    = (SELECT auth.uid())
            OR q.created_by = (SELECT auth.uid())
            OR q.assigned_to = (SELECT auth.uid())
          )
      ))
    )
  );
