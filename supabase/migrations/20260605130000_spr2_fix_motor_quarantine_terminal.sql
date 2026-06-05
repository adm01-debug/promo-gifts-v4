-- ============================================================================
-- supplier_products_raw — HOTFIX: Fase 3 (Motor quarentena terminal)
-- ----------------------------------------------------------------------------
-- A Fase 3 (20260605120200) foi aplicada via execute_sql mas não registrada
-- na tabela de migrations, e o predicado do motor NÃO foi substituído:
-- fn_process_raw_v2 continuava com status <> 'processed' (5 ocorrências),
-- incluindo linhas quarentenadas na fila → poison-pill da Fase 1 anulado.
--
-- Este hotfix re-aplica a substituição exata e é registrado corretamente.
-- Verificado por teste E2E com rollback: 5 erros → quarantined; motor exclui.
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
    RAISE NOTICE 'Predicado antigo não encontrado (achados=%) — já aplicado anteriormente. Noop.', v_count;
    RETURN;
  END IF;
  RAISE NOTICE 'fn_process_raw_v2: substituindo % ocorrência(s) do predicado de fila.', v_count;

  v_def := replace(v_def, v_before, v_after);
  EXECUTE v_def;
END
$migrate$;
