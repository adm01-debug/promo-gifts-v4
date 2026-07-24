-- ════════════════════════════════════════════════════════════════
-- UNIFICAÇÃO MEDALLION — Fase 4/4
-- Aposenta o Silver LEGADO (medallion 001) — sem dropar.
-- ════════════════════════════════════════════════════════════════
-- Verificado ao vivo: 12 funções legadas SEM chamadores; tabelas silver_*
-- SEM views/MVs dependentes. Substituídas pela Silver de-para oficial
-- (produtos_padronizacao + _variantes via fn_standardize_supplier /
-- fn_promote_supplier). Mantidas para auditoria; candidatas a DROP em follow-up.
-- COMMENT é não-disruptivo (apenas metadados).
-- ════════════════════════════════════════════════════════════════

DO $$
DECLARE
  v_msg_fn text := 'DEPRECATED 2026-06-05: Silver legado (medallion 001). '
                || 'Substituido pelo pipeline de-para oficial (produtos_padronizacao via '
                || 'fn_standardize_supplier + fn_promote_supplier). Sem chamadores. Candidato a DROP em follow-up.';
  v_msg_tb text := 'DEPRECATED 2026-06-05: tabela do Silver legado (medallion 001). '
                || 'Fonte canonica da Silver passou a ser produtos_padronizacao(+_variantes). '
                || 'Mantida para auditoria; candidata a DROP em follow-up.';
BEGIN
  -- Funções legadas (Bronze→Silver hardcoded e Silver→Gold legado)
  EXECUTE format('COMMENT ON FUNCTION public.fn_spot_to_silver(uuid) IS %L', v_msg_fn);
  EXECUTE format('COMMENT ON FUNCTION public.fn_xbz_to_silver(uuid) IS %L', v_msg_fn);
  EXECUTE format('COMMENT ON FUNCTION public.fn_asia_to_silver(uuid) IS %L', v_msg_fn);
  EXECUTE format('COMMENT ON FUNCTION public.fn_sm_to_silver(uuid) IS %L', v_msg_fn);
  EXECUTE format('COMMENT ON FUNCTION public.fn_spot_batch_to_silver(integer) IS %L', v_msg_fn);
  EXECUTE format('COMMENT ON FUNCTION public.fn_xbz_batch_to_silver(integer) IS %L', v_msg_fn);
  EXECUTE format('COMMENT ON FUNCTION public.fn_asia_batch_to_silver(integer) IS %L', v_msg_fn);
  EXECUTE format('COMMENT ON FUNCTION public.fn_sm_batch_to_silver(integer) IS %L', v_msg_fn);
  EXECUTE format('COMMENT ON FUNCTION public.fn_silver_to_gold(uuid) IS %L', v_msg_fn);
  EXECUTE format('COMMENT ON FUNCTION public.fn_silver_batch_to_gold(text, integer) IS %L', v_msg_fn);
  EXECUTE format('COMMENT ON FUNCTION public.fn_bronze_to_silver_all(integer) IS %L', v_msg_fn);
  EXECUTE format('COMMENT ON FUNCTION public.fn_normalize_silver_all() IS %L', v_msg_fn);

  -- Tabelas do Silver legado
  EXECUTE format('COMMENT ON TABLE public.silver_products IS %L', v_msg_tb);
  EXECUTE format('COMMENT ON TABLE public.silver_variants IS %L', v_msg_tb);
  EXECUTE format('COMMENT ON TABLE public.silver_print_areas IS %L', v_msg_tb);
  EXECUTE format('COMMENT ON TABLE public.silver_images_queue IS %L', v_msg_tb);
END $$;

-- Documenta a Silver oficial (fonte canônica)
COMMENT ON TABLE public.produtos_padronizacao IS
  'SILVER oficial (Medallion). Bronze->Silver via fn_standardize_supplier (de-para supplier_field_mappings + fn_apply_transform); Silver->Gold via fn_promote_supplier. Fonte canonica de padronizacao de produtos.';
COMMENT ON TABLE public.produtos_padronizacao_variantes IS
  'SILVER oficial (Medallion) — variantes. Staging raw_id->pad_id->variant_id. Bronze->Silver via fn_standardize_variant; Silver->Gold via fn_promote_variants_of_parent.';
