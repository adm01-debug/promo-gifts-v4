-- Conceder SELECT nas tabelas principais para usuários authenticated e anon
-- (A segurança real é aplicada via RLS nessas tabelas)
GRANT SELECT ON public.products TO authenticated, anon;
GRANT SELECT ON public.suppliers TO authenticated, anon;
GRANT SELECT ON public.categories TO authenticated, anon;
GRANT SELECT ON public.product_variants TO authenticated, anon;
GRANT SELECT ON public.variant_supplier_sources TO authenticated, anon;

-- Conceder SELECT nas views de segurança
GRANT SELECT ON public.v_products_public TO authenticated, anon;
GRANT SELECT ON public.v_suppliers_public TO authenticated, anon;
