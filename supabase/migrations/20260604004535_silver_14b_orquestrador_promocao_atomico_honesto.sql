
-- Correção do orquestrador: ATOMicidade por produto + contagem honesta.
-- Bug anterior: v_pais era incrementado ANTES de promover variantes; se a
-- promoção de variantes falhava, o savepoint do bloco EXCEPTION revertia o
-- pai, mas o contador (variável PL/pgSQL) não revertia → reportava sucesso
-- falso. Agora: promove pai+variantes no mesmo bloco; se variantes falham,
-- RAISE força rollback do pai (atomicidade) e conta como erro. Contadores
-- só incrementam após sucesso completo.
CREATE OR REPLACE FUNCTION public.fn_promote_supplier(p_supplier_id uuid, p_limit integer DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql AS $$
DECLARE
  v_par RECORD;
  v_prom jsonb; v_vres jsonb;
  v_pais int := 0; v_novos int := 0; v_var int := 0; v_erros int := 0;
  v_t0 timestamptz := clock_timestamp();
  v_err_amostra jsonb := '[]'::jsonb;
  v_created boolean; v_vcount int;
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
      IF NOT COALESCE((v_prom->>'success')::boolean, false) THEN
        RAISE EXCEPTION 'pai_falhou:%', COALESCE(v_prom->>'error','desconhecido');
      END IF;
      v_created := COALESCE((v_prom->>'created')::boolean, false);

      v_vres := public.fn_promote_variants_of_parent(p_supplier_id, v_par.supplier_reference);
      IF NOT COALESCE((v_vres->>'success')::boolean, false) THEN
        RAISE EXCEPTION 'variantes_falharam:%', COALESCE(v_vres->>'error','desconhecido');
      END IF;
      v_vcount := COALESCE((v_vres->>'variantes_promovidas')::int, 0);

      -- só conta após sucesso COMPLETO (pai + variantes)
      v_pais := v_pais + 1;
      IF v_created THEN v_novos := v_novos + 1; END IF;
      v_var := v_var + v_vcount;

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
