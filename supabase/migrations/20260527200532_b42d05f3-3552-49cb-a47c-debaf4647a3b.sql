DROP POLICY IF EXISTS "Public access for testing" ON public.products;
REVOKE SELECT ON public.products FROM anon;