-- ════════════════════════════════════════════════════════════════
-- P2-XBZ-01 — fn_xbz_enrich_stock_batch v3
--
-- Diagnóstico (provado em produção, 2026-06-11):
-- 1. O payload real do VPS (/api/ruiz/consultaEstoque) NÃO carrega
--    QuantidadeDisponivel / QuantidadeDisponivelEstoquePrincipal /
--    ReposicaoDataPrevista / StatusConfiabilidade. O guard antigo
--    comparava campo-a-campo com IS DISTINCT FROM: campo presente no
--    raw_data e ausente no item => "diferente" para sempre => o UPDATE
--    re-escrevia ~10,6k linhas (91% da tabela XBZ) a CADA ciclo, sem
--    mudar um byte de raw_data (timestamp único 23:45:13.710604 em
--    10.636 linhas; raw_data->QuantidadeDisponivel não acompanhou
--    stock_data->Quantity).
-- 2. O carimbo stock_synced_at=now() nessas escritas vazias mascarava
--    o fato de que NENHUM escritor grava stock_data (canal inglês:
--    Quantity/QuantityMainWarehouse/...) desde <= 2026-06-08
--    (pg_stat_statements desde o reset não contém escritor algum).
--
-- Fix:
-- a) Guard SIMÉTRICO com a escrita: o patch é jsonb_strip_nulls(...)
--    dos campos que o item realmente carrega; só atualiza quando
--    NOT (raw_data @> patch) — merge que não muda nada é pulado de
--    verdade. Igualdade jsonb numérica é por valor (1.050 == 1.05).
-- b) Não carimba mais stock_synced_at: este enrich não escreve
--    quantidade. stock_synced_at volta a significar "última escrita
--    real de stock_data" (dead-man switch do worker de estoque).
-- c) updated_at fica por conta do trigger fn_spr_before_write.
--
-- Contrato preservado: assinatura, SECURITY DEFINER, search_path,
-- chaves do retorno (updated/total_input/skipped_noop/ts) e o espelho
-- dos campos de estoque em stock_data quando presentes no item.
-- ════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.fn_xbz_enrich_stock_batch(p_supplier_id uuid, p_items jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_updated int := 0;
BEGIN
  UPDATE supplier_products_raw spr
  SET
    raw_data   = spr.raw_data || patch.p,
    stock_data = COALESCE(spr.stock_data, '{}'::jsonb) || jsonb_strip_nulls(jsonb_build_object(
      'QuantidadeDisponivel',                 item->'QuantidadeDisponivel',
      'QuantidadeDisponivelEstoquePrincipal', item->'QuantidadeDisponivelEstoquePrincipal',
      'ReposicaoDataPrevista',                item->'ReposicaoDataPrevista',
      'Disponivel',                           item->'Disponivel'
    ))
  FROM jsonb_array_elements(p_items) AS item
  CROSS JOIN LATERAL (
    SELECT jsonb_strip_nulls(jsonb_build_object(
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
    )) AS p
  ) patch
  WHERE spr.supplier_id = p_supplier_id
    AND spr.supplier_sku = item->>'CodigoComposto'
    AND spr.raw_data IS NOT NULL
    AND NOT (spr.raw_data @> patch.p);

  GET DIAGNOSTICS v_updated = ROW_COUNT;

  RETURN jsonb_build_object(
    'updated',      v_updated,
    'total_input',  jsonb_array_length(p_items),
    'skipped_noop', jsonb_array_length(p_items) - v_updated,
    'campos',       'guard simetrico raw_data @> patch; sem carimbo de stock_synced_at; tipos JSON preservados',
    'ts',           now()
  );
END;
$$;

COMMENT ON FUNCTION public.fn_xbz_enrich_stock_batch(uuid, jsonb) IS
  'Enriquece raw_data XBZ com campos do consultaEstoque (preco/disponibilidade/IPI; quantidades quando o item as trouxer). '
  'v3: guard simetrico (NOT raw_data @> patch) — atualiza somente linhas com mudanca real; nao carimba stock_synced_at '
  '(marcador reservado a escritas reais de stock_data). Chaves _% sao removidas pelo trigger fn_spr_before_write.';
