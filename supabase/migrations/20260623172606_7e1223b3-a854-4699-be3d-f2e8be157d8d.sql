-- Remove enforcement de limite de 10 carrinhos no backend.
-- Decisão do PO: o limite passa a ser apenas indicação na UI (banner do sidebar),
-- permitindo criação livre via /carrinhos e demais superfícies.
DROP TRIGGER IF EXISTS enforce_seller_cart_limit ON public.seller_carts;
DROP TRIGGER IF EXISTS enforce_seller_cart_limit_update ON public.seller_carts;
DROP FUNCTION IF EXISTS public.check_seller_cart_limit();
DROP FUNCTION IF EXISTS public.enforce_seller_cart_limit();