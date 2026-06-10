-- P0: Quarentena efetiva — falhas de standardize/promote registram process_errors
-- no Bronze (ativa failed->quarantined de fn_spr_before_write em attempts>=5).
-- Antes: erro era só logado e a linha repetia a cada tick para sempre
-- (ex.: P@12288 / chk_vss_cost_price_not_zero — 65 de 155 ticks/dia com erro).

CREATE OR REPLACE FUNCTION public.fn_promote_supplier(p_supplier_id uuid, p_limit integer DEFAULT NULL::integer)
RETURNS jsonb
LANGUAGE plpgsql
SET search_path = public
AS $$
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

  RETURN jsonb_build_object('success', true, 'supplier_id', p_supplier_id,
    'pais_promovidos', v_pais, 'pais_novos', v_novos, 'variantes_promovidas', v_var,
    'erros', v_erros, 'amostra_erros', v_err_amostra,
    'segundos', round(extract(epoch FROM clock_timestamp()-v_t0)::numeric,1));
END $$;

CREATE OR REPLACE FUNCTION public.fn_standardize_supplier(p_supplier_id uuid, p_limit integer DEFAULT NULL::integer)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_raw         RECORD;
  v_par         RECORD;
  v_vres        jsonb;
  v_pres        jsonb;
  v_variants    integer := 0;
  v_parents     integer := 0;
  v_erros       integer := 0;
  v_err_amostra jsonb   := '[]'::jsonb;
  v_touched     text[]  := ARRAY[]::text[];
  v_t0          timestamptz := clock_timestamp();
BEGIN
  IF auth.uid() IS NOT NULL AND NOT public.is_admin_or_above((SELECT auth.uid())) THEN
    RAISE EXCEPTION 'Acesso negado: requer perfil admin ou superior';
  END IF;

  IF NOT pg_try_advisory_xact_lock(hashtext('fn_standardize_supplier:'||p_supplier_id::text)::bigint) THEN
    RETURN jsonb_build_object('success', true, 'skipped', 'lock_ocupado',
                              'supplier_id', p_supplier_id);
  END IF;

  PERFORM set_config('app.write_source', 'pipeline', true);

  FOR v_raw IN
      SELECT id, supplier_reference
      FROM public.supplier_products_raw
      WHERE supplier_id = p_supplier_id
        AND status = 'pending'
      ORDER BY imported_at NULLS LAST
      LIMIT p_limit
      FOR UPDATE SKIP LOCKED
  LOOP
    BEGIN
      v_vres := public.fn_standardize_variant(v_raw.id);
      IF NOT COALESCE((v_vres->>'success')::boolean, false) THEN
        RAISE EXCEPTION 'variante_falhou:%', COALESCE(v_vres->>'error', 'desconhecido');
      END IF;
      v_variants := v_variants + 1;
      v_touched  := array_append(v_touched, COALESCE(v_vres->>'parent', ''));
    EXCEPTION WHEN OTHERS THEN
      v_erros := v_erros + 1;
      IF jsonb_array_length(v_err_amostra) < 10 THEN
        v_err_amostra := v_err_amostra
          || jsonb_build_object('raw_id', v_raw.id, 'stage', 'variant', 'erro', SQLERRM);
      END IF;
      BEGIN
        UPDATE public.supplier_products_raw r
           SET process_errors = jsonb_build_object(
                 'stage','standardize','erro', SQLERRM, 'at', now())
         WHERE r.id = v_raw.id AND r.status IN ('pending','failed');
      EXCEPTION WHEN OTHERS THEN NULL;
      END;
    END;
  END LOOP;

  FOR v_par IN
      SELECT DISTINCT parent_reference
      FROM public.produtos_padronizacao_variantes
      WHERE supplier_id = p_supplier_id
        AND parent_reference = ANY(v_touched)
        AND NULLIF(parent_reference, '') IS NOT NULL
  LOOP
    BEGIN
      v_pres := public.fn_standardize_parent(p_supplier_id, v_par.parent_reference);
      IF NOT COALESCE((v_pres->>'success')::boolean, false) THEN
        RAISE EXCEPTION 'pai_falhou:%', COALESCE(v_pres->>'error', 'desconhecido');
      END IF;
      v_parents := v_parents + 1;
    EXCEPTION WHEN OTHERS THEN
      v_erros := v_erros + 1;
      IF jsonb_array_length(v_err_amostra) < 10 THEN
        v_err_amostra := v_err_amostra
          || jsonb_build_object('parent', v_par.parent_reference, 'stage', 'parent', 'erro', SQLERRM);
      END IF;
    END;
  END LOOP;

  RETURN jsonb_build_object(
    'success', true, 'supplier_id', p_supplier_id,
    'variantes_padronizadas', v_variants,
    'pais_padronizados', v_parents,
    'erros', v_erros, 'amostra_erros', v_err_amostra,
    'segundos', round(extract(epoch FROM clock_timestamp() - v_t0)::numeric, 1));
END $$;

CREATE OR REPLACE FUNCTION public.fn_spr_requeue_failed(p_min_age_minutes int DEFAULT 60, p_limit int DEFAULT 500)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_n int;
BEGIN
  WITH alvo AS (
    SELECT id FROM public.supplier_products_raw
    WHERE status = 'failed'
      AND COALESCE(attempts,0) < 5
      AND updated_at < now() - make_interval(mins => p_min_age_minutes)
    ORDER BY updated_at
    LIMIT p_limit
    FOR UPDATE SKIP LOCKED)
  UPDATE public.supplier_products_raw r
     SET status = 'pending'
    FROM alvo WHERE r.id = alvo.id;
  GET DIAGNOSTICS v_n = ROW_COUNT;
  RETURN jsonb_build_object('requeued', v_n, 'ts', now());
END $$;

REVOKE EXECUTE ON FUNCTION public.fn_spr_requeue_failed(int,int) FROM PUBLIC, anon, authenticated;

SELECT cron.schedule('spr-requeue-failed-hourly', '25 * * * *',
  'SELECT public.fn_spr_requeue_failed(60, 500);')
WHERE NOT EXISTS (SELECT 1 FROM cron.job WHERE jobname='spr-requeue-failed-hourly');
