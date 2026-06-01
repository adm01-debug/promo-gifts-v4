DROP POLICY IF EXISTS "Temp public read products" ON public.products;
REVOKE SELECT ON public.products FROM anon;