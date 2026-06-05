
-- CRÍTICO: restaura paridade com process_spot_products (legada gravava product_type='product').
-- O mapping Type->products.product_type (direct) injeta categorias SPOT (SUCO, Escrita...)
-- que violam products_product_type_check, abortando o INSERT do produto (100% das refs).
-- Desativando, product_type cai no default da coluna ('product').
UPDATE public.supplier_field_mappings
   SET is_active = false, updated_at = now()
 WHERE supplier_id = 'bcfc0d02-44c6-48ae-8472-12b1a3f3d8e0'::uuid
   AND target_table = 'products' AND target_field = 'product_type' AND is_active = true;
