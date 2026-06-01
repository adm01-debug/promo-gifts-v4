UPDATE public.products 
SET featured = false, new_arrival = false, on_sale = false 
WHERE id = 'bea8bd6e-14f4-4482-921d-ecc179391166';

DROP POLICY IF EXISTS "Temp public read products" ON public.products;
REVOKE SELECT ON public.products FROM anon;