-- =============================================================================
-- Aplicada na live como version 20260523203022.
-- HARDENING: remove EXECUTE de PUBLIC/anon/authenticated em TODAS as funções
-- RETURNS trigger do schema public.
-- Trigger functions são invocadas pelo mecanismo de trigger (no contexto do
-- owner/definer), NUNCA precisam de GRANT EXECUTE ao chamador da DML. Conceder
-- EXECUTE a anon/authenticated só amplia a superfície via /rest/v1/rpc.
-- Mantém postgres e service_role. Zero impacto funcional nas triggers.
-- Corrige tg_ip_access_control_set_updated_at no advisor security_definer_*
-- (de 14 para 12 funções SECURITY DEFINER executáveis) e remove ~140 trigger
-- functions da superfície RPC (defense-in-depth / menor privilégio).
-- =============================================================================
DO $$
DECLARE
  fn record;
BEGIN
  FOR fn IN
    SELECT p.oid::regprocedure AS sig
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    JOIN pg_type t ON t.oid = p.prorettype
    WHERE n.nspname = 'public' AND t.typname = 'trigger'
  LOOP
    EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM PUBLIC, anon, authenticated;', fn.sig);
  END LOOP;
END $$;
