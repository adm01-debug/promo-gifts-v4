-- Liga as regras de dimensão de caixa do Spot ao conversor dedicado.
-- fn_convert_box_dimension_to_cm auto-detecta: <10 = metros (×100), >=10 = mm (÷10).
-- O Spot vem em metros (~0,33) → 33 cm. Alcançável pelo fn_apply_transform de 6 args
-- que o fn_process_staged_product usa. Regras seguem is_active=false (não disparam até o cutover).
-- Camada: supplier_field_mappings (intermediária). Não escreve no gold agora.
UPDATE supplier_field_mappings
SET transform_type   = 'custom',
    transform_config = '{"function":"fn_convert_box_dimension_to_cm"}'::jsonb,
    source_unit      = NULL,
    target_unit      = 'cm',
    updated_at       = now()
WHERE supplier_id  = 'bcfc0d02-44c6-48ae-8472-12b1a3f3d8e0'
  AND target_table = 'products'
  AND target_field IN ('box_height_cm','box_length_cm','box_width_cm');