-- BUG-SF-RPC-ARITY: remove old 5-param overload of fn_super_filtro_product_ids.
-- The 6-param version (with _endomarketing) was added in 20260618160000_fn_super_filtro_add_endomarketing.sql.
-- Without dropping the old signature, Postgres kept both overloads and the client
-- (useProductsByMetadata) was calling the 6-param version unambiguously, but the
-- old 5-param ghost caused planning overhead and risk of ambiguous resolution.
-- Safe to drop: no caller uses 5 params — the TS client always sends all 6.

DROP FUNCTION IF EXISTS public.fn_super_filtro_product_ids(
  text[], text[], text[], text[], text[]
);
