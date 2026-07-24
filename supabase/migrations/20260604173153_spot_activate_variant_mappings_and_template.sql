-- Ativa só as regras de variante de coluna REAL (cor + size + capacity).
-- web_sku / length_cm / width_cm continuam inativas (colunas fantasma na variante).
UPDATE supplier_field_mappings
   SET is_active = true, updated_at = now()
 WHERE supplier_id = 'bcfc0d02-44c6-48ae-8472-12b1a3f3d8e0'
   AND target_table = 'product_variants'
   AND target_field IN ('color_code','color_name','color_hex','size_code','capacity_ml');

-- Nome da variante no Spot = nome do produto (sem sufixo de cor), como no gold.
UPDATE supplier_settings
   SET variant_name_template = '{product_name}', updated_at = now()
 WHERE supplier_id = 'bcfc0d02-44c6-48ae-8472-12b1a3f3d8e0';