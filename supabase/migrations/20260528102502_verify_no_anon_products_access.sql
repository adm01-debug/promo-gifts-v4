-- Ensure the "Temp public read products" policy and anonymous SELECT grant
-- are definitively removed. The original reverts (20260527214425 and 20260527214617)
-- should have handled this, but this migration provides an idempotent safety net.

DROP POLICY IF EXISTS "Temp public read products" ON public.products;
REVOKE SELECT ON public.products FROM anon;
