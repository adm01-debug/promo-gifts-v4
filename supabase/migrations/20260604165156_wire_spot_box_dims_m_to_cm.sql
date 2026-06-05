-- Spot envia dimensão de caixa em METROS (o campo "BoxHeightMM" mente: mediana 0,33 = 33 cm).
-- Liga as 3 regras de dimensão de caixa à conversão m -> cm (×100), que já existe em
-- supplier_unit_conversions (global). fn_process_staged_product usa o overload 6-arg de
-- fn_apply_transform, que executa convert_unit. As regras PERMANECEM INATIVAS até o cutover,
-- portanto isto não escreve no gold agora — só deixa a config correta.
UPDATE supplier_field_mappings
SET transform_type = 'convert_unit',
    source_unit    = 'm',
    target_unit    = 'cm',
    updated_at     = now()
WHERE supplier_id  = 'bcfc0d02-44c6-48ae-8472-12b1a3f3d8e0'
  AND target_table = 'products'
  AND target_field IN ('box_height_cm','box_length_cm','box_width_cm');