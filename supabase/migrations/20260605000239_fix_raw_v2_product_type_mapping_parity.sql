-- CRÍTICO: restaura paridade com process_spot_products (legada gravava product_type='product').
-- O mapping Type->products.product_type (transform 'direct', ativo) injeta as CATEGORIAS da
-- SPOT (SUCO, Escrita, Tecnologia, ...) na coluna product_type, que tem
-- CHECK (product_type IN (product|packaging|accessory|kit|component)). Isso aborta o UPDATE
-- do produto; como INSERT e UPDATE correm no mesmo bloco BEGIN/EXCEPTION por parent, o rollback
-- ao savepoint desfaz o INSERT -> o produto nunca é criado e a raw fica 'pending' (retry
-- infinito), enquanto fn_process_raw_v2 retorna success:true. Blast radius medido: 1200/1200
-- ProdReferences (100%). Ref.: docs/AUDITORIA_GAPS_CRITICOS_fn_process_raw_v2_2026-06-04.md
--
-- Desativando o mapping, product_type cai no default da coluna ('product') = comportamento legado.
UPDATE public.supplier_field_mappings
   SET is_active = false, updated_at = now()
 WHERE supplier_id = 'bcfc0d02-44c6-48ae-8472-12b1a3f3d8e0'::uuid
   AND target_table = 'products' AND target_field = 'product_type' AND is_active = true;
