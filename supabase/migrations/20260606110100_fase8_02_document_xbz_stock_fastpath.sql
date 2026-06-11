-- MEDALLION — Fase 8 / Item 2: documenta o fast-path de estoque XBZ como canônico.
-- fn_import_stock_xbz lê supplier_products_raw.stock_data e atualiza a camada canônica de
-- sourcing (variant_supplier_sources) + rollup em products. Alinhado ao ADR 0007 §4.
-- Mantido como fast-path de alta frequência (cron xbz-stock-sync */15). Não é violação de fase.
COMMENT ON FUNCTION public.fn_import_stock_xbz(text) IS
  'CANONICO 2026-06-06 (Fase 8): fast-path de estoque XBZ. Le supplier_products_raw.stock_data e atualiza variant_supplier_sources (fonte-da-verdade de estoque, ADR 0007) + rollup em products. NAO e violacao Bronze->Gold (escreve na camada de sourcing canonica). Cron xbz-stock-sync */15.';
