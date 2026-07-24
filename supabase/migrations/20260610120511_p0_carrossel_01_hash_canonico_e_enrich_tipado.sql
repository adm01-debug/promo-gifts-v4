-- ============================================================================
-- P0-1: Mata o carrossel de reprocessamento + histórico-bomba (auditoria 2026-06-10)
-- Evidência: 100% das versões de histórico XBZ diferem só em '_ruiz_sync_at';
-- flip diário de tipos (string<->number) em PrecoVenda/IdProduto/VendaMinima/
-- Multiplos/IpiTaxa causado por enrich gravar via ->> (texto).
-- NOTA: o corpo de fn_spr_before_write desta migração foi corrigido em
-- 20260610120708 (digest -> extensions.digest). Mantido aqui como aplicado.
-- ============================================================================

ALTER TABLE public.supplier_settings
  ADD COLUMN IF NOT EXISTS hash_excluded_fields text[] NOT NULL DEFAULT '{}';

COMMENT ON COLUMN public.supplier_settings.hash_excluded_fields IS
  'Chaves de raw_data ignoradas no cálculo de content_hash (estado volátil de estoque). Chaves iniciadas em "_" são sempre ignoradas. Mudança nesses campos NÃO deve redisparar padronização de produto.';

UPDATE public.supplier_settings ss
   SET hash_excluded_fields = ARRAY['Disponivel','QuantidadeDisponivel',
        'QuantidadeDisponivelEstoquePrincipal','ReposicaoDataPrevista','StatusConfiabilidade']
  FROM public.suppliers s
 WHERE s.id = ss.supplier_id AND s.code = 'XBZ';

-- fn_xbz_enrich_stock_batch v2: preserva tipos JSON, espelha em stock_data,
-- sem '_ruiz_sync_at' (usa stock_synced_at), e pula linhas sem mudança real
CREATE OR REPLACE FUNCTION public.fn_xbz_enrich_stock_batch(p_supplier_id uuid, p_items jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_updated int := 0;
BEGIN
  UPDATE supplier_products_raw spr
  SET
    raw_data = spr.raw_data || jsonb_strip_nulls(jsonb_build_object(
      'QuantidadeDisponivel',                 item->'QuantidadeDisponivel',
      'QuantidadeDisponivelEstoquePrincipal', item->'QuantidadeDisponivelEstoquePrincipal',
      'ReposicaoDataPrevista',                item->'ReposicaoDataPrevista',
      'Multiplos',                            item->'Multiplos',
      'VendaMinima',                          item->'VendaMinima',
      'Disponivel',                           item->'Disponivel',
      'IpiTaxa',                              item->'IpiTaxa',
      'PrecoVenda',                           item->'PrecoVenda',
      'IdProduto',                            item->'IdProduto',
      'CodigoXbz',                            item->'CodigoXbz',
      'StatusConfiabilidade',                 item->'StatusConfiabilidade'
    )),
    stock_data = COALESCE(spr.stock_data, '{}'::jsonb) || jsonb_strip_nulls(jsonb_build_object(
      'QuantidadeDisponivel',                 item->'QuantidadeDisponivel',
      'QuantidadeDisponivelEstoquePrincipal', item->'QuantidadeDisponivelEstoquePrincipal',
      'ReposicaoDataPrevista',                item->'ReposicaoDataPrevista',
      'Disponivel',                           item->'Disponivel'
    )),
    stock_synced_at = now(),
    updated_at = now()
  FROM jsonb_array_elements(p_items) AS item
  WHERE spr.supplier_id = p_supplier_id
    AND spr.supplier_sku = item->>'CodigoComposto'
    AND spr.raw_data IS NOT NULL
    AND (
      spr.raw_data->'QuantidadeDisponivel'                 IS DISTINCT FROM item->'QuantidadeDisponivel' OR
      spr.raw_data->'QuantidadeDisponivelEstoquePrincipal' IS DISTINCT FROM item->'QuantidadeDisponivelEstoquePrincipal' OR
      spr.raw_data->'ReposicaoDataPrevista'                IS DISTINCT FROM item->'ReposicaoDataPrevista' OR
      spr.raw_data->'Multiplos'                            IS DISTINCT FROM item->'Multiplos' OR
      spr.raw_data->'VendaMinima'                          IS DISTINCT FROM item->'VendaMinima' OR
      spr.raw_data->'Disponivel'                           IS DISTINCT FROM item->'Disponivel' OR
      spr.raw_data->'IpiTaxa'                              IS DISTINCT FROM item->'IpiTaxa' OR
      spr.raw_data->'PrecoVenda'                           IS DISTINCT FROM item->'PrecoVenda' OR
      spr.raw_data->'IdProduto'                            IS DISTINCT FROM item->'IdProduto' OR
      spr.raw_data->'CodigoXbz'                            IS DISTINCT FROM item->'CodigoXbz' OR
      spr.raw_data->'StatusConfiabilidade'                 IS DISTINCT FROM item->'StatusConfiabilidade'
    );

  GET DIAGNOSTICS v_updated = ROW_COUNT;

  RETURN jsonb_build_object(
    'updated',     v_updated,
    'total_input', jsonb_array_length(p_items),
    'skipped_noop', jsonb_array_length(p_items) - v_updated,
    'campos',      'tipos JSON preservados; estoque espelhado em stock_data; sem _ruiz_sync_at',
    'ts',          now()
  );
END $$;
