-- ============================================================
-- Migração: enriquecimento de componentes de kit (preço + estoque)
-- Alvo: SSOT externo (doufsxqlfjyuvxuezpln) — read-only do app
-- Autor: PromoGifts · 2026-06-19
-- ============================================================
-- Pré-requisitos validados:
--   ✅ public.product_kit_components existe (44 cols)
--   ✅ public.products tem sale_price, stock_quantity, stock_status
--   ✅ component_product_id é FK nullable para products.id
--
-- Cenários cobertos:
--   - component_product_id NULL (componentes "soltos" do kit) → enrichment = NULL
--   - produto-componente sem preço/estoque → NULL (UI esconde badge)
--   - produto-componente inativo → ainda mostra dados (decisão de produto)
-- ============================================================

CREATE OR REPLACE VIEW public.v_kit_component_enriched AS
SELECT
  pkc.id,
  pkc.kit_product_id,
  pkc.component_product_id,
  -- enriquecimento via JOIN (NULL-safe via LEFT JOIN)
  p.sale_price          AS component_sale_price,
  p.price               AS component_list_price,
  p.stock_quantity      AS component_stock_quantity,
  p.stock_status        AS component_stock_status,
  p.is_active           AS component_is_active
FROM public.product_kit_components pkc
LEFT JOIN public.products p
  ON p.id = pkc.component_product_id;

COMMENT ON VIEW public.v_kit_component_enriched IS
  'Enriquece product_kit_components com preço/estoque do produto-componente. NULL-safe via LEFT JOIN.';

-- Grants — view só de leitura, mesmas permissões que product_kit_components
GRANT SELECT ON public.v_kit_component_enriched TO anon, authenticated, service_role;

-- Smoke test (executar manualmente após criar):
--   SELECT count(*) FROM public.v_kit_component_enriched WHERE component_sale_price IS NOT NULL;
--   SELECT count(DISTINCT kit_product_id) FROM public.v_kit_component_enriched;
