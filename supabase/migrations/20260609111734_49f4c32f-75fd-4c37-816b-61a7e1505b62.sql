-- Audit Fix: Security Definer Views (Linter ERROR 1 & 2)
-- Using SECURITY INVOKER ensures the view respects the RLS policies of the caller.
DROP VIEW IF EXISTS public.v_products_public;
CREATE VIEW public.v_products_public 
WITH (security_invoker = true)
AS SELECT * FROM public.products WHERE is_active = true;

GRANT SELECT ON public.v_products_public TO anon, authenticated;
GRANT ALL ON public.v_products_public TO service_role;

DROP VIEW IF EXISTS public.v_suppliers_public;
CREATE VIEW public.v_suppliers_public
WITH (security_invoker = true)
AS SELECT * FROM public.suppliers WHERE active = true;

GRANT SELECT ON public.v_suppliers_public TO anon, authenticated;
GRANT ALL ON public.v_suppliers_public TO service_role;

-- Audit Fix: Function Search Path Mutable (Linter WARN 3)
ALTER FUNCTION public.has_role(uuid, public.app_role) SET search_path = public;
ALTER FUNCTION public.is_admin(uuid) SET search_path = public;

-- Audit Fix: Performance optimization
CREATE INDEX IF NOT EXISTS idx_favorite_items_product_id ON public.favorite_items (product_id);
CREATE INDEX IF NOT EXISTS idx_collection_items_product_id ON public.collection_items (product_id);
CREATE INDEX IF NOT EXISTS idx_product_variants_product_id ON public.product_variants (product_id);
