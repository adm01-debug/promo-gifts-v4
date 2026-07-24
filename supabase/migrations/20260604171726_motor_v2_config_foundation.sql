-- Fundação do motor unificado: config por fornecedor em supplier_settings.
-- Aditivo (colunas novas) + valores para Spot e XBZ (certos). Asia/Só Marcas ficam
-- para o preparo de cutover de cada um. Não escreve no gold.
ALTER TABLE supplier_settings
  ADD COLUMN IF NOT EXISTS parent_key_source     text,   -- chave do pai no raw_data
  ADD COLUMN IF NOT EXISTS variant_name_template text,   -- ex.: '{product_name} | {color_name}'
  ADD COLUMN IF NOT EXISTS sku_prefix            text;   -- ex.: 'SPOT-'

INSERT INTO supplier_settings (supplier_id, parent_key_source, variant_name_template, sku_prefix)
VALUES
  ('bcfc0d02-44c6-48ae-8472-12b1a3f3d8e0','ProdReference','{product_name} | {color_name}','SPOT-'),
  ('d6718a29-e954-4c1b-bd84-03ea24884900','CodigoAmigavel','{product_name} | {color_name}',NULL)
ON CONFLICT (supplier_id) DO UPDATE SET
  parent_key_source     = EXCLUDED.parent_key_source,
  variant_name_template = EXCLUDED.variant_name_template,
  sku_prefix            = EXCLUDED.sku_prefix,
  updated_at            = now();