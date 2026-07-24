-- Onda 20.3 — RPC read-only agregando métricas de invoke edge.
-- ============================================================================
-- CONTEXTO: A tabela `webhook_delivery_metrics` já existe em Gold (memory:
-- Structured Logging & Correlation). Esta função lê essa tabela para expor um
-- resumo de req/min, p50/p95/p99 e %erro por edge function, alimentando a aba
-- "Edge Invokes" de /admin/telemetria (mesma pattern do App Health Dashboard).
--
-- REGRA #1/#8: NÃO EXECUTAR AUTOMATICAMENTE. Aplicar via painel Supabase após
-- revisão do PO. Nenhuma DDL nova destrutiva, nenhuma tabela criada.
--
-- Segurança:
--   - SECURITY DEFINER + revoke de PUBLIC/anon/authenticated
--   - EXECUTE somente para role `service_role` (chamada via edge / admin panel
--     autenticado com step-up)
--   - Whitelist implícita: só admin/dev via edge function `get-app-health`
--     (a criar na Onda 21 se necessário)
-- ============================================================================

CREATE OR REPLACE FUNCTION public.get_edge_invoke_summary(_minutes int DEFAULT 60)
RETURNS TABLE (
  fn_name        text,
  req_count      bigint,
  err_count      bigint,
  err_ratio      numeric,
  p50_ms         numeric,
  p95_ms         numeric,
  p99_ms         numeric,
  last_seen_at   timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    m.route                                                  AS fn_name,
    count(*)::bigint                                         AS req_count,
    count(*) FILTER (WHERE m.http_status >= 400)::bigint     AS err_count,
    ROUND(
      (count(*) FILTER (WHERE m.http_status >= 400))::numeric
      / GREATEST(count(*), 1)::numeric,
      4
    )                                                        AS err_ratio,
    ROUND(percentile_cont(0.50) WITHIN GROUP (ORDER BY m.latency_ms)::numeric, 1) AS p50_ms,
    ROUND(percentile_cont(0.95) WITHIN GROUP (ORDER BY m.latency_ms)::numeric, 1) AS p95_ms,
    ROUND(percentile_cont(0.99) WITHIN GROUP (ORDER BY m.latency_ms)::numeric, 1) AS p99_ms,
    max(m.occurred_at)                                       AS last_seen_at
  FROM public.webhook_delivery_metrics m
  WHERE m.direction = 'outbound_invoke'
    AND m.occurred_at >= now() - make_interval(mins => _minutes)
  GROUP BY m.route
  ORDER BY req_count DESC
  LIMIT 100;
$$;

REVOKE ALL ON FUNCTION public.get_edge_invoke_summary(int) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_edge_invoke_summary(int) FROM anon;
REVOKE ALL ON FUNCTION public.get_edge_invoke_summary(int) FROM authenticated;
GRANT  EXECUTE ON FUNCTION public.get_edge_invoke_summary(int) TO service_role;

COMMENT ON FUNCTION public.get_edge_invoke_summary(int) IS
  'Onda 20 — resumo agregado (req/min, p50/p95/p99, %erro) por edge function ' ||
  'nos últimos _minutes minutos. Lê webhook_delivery_metrics.direction=outbound_invoke. ' ||
  'Uso: admin dashboard via edge function autenticada.';
