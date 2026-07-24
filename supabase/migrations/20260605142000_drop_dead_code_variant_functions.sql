-- fn_extract_asia_variants, fn_process_staged_variant e fn_process_all_staged_variants
-- referenciam supplier_variants_raw que não existe no schema atual.
-- São resíduos do pipeline legado pre-V2 e falharão com "relation does not exist"
-- se chamadas. Removidas para evitar erro silencioso em chamadas acidentais.

DROP FUNCTION IF EXISTS public.fn_extract_asia_variants(uuid);
DROP FUNCTION IF EXISTS public.fn_process_staged_variant(uuid);
DROP FUNCTION IF EXISTS public.fn_process_all_staged_variants(uuid, integer);
