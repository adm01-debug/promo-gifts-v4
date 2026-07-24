-- ============================================================================
-- FIX (advisor lint 0026 pg_graphql_anon_table_exposed, descoberto em teste)
-- ----------------------------------------------------------------------------
-- A view de monitoramento v_product_images_quality_gap estava legível por anon
-- (exposta no GraphQL/PostgREST). É telemetria operacional interna (gaps por
-- fornecedor) -> não deve ser anon-readable. Least-privilege: revoga de
-- PUBLIC/anon/authenticated; concede só a service_role.
-- Verificado: anon=false, authenticated=false, service_role=true.
-- ============================================================================

REVOKE ALL ON public.v_product_images_quality_gap FROM PUBLIC;
REVOKE ALL ON public.v_product_images_quality_gap FROM anon;
REVOKE ALL ON public.v_product_images_quality_gap FROM authenticated;
GRANT SELECT ON public.v_product_images_quality_gap TO service_role;
