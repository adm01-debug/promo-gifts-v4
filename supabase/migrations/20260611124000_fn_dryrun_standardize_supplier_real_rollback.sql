-- ════════════════════════════════════════════════════════════════
-- fn_dryrun_standardize_supplier: dry-run DE VERDADE (rollback).
-- ════════════════════════════════════════════════════════════════
-- A versão anterior tinha nome de dry-run mas ESCREVIA no Silver
-- (rodava fn_standardize_variant/parent reais, sem reverter, e sem
-- filtrar por status — re-padronizava o catálogo inteiro ao ser
-- chamada "só para ver").
--
-- Agora: executa o pipeline B→S real dentro de um bloco
-- BEGIN/EXCEPTION (subtransação), coleta o preview (contagens e
-- amostra do que mudaria) e dispara exceção sentinela para REVERTER
-- tudo, devolvendo o preview pelo PG_EXCEPTION_DETAIL. Zero efeito
-- colateral, qualquer que seja o resultado.
-- ════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.fn_dryrun_standardize_supplier(
    p_supplier_id uuid,
    p_limit       integer DEFAULT 50
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'extensions'
AS $function$
DECLARE
  v_preview jsonb;
  v_detail  text;
BEGIN
  IF auth.uid() IS NOT NULL AND NOT public.is_admin_or_above((SELECT auth.uid())) THEN
    RAISE EXCEPTION 'Acesso negado: requer perfil admin ou superior';
  END IF;

  BEGIN
    PERFORM set_config('app.write_source', 'pipeline', true);

    -- Executa o caminho REAL (Bronze→Silver) sobre os pending do fornecedor
    v_preview := jsonb_build_object(
      'standardize', public.fn_standardize_supplier(p_supplier_id, p_limit));

    -- Estado que o Silver TERIA após a execução
    v_preview := v_preview || jsonb_build_object(
      'silver_depois', jsonb_build_object(
        'pais_standardized', (SELECT COUNT(*) FROM public.produtos_padronizacao
           WHERE supplier_id=p_supplier_id AND status='standardized'),
        'pais_rejected', (SELECT COUNT(*) FROM public.produtos_padronizacao
           WHERE supplier_id=p_supplier_id AND status='rejected'),
        'variantes_standardized', (SELECT COUNT(*) FROM public.produtos_padronizacao_variantes
           WHERE supplier_id=p_supplier_id AND status='standardized'),
        'amostra_rejeitados', (SELECT jsonb_agg(jsonb_build_object(
             'ref', p.supplier_reference, 'erros', p.validation_errors))
           FROM (SELECT supplier_reference, validation_errors
                 FROM public.produtos_padronizacao
                 WHERE supplier_id=p_supplier_id AND status='rejected'
                 ORDER BY updated_at DESC LIMIT 5) p)));

    -- Sentinela: aborta a subtransação levando o preview no DETAIL.
    RAISE EXCEPTION 'DRYRUN_ROLLBACK' USING DETAIL = v_preview::text;

  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM = 'DRYRUN_ROLLBACK' THEN
      GET STACKED DIAGNOSTICS v_detail = PG_EXCEPTION_DETAIL;
      RETURN jsonb_build_object(
        'success', true, 'dry_run', true, 'reverted', true,
        'supplier_id', p_supplier_id, 'preview', v_detail::jsonb);
    END IF;
    RETURN jsonb_build_object(
      'success', false, 'dry_run', true, 'reverted', true,
      'supplier_id', p_supplier_id, 'error', SQLERRM);
  END;
END;
$function$;

REVOKE ALL ON FUNCTION public.fn_dryrun_standardize_supplier(uuid, integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.fn_dryrun_standardize_supplier(uuid, integer) FROM anon;
REVOKE ALL ON FUNCTION public.fn_dryrun_standardize_supplier(uuid, integer) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.fn_dryrun_standardize_supplier(uuid, integer) TO postgres;
GRANT EXECUTE ON FUNCTION public.fn_dryrun_standardize_supplier(uuid, integer) TO service_role;

COMMENT ON FUNCTION public.fn_dryrun_standardize_supplier(uuid, integer) IS
  'Dry-run REAL do Bronze->Silver: executa fn_standardize_supplier numa subtransação, '
  'coleta preview (contagens + amostra de rejeitados) e REVERTE tudo via exceção sentinela. '
  '2026-06-11: antes escrevia no Silver apesar do nome.';
