-- ============================================================
-- Preço de venda dos produtos NOVOS: o trigger BEFORE trg_calculate_sale_price
-- (products) calcula sale_price = products.cost_price * (1 + default_markup_percent/100).
-- Os 1.200 produtos Spot existentes têm products.cost_price preenchido (1200/1200);
-- a v2 não preenchia → produtos novos ficariam sem cost_price e sem sale_price,
-- divergindo do catálogo. Mapeamos products.cost_price = Price1 (mesma origem do
-- custo de VSS), restaurando a consistência e habilitando o cálculo automático do
-- preço (markup 115% do fornecedor). Price1 cobre 100% do raw.
INSERT INTO supplier_field_mappings
   (supplier_id, source_field, source_path, target_table, target_field,
    transform_type, is_active, priority, created_at, updated_at)
VALUES
   ('bcfc0d02-44c6-48ae-8472-12b1a3f3d8e0', 'Price1', NULL,
    'products', 'cost_price', 'direct', true, 10, now(), now());

-- ROLLBACK:
--   DELETE FROM supplier_field_mappings
--    WHERE supplier_id='bcfc0d02-44c6-48ae-8472-12b1a3f3d8e0'
--      AND target_table='products' AND target_field='cost_price' AND source_field='Price1';
-- ============================================================