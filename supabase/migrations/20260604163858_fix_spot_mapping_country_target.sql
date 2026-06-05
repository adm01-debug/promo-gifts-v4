-- Corrige regra ativa do Spot que apontava para coluna inexistente.
-- products.country_of_origin NÃO existe; a coluna real é products.origin_country.
-- Camada: supplier_field_mappings (intermediária). Não escreve no gold.
UPDATE supplier_field_mappings
SET target_field = 'origin_country',
    updated_at   = now()
WHERE supplier_id  = 'bcfc0d02-44c6-48ae-8472-12b1a3f3d8e0'
  AND target_table = 'products'
  AND target_field = 'country_of_origin';