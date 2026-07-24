-- ════════════════════════════════════════════════════════════════
-- UNIFICAÇÃO MEDALLION — Fase 1/4
-- Orquestrador Bronze → Silver (de-para) em lote, por fornecedor.
-- ════════════════════════════════════════════════════════════════
-- Espelha fn_promote_supplier (Silver → Gold), fechando o par simétrico
-- do pipeline de 3 fases:
--   Bronze  : supplier_products_raw (status='pending')
--   Silver  : produtos_padronizacao(+_variantes)  ← ESTA função
--   Gold    : products / product_variants / variant_supplier_sources
--
-- Ordem obrigatória: variantes ANTES do pai. fn_standardize_parent escolhe
-- a raw representante a partir de produtos_padronizacao_variantes, logo as
-- variantes precisam já existir no staging quando o pai é padronizado.
--
-- Idempotente: as funções-folha (fn_standardize_variant / _raw) usam UPSERT.
-- Concorrência: advisory xact lock por fornecedor evita execuções sobrepostas
-- do cron processarem o mesmo fornecedor duas vezes.
-- ════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.fn_standardize_supplier(
    p_supplier_id uuid,
    p_limit       integer DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'extensions'
AS $function$
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
  -- Segurança: bloqueia chamada direta por não-admin (cron roda sem auth.uid()).
  IF auth.uid() IS NOT NULL AND NOT public.is_admin_or_above((SELECT auth.uid())) THEN
    RAISE EXCEPTION 'Acesso negado: requer perfil admin ou superior';
  END IF;

  -- Evita execuções concorrentes para o mesmo fornecedor (cron sobreposto).
  IF NOT pg_try_advisory_xact_lock(hashtext('fn_standardize_supplier:'||p_supplier_id::text)::bigint) THEN
    RETURN jsonb_build_object('success', true, 'skipped', 'lock_ocupado',
                              'supplier_id', p_supplier_id);
  END IF;

  PERFORM set_config('app.write_source', 'pipeline', true);

  -- ── 1) Bronze → Silver (variantes): cada raw pendente do fornecedor ──
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
    END;
  END LOOP;

  -- ── 2) Bronze → Silver (produto pai): cada parent distinto tocado ──
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
END;
$function$;

COMMENT ON FUNCTION public.fn_standardize_supplier(uuid, integer) IS
  'Pipeline Medallion (Fase 1→2): Bronze→Silver de-para em lote por fornecedor. '
  'Padroniza variantes (fn_standardize_variant) e depois os pais (fn_standardize_parent). '
  'Par simétrico de fn_promote_supplier (Fase 2→3). Idempotente; advisory lock por fornecedor.';
