-- Guardas de integridade de estoque em product_variants (estoque negativo é sem sentido em catálogo B2B).
-- stock_quantity: lido pela vitrine; CHECK alcançável (nenhum trigger sobrescreve estoque de variante ATIVA;
--   fn_enforce_inactive_variant_zero_stock só zera inativos).
-- next_quantity_1..6: quantidades de reposição futura; CHECK alcançável quando pareadas com next_date futura
--   (trg_fn_sanitize_restock_dates anula órfãos e janelas passadas).
-- next_entry_quantity NÃO recebe CHECK: é derivado (:= next_quantity_1) por fn_sync_product_variants_next_entry,
--   portanto guardar next_quantity_1 já o cobre — evita constraint redundante que poderia travar UPDATEs.
-- Verificado empiricamente: 0 violações em 18.580 variantes; dry-run adversarial 7/7 OK.
ALTER TABLE public.product_variants
  ADD CONSTRAINT chk_pv_stock_quantity_nonneg CHECK (stock_quantity >= 0),
  ADD CONSTRAINT chk_pv_next_quantities_nonneg CHECK (
    next_quantity_1 >= 0 AND next_quantity_2 >= 0 AND next_quantity_3 >= 0
    AND next_quantity_4 >= 0 AND next_quantity_5 >= 0 AND next_quantity_6 >= 0);
