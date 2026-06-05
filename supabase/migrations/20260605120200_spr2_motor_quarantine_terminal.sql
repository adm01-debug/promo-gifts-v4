-- ============================================================================
-- supplier_products_raw — Refactor v2 (Fase 3/5): Quarentena terminal no motor
-- ----------------------------------------------------------------------------
-- A fila do motor (fn_process_raw_v2) seleciona `status <> 'processed'`, ou
-- seja, reprocessa indefinidamente também linhas 'failed' E 'quarantined'.
-- Com a Fase 1, uma linha que falha 5x recebe status='quarantined' (poison
-- pill). Para que a quarentena seja TERMINAL, o motor deve excluí-la da fila.
--
-- Em vez de reescrever ~200 linhas de plpgsql (risco de divergência), fazemos
-- a substituição EXATA do predicado direto sobre a definição corrente da
-- função, preservando todo o restante byte a byte.
--   `status <> 'processed'`  ->  `status NOT IN ('processed','quarantined')`
-- ============================================================================

DO $migrate$
DECLARE
  v_def    text;
  v_before text := 'status <> ''processed''::supplier_raw_status';
  v_after  text := 'status NOT IN (''processed''::supplier_raw_status, ''quarantined''::supplier_raw_status)';
  v_count  int;
BEGIN
  v_def := pg_get_functiondef('public.fn_process_raw_v2(uuid, integer, boolean)'::regprocedure);

  -- Quantos predicados existem hoje (sanity check)
  v_count := (length(v_def) - length(replace(v_def, v_before, ''))) / length(v_before);
  IF v_count < 1 THEN
    RAISE EXCEPTION 'Predicado de fila não encontrado em fn_process_raw_v2 (achados=%); abortando para não corromper o motor.', v_count;
  END IF;
  RAISE NOTICE 'fn_process_raw_v2: substituindo % ocorrência(s) do predicado de fila.', v_count;

  v_def := replace(v_def, v_before, v_after);
  EXECUTE v_def;
END
$migrate$;
