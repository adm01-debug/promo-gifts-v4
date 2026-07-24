-- M8: COMMENT na tabela products + colunas AI
COMMENT ON COLUMN public.products.ai_description IS 'Desc gerada por IA. Worker parado desde 2026-04-23.';
COMMENT ON TABLE public.products IS 'GOD TABLE catálogo brindes. 152 colunas. Refatoração 2026-06-23: dimensions DROP, sku_promo auto-sync, ipi_rate/ncm_id expostos, 12 idx mortos dropados.';
