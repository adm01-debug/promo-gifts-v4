
-- ============================================================================
-- supplier_products_raw — HOTFIX: Fase 3 (Motor quarentena terminal)
-- ----------------------------------------------------------------------------
-- A Fase 3 original falhou silenciosamente: fn_process_raw_v2 ainda usa
-- `status <> 'processed'` (inclui 'quarantined'), então linhas quarentenadas
-- são reprocessadas indefinidamente, anulando o poison-pill implementado na
-- Fase 1. Esta migração re-aplica a substituição do predicado de fila.
-- ============================================================================

DO $migrate$
DECLARE
  v_def    text;
  v_before text := 'status <> ''processed''::supplier_raw_status';
  v_after  text := 'status NOT IN (''processed''::supplier_raw_status, ''quarantined''::supplier_raw_status)';
  v_count  int;
BEGIN
  v_def := pg_get_functiondef('public.fn_process_raw_v2(uuid, integer, boolean)'::regprocedure);

  v_count := (length(v_def) - length(replace(v_def, v_before, ''))) / length(v_before);
  IF v_count < 1 THEN
    RAISE EXCEPTION 'Predicado de fila não encontrado em fn_process_raw_v2 (achados=%); abortando.', v_count;
  END IF;
  RAISE NOTICE 'fn_process_raw_v2: substituindo % ocorrência(s) do predicado de fila.', v_count;

  v_def := replace(v_def, v_before, v_after);
  EXECUTE v_def;
END
$migrate$;
