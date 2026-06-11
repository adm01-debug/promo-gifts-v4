-- ════════════════════════════════════════════════════════════════
-- fn_promote_supplier: sweep de variantes órfãs no Silver.
-- ════════════════════════════════════════════════════════════════
-- GAP: o orquestrador Silver→Gold iterava SOMENTE pais com
-- status='standardized'. Variantes re-padronizadas (backfill, fix de
-- de-para, re-sync parcial) cujo pai continua 'promoted' ficavam
-- presas em 'standardized' para sempre — nenhum caminho as promovia
-- (o cron só acorda com raw 'pending', e o loop de pais as ignora).
--
-- Correção: após o loop de pais, um SWEEP promove variantes
-- 'standardized' cujo produto-pai JÁ EXISTE no Gold, via
-- fn_promote_variants_of_parent (idempotente). Retorno ganha o campo
-- 'variantes_orfas_promovidas'; demais campos preservados.
-- ════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.fn_promote_supplier(
    p_supplier_id uuid,
    p_limit       integer DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
DECLARE
  v_par RECORD;
  v_prom jsonb; v_vres jsonb;
  v_pais int := 0; v_novos int := 0; v_var int := 0; v_erros int := 0;
  v_orfas int := 0;
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

      v_pais := v_pais + 1;
      IF v_created THEN v_novos := v_novos + 1; END IF;
      v_var := v_var + v_vcount;

    EXCEPTION WHEN OTHERS THEN
      v_erros := v_erros + 1;
      IF jsonb_array_length(v_err_amostra) < 10 THEN
        v_err_amostra := v_err_amostra || jsonb_build_object('ref', v_par.supplier_reference, 'erro', SQLERRM);
      END IF;
      BEGIN
        UPDATE public.supplier_products_raw r
           SET process_errors = jsonb_build_object(
                 'stage','promote','parent', v_par.supplier_reference,
                 'erro', SQLERRM, 'at', now())
         WHERE r.supplier_id = p_supplier_id
           AND r.status IN ('pending','failed')
           AND r.id IN (
             SELECT pv.raw_id FROM public.produtos_padronizacao_variantes pv
              WHERE pv.supplier_id = p_supplier_id
                AND pv.parent_reference = v_par.supplier_reference
                AND pv.raw_id IS NOT NULL
             UNION
             SELECT pp.raw_id FROM public.produtos_padronizacao pp
              WHERE pp.id = v_par.id AND pp.raw_id IS NOT NULL);
      EXCEPTION WHEN OTHERS THEN NULL;
      END;
    END;
  END LOOP;

  -- SWEEP 2026-06-11: variantes 'standardized' órfãs (pai já no Gold).
  -- Cobre backfills e re-padronizações fora do fluxo raw 'pending'.
  FOR v_par IN
    SELECT DISTINCT pv.parent_reference AS supplier_reference
    FROM public.produtos_padronizacao_variantes pv
    JOIN public.products p
      ON p.supplier_id = pv.supplier_id
     AND p.supplier_reference = pv.parent_reference
    WHERE pv.supplier_id = p_supplier_id
      AND pv.status = 'standardized'
      AND NULLIF(pv.parent_reference, '') IS NOT NULL
  LOOP
    BEGIN
      v_vres := public.fn_promote_variants_of_parent(p_supplier_id, v_par.supplier_reference);
      IF NOT COALESCE((v_vres->>'success')::boolean, false) THEN
        RAISE EXCEPTION 'sweep_falhou:%', COALESCE(v_vres->>'error','desconhecido');
      END IF;
      v_orfas := v_orfas + COALESCE((v_vres->>'variantes_promovidas')::int, 0);
    EXCEPTION WHEN OTHERS THEN
      v_erros := v_erros + 1;
      IF jsonb_array_length(v_err_amostra) < 10 THEN
        v_err_amostra := v_err_amostra
          || jsonb_build_object('ref', v_par.supplier_reference, 'stage', 'sweep', 'erro', SQLERRM);
      END IF;
    END;
  END LOOP;

  RETURN jsonb_build_object('success', true, 'supplier_id', p_supplier_id,
    'pais_promovidos', v_pais, 'pais_novos', v_novos, 'variantes_promovidas', v_var,
    'variantes_orfas_promovidas', v_orfas,
    'erros', v_erros, 'amostra_erros', v_err_amostra,
    'segundos', round(extract(epoch FROM clock_timestamp()-v_t0)::numeric,1));
END $function$;

COMMENT ON FUNCTION public.fn_promote_supplier(uuid, integer) IS
  'Orquestrador Silver->Gold por fornecedor. Promove pais standardized (atomico pai+variantes) e, '
  'desde 2026-06-11, faz sweep de variantes standardized orfas cujo pai ja esta no Gold '
  '(backfills/re-padronizacoes). NULL-safe, idempotente.';
