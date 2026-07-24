-- Melhoria 7: Hard-delete 5 XBZ-MANUAL (test entries, sem imagens, soft-deleted 2026-06-16)
DELETE FROM public.print_area_techniques WHERE product_id IN (SELECT id FROM products WHERE is_deleted=true AND sku LIKE 'XBZ-MANUAL-%');
DELETE FROM public.variant_supplier_sources WHERE variant_id IN (SELECT pv.id FROM product_variants pv JOIN products p ON p.id=pv.product_id WHERE p.is_deleted=true AND p.sku LIKE 'XBZ-MANUAL-%');
DELETE FROM public.products WHERE is_deleted=true AND sku LIKE 'XBZ-MANUAL-%';