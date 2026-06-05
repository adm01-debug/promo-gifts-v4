
-- ════════════════════════════════════════════════════════════════
-- ORQUESTRADOR DE PROMOÇÃO EM LOTE (silver → gold), por fornecedor.
-- Promove pais 'standardized' e suas variantes, na ordem correta
-- (pai antes das variantes). NULL-safe e idempotente (herdado das
-- funções fn_promote_padronizacao / fn_promote_variants_of_parent).
-- NÃO executa nada até ser chamado. p_limit permite lotes pequenos.
-- Cada pai em sub-bloco: erro num pai não aborta o lote inteiro.
-- ════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.fn_promote_supplier(p_supplier_id uuid, p_limit integer DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql AS $$
DECLARE
  v_par RECORD;
  v_prom jsonb; v_vres jsonb;
  v_pais int := 0; v_novos int := 0; v_var int := 0; v_erros int := 0;
  v_t0 timestamptz := clock_timestamp();
  v_err_amostra jsonb := '[]'::jsonb;
BEGIN
  PERFORM set_config('app.write_source','pipeline', true);

  FOR v_par IN
    SELECT id, supplier_reference
    FROM public.produtos_padronizacao
    WHERE supplier_id = p_supplier_id AND status = 'standardized'
    ORDER BY supplier_reference
    LIMIT p_limit
  LOOP
    BEGIN
      v_prom := public.fn_promote_padronizacao(v_par.id);
      IF COALESCE((v_prom->>'success')::boolean, false) THEN
        v_pais := v_pais + 1;
        IF COALESCE((v_prom->>'created')::boolean, false) THEN v_novos := v_novos + 1; END IF;
        v_vres := public.fn_promote_variants_of_parent(p_supplier_id, v_par.supplier_reference);
        v_var := v_var + COALESCE((v_vres->>'variantes_promovidas')::int, 0);
      ELSE
        v_erros := v_erros + 1;
        IF jsonb_array_length(v_err_amostra) < 10 THEN
          v_err_amostra := v_err_amostra || jsonb_build_object('ref', v_par.supplier_reference, 'erro', v_prom->>'error');
        END IF;
      END IF;
    EXCEPTION WHEN OTHERS THEN
      v_erros := v_erros + 1;
      IF jsonb_array_length(v_err_amostra) < 10 THEN
        v_err_amostra := v_err_amostra || jsonb_build_object('ref', v_par.supplier_reference, 'erro', SQLERRM);
      END IF;
    END;
  END LOOP;

  RETURN jsonb_build_object('success', true, 'supplier_id', p_supplier_id,
    'pais_promovidos', v_pais, 'pais_novos', v_novos, 'variantes_promovidas', v_var,
    'erros', v_erros, 'amostra_erros', v_err_amostra,
    'segundos', round(extract(epoch FROM clock_timestamp()-v_t0)::numeric,1));
END;
$$;

COMMENT ON FUNCTION public.fn_promote_supplier IS
  'Orquestrador de promoção em lote silver→gold por fornecedor. NULL-safe, idempotente. ESCREVE no gold quando chamado.';
