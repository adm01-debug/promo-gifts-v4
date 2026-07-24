-- ============================================================
-- MIGRATION 003: Politica de retencao para tabelas de log
-- Auditoria: 02/06/2026 — Claude Sonnet 4
-- admin_audit_log: 50MB / 35.936 rows
-- frontend_telemetry: 30MB / 31.341 rows (user_id=NULL 100%!)
-- ============================================================

CREATE OR REPLACE FUNCTION public.fn_cleanup_log_tables()
RETURNS TABLE(tabela TEXT, registros_removidos BIGINT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count BIGINT;
BEGIN
  -- admin_audit_log: 90 dias
  DELETE FROM public.admin_audit_log
  WHERE created_at < NOW() - INTERVAL '90 days';
  GET DIAGNOSTICS v_count = ROW_COUNT;
  tabela := 'admin_audit_log'; registros_removidos := v_count;
  RETURN NEXT;

  -- frontend_telemetry: 60 dias
  DELETE FROM public.frontend_telemetry
  WHERE created_at < NOW() - INTERVAL '60 days';
  GET DIAGNOSTICS v_count = ROW_COUNT;
  tabela := 'frontend_telemetry'; registros_removidos := v_count;
  RETURN NEXT;

  -- query_telemetry: 30 dias
  DELETE FROM public.query_telemetry
  WHERE created_at < NOW() - INTERVAL '30 days';
  GET DIAGNOSTICS v_count = ROW_COUNT;
  tabela := 'query_telemetry'; registros_removidos := v_count;
  RETURN NEXT;

  -- search_analytics: 90 dias
  DELETE FROM public.search_analytics
  WHERE created_at < NOW() - INTERVAL '90 days';
  GET DIAGNOSTICS v_count = ROW_COUNT;
  tabela := 'search_analytics'; registros_removidos := v_count;
  RETURN NEXT;

  -- catalog_analytics: 90 dias
  DELETE FROM public.catalog_analytics
  WHERE created_at < NOW() - INTERVAL '90 days';
  GET DIAGNOSTICS v_count = ROW_COUNT;
  tabela := 'catalog_analytics'; registros_removidos := v_count;
  RETURN NEXT;

  -- image_validation_log: 60 dias
  DELETE FROM public.image_validation_log
  WHERE created_at < NOW() - INTERVAL '60 days';
  GET DIAGNOSTICS v_count = ROW_COUNT;
  tabela := 'image_validation_log'; registros_removidos := v_count;
  RETURN NEXT;

  -- image_import_log: 60 dias
  DELETE FROM public.image_import_log
  WHERE created_at < NOW() - INTERVAL '60 days';
  GET DIAGNOSTICS v_count = ROW_COUNT;
  tabela := 'image_import_log'; registros_removidos := v_count;
  RETURN NEXT;

  -- edge_function_invocations: 30 dias
  DELETE FROM public.edge_function_invocations
  WHERE created_at < NOW() - INTERVAL '30 days';
  GET DIAGNOSTICS v_count = ROW_COUNT;
  tabela := 'edge_function_invocations'; registros_removidos := v_count;
  RETURN NEXT;

  -- price_history: 180 dias
  DELETE FROM public.price_history
  WHERE changed_at < NOW() - INTERVAL '180 days';
  GET DIAGNOSTICS v_count = ROW_COUNT;
  tabela := 'price_history'; registros_removidos := v_count;
  RETURN NEXT;

END;
$$;

-- BUG ENCONTRADO: frontend_telemetry tem user_id = NULL em 100% dos registros
-- Investigar instrumentacao no frontend antes de proxima sprint
COMMENT ON TABLE public.frontend_telemetry IS
  'ATENCAO: Auditoria 20260602 - user_id = NULL em 100% dos registros. Bug de instrumentacao no frontend.';
