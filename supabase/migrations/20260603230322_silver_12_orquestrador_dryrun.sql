
-- ════════════════════════════════════════════════════════════════
-- ORQUESTRADOR DRY-RUN: bronze→silver para um fornecedor inteiro.
-- NÃO promove ao gold. Idempotente (upserts por chave natural).
-- ════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.fn_dryrun_standardize_supplier(p_supplier_id uuid, p_limit int DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql AS $$
DECLARE
  v_raw RECORD; v_par RECORD;
  v_nvar int := 0; v_npai int := 0; v_t0 timestamptz := clock_timestamp();
BEGIN
  -- 1) variantes (cada raw = 1 variante)
  FOR v_raw IN
    SELECT id FROM public.supplier_products_raw
    WHERE supplier_id=p_supplier_id
    ORDER BY id
    LIMIT p_limit
  LOOP
    PERFORM public.fn_standardize_variant(v_raw.id);
    v_nvar := v_nvar + 1;
  END LOOP;

  -- 2) pais (um por parent_reference distinto já derivado nas variantes)
  FOR v_par IN
    SELECT DISTINCT parent_reference FROM public.produtos_padronizacao_variantes
    WHERE supplier_id=p_supplier_id
  LOOP
    PERFORM public.fn_standardize_parent(p_supplier_id, v_par.parent_reference);
    v_npai := v_npai + 1;
  END LOOP;

  RETURN jsonb_build_object('success',true,'supplier_id',p_supplier_id,
    'variantes_padronizadas',v_nvar,'pais_padronizados',v_npai,
    'segundos',round(extract(epoch FROM clock_timestamp()-v_t0)::numeric,1));
END;
$$;
