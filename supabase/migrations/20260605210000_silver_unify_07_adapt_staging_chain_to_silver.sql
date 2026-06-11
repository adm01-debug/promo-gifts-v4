-- ════════════════════════════════════════════════════════════════
-- UNIFICAÇÃO MEDALLION — Fase 7
-- Adapta a cadeia legada "staging" para Bronze → Silver (de-para).
-- ════════════════════════════════════════════════════════════════
-- Descoberto em auditoria exaustiva do pg_proc (2026-06-05): havia uma
-- cadeia legada de ingestão que gravava Bronze → Gold DIRETO (pulava a Silver)
-- e NÃO estava deprecada nem adaptada:
--   fn_process_staging_batch → fn_process_all_staged_products → fn_process_staged_product → products
-- Estava DORMENTE (raiz órfã: 0 chamadores; ramo de variantes referenciava
-- fn_process_all_staged_variants, que NÃO EXISTE; fila de raws vazia), mas era
-- uma mina latente que violava a regra das 3 fases.
--
-- Decisão (usuário): ADAPTAR para a nova arquitetura Bronze → Prata, não dropar.
-- As 3 funções viram wrappers finos sobre o pipeline canônico (produtos_padronizacao*).
-- Promoção Silver → Gold continua a cargo do cron oficial (process_pending_batches
-- → fn_promote_supplier). Idempotente; sem escrita Gold direta.
-- ════════════════════════════════════════════════════════════════

-- 1) Folha: 1 raw → Silver (variante + pai)
CREATE OR REPLACE FUNCTION public.fn_process_staged_product(p_staging_id uuid)
RETURNS jsonb LANGUAGE plpgsql SET search_path TO 'public','extensions'
AS $function$
DECLARE r record; v_vres jsonb; v_pres jsonb; v_parent text;
BEGIN
  SELECT supplier_id, supplier_reference, raw_data INTO r
  FROM public.supplier_products_raw WHERE id = p_staging_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'raw_nao_encontrado', 'id', p_staging_id);
  END IF;
  -- ADAPTADO 2026-06-05: Bronze→Silver (de-para), não mais Bronze→Gold direto.
  v_vres   := public.fn_standardize_variant(p_staging_id);
  v_parent := COALESCE(NULLIF(v_vres->>'parent',''),
                       public.fn_derive_parent_ref(r.supplier_id, r.supplier_reference, r.raw_data));
  v_pres   := public.fn_standardize_parent(r.supplier_id, v_parent);
  RETURN jsonb_build_object('success', COALESCE((v_pres->>'success')::boolean, false),
    'adapted', 'bronze->silver', 'staging_id', p_staging_id, 'variant', v_vres, 'parent', v_pres);
END;
$function$;
COMMENT ON FUNCTION public.fn_process_staged_product(uuid) IS
  'ADAPTADO 2026-06-05: Bronze->Silver via fn_standardize_variant + fn_standardize_parent. Nao grava mais Bronze->Gold direto.';

-- 2) Batch por fornecedor → Silver
CREATE OR REPLACE FUNCTION public.fn_process_all_staged_products(p_supplier_id uuid DEFAULT NULL, p_limit integer DEFAULT 100)
RETURNS jsonb LANGUAGE plpgsql SET search_path TO 'public','extensions'
AS $function$
DECLARE v jsonb;
BEGIN
  IF p_supplier_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'supplier_id_obrigatorio');
  END IF;
  v := public.fn_standardize_supplier(p_supplier_id, p_limit);   -- Bronze→Silver
  RETURN jsonb_build_object('success', true, 'adapted', 'bronze->silver', 'standardize', v);
END;
$function$;
COMMENT ON FUNCTION public.fn_process_all_staged_products(uuid, integer) IS
  'ADAPTADO 2026-06-05: delega a fn_standardize_supplier (Bronze->Silver de-para).';

-- 3) Raiz da cadeia → Silver (promoção a Gold = cron oficial)
CREATE OR REPLACE FUNCTION public.fn_process_staging_batch(p_batch_id uuid DEFAULT NULL, p_supplier_id uuid DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SET search_path TO 'public','extensions'
AS $function$
DECLARE v_std jsonb;
BEGIN
  IF p_supplier_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'supplier_id_obrigatorio');
  END IF;
  -- ADAPTADO 2026-06-05: Bronze→Silver via pipeline canônico (antes: staging→Gold direto +
  -- ramo de variantes inexistente). Promoção Silver→Gold = cron oficial (process_pending_batches).
  v_std := public.fn_standardize_supplier(p_supplier_id, NULL);
  RETURN jsonb_build_object('success', true, 'adapted', 'bronze->silver',
    'batch_id', p_batch_id, 'supplier_id', p_supplier_id, 'standardize', v_std);
END;
$function$;
COMMENT ON FUNCTION public.fn_process_staging_batch(uuid, uuid) IS
  'ADAPTADO 2026-06-05: delega a fn_standardize_supplier (Bronze->Silver). Promocao a Gold pelo cron oficial.';
