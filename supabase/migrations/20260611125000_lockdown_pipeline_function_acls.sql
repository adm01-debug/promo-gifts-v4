-- ════════════════════════════════════════════════════════════════
-- LOCKDOWN de ACLs das funções do pipeline (advisors 2026-06-11).
-- ════════════════════════════════════════════════════════════════
-- Achado #7 da auditoria: regressões e brechas de EXECUTE em
-- SECURITY DEFINER do pipeline:
--   • fn_standardize_kit_component / fn_promote_kit_component_padronizacao:
--     executáveis por PUBLIC e anon (!) — qualquer visitante podia
--     disparar padronização/promoção de kits.
--   • fn_standardize_supplier: lockdown de 20260605160500 REGREDIU
--     (authenticated=X voltou, provavelmente via default privileges em
--     re-deploy posterior).
--   • fn_pipeline_promote_tick / fn_dryrun_raw_v2 / fn_sm_site_promote:
--     authenticated podia executar (são jobs de cron/ferramentas internas).
-- Contrato: pipeline executável APENAS por postgres + service_role.
-- (Os guards internos de admin continuam como defesa em profundidade.)
-- ════════════════════════════════════════════════════════════════

DO $$
DECLARE
  fn record;
BEGIN
  FOR fn IN
    SELECT format('%I.%I(%s)', n.nspname, p.proname,
                  pg_get_function_identity_arguments(p.oid)) AS sig
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname IN (
        'fn_standardize_supplier',
        'fn_pipeline_promote_tick',
        'fn_dryrun_raw_v2',
        'fn_dryrun_standardize_supplier',
        'fn_standardize_kit_component',
        'fn_promote_kit_component_padronizacao',
        'fn_sm_site_promote')
  LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC', fn.sig);
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM anon', fn.sig);
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM authenticated', fn.sig);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO postgres', fn.sig);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role', fn.sig);
  END LOOP;
END $$;

-- search_path fixo na função apontada pelo advisor (mutable)
ALTER FUNCTION public.fn_sm_site_promote(integer) SET search_path TO 'public', 'extensions';
