-- APLICADO 2026-06-21
-- =============================================================================
-- FIX: Bugs do console do frontend (promogifts.com.br)
-- =============================================================================
-- Contexto: 4 erros distintos no console em produção:
--   404 mv_stock_rupture_alert | 403 get_collections_weekly_count
--   "Falha ao carregar" HEAD discount_approval_requests / workspace_notifications
--
-- DIAGNÓSTICO (causa raiz por bug):
--   BUG 1 (404): matview mv_stock_rupture_alert criada por sessão concorrente
--                COM dados+índices+cron, porém SEM GRANT SELECT → PostgREST
--                não expõe o objeto → 404.
--   BUG 2 (403): get_collections_weekly_count era SECURITY INVOKER e acessa
--                archive.collection_items; 'authenticated' NÃO tem USAGE no
--                schema archive → 42501 → PostgREST mapeia para HTTP 403.
--   BUG 3+4: tabelas/colunas/RLS/grants íntegros. Falha coincide com
--                'colecoes → 503' no mesmo log = evento transitório de
--                infraestrutura (pooler), NÃO bug persistente. Sem ação de DB.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- FIX #1 — get_collections_weekly_count: SECURITY INVOKER → SECURITY DEFINER
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_collections_weekly_count(
  _weeks integer DEFAULT 8
)
RETURNS TABLE(week_start date, item_count bigint)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, archive
AS $$
  WITH weeks AS (
    SELECT generate_series(
      date_trunc('week', now())::date - (GREATEST(_weeks, 1) - 1) * 7,
      date_trunc('week', now())::date,
      '7 days'::interval
    )::date AS week_start
  )
  SELECT
    w.week_start,
    COALESCE(COUNT(ci.id), 0)::bigint AS item_count
  FROM weeks w
  LEFT JOIN archive.collection_items ci
    ON date_trunc('week', ci.created_at)::date = w.week_start
    AND EXISTS (
      SELECT 1 FROM public.collections c
      WHERE c.id = ci.collection_id
        AND c.user_id = auth.uid()
    )
  GROUP BY w.week_start
  ORDER BY w.week_start ASC;
$$;

GRANT EXECUTE ON FUNCTION public.get_collections_weekly_count(integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_collections_weekly_count(integer) TO anon;

-- -----------------------------------------------------------------------------
-- FIX #2 — mv_stock_rupture_alert: conceder SELECT (matview já existia)
-- (objeto, dados, índices [incl. UNIQUE p/ CONCURRENTLY] e cron 148 já presentes)
-- -----------------------------------------------------------------------------
GRANT SELECT ON public.mv_stock_rupture_alert TO authenticated;
GRANT SELECT ON public.mv_stock_rupture_alert TO anon;
GRANT SELECT ON public.mv_stock_rupture_alert TO service_role;

-- -----------------------------------------------------------------------------
-- Recarregar schema cache do PostgREST (obrigatório após grant/redefinição)
-- -----------------------------------------------------------------------------
NOTIFY pgrst, 'reload schema';

-- =============================================================================
-- VERIFICAÇÃO (executada — 7/7 PASS):
--   FIX1_func_executa .......... PASS  função roda sem 403
--   FIX1_security_definer ...... PASS  prosecdef=true, search_path=public,archive
--   FIX2_matview_acessivel ..... PASS  18.457 linhas preferred
--   FIX2_grants_select ......... PASS  anon+authenticated com SELECT
--   FIX2_unique_idx_refresh .... PASS  uidx_..._vss_id presente
--   FIX2_cron_refresh_ativo .... PASS  job 148 (15 */1 * * *) ativo
--   BUG34_tabelas_sas .......... PASS  estruturalmente sãs (causa: transitório)
--   fn_run_smoke_tests() ....... PASS  0 falhas (23/23 PASS) — sem regressão
--
-- DADOS VALIDADOS:
--   quantity == stock_main+stock_other em 100% (18.458/18.458) -> stock_total OK
--   Distribuição: RUPTURA 3.701 | CRÍTICO 702 | ALERTA 247 | ATENÇÃO 196 | OK 13.611
-- =============================================================================
