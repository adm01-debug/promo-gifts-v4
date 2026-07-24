-- p2_acl_02: wrapper admin-gated para o sync manual de external_connections
--
-- Contexto: LastSyncRunPanel (UI admin) chamava
-- sync_external_connections_from_credentials() direto. Essa função é
-- SECURITY DEFINER SEM checagem de chamador (escolhe um admin arbitrário como
-- system actor) e teve EXECUTE corretamente revogado de anon/authenticated no
-- hardening — o botão "Executar sync" quebrou (42501).
--
-- Correção: wrapper SECURITY DEFINER que (1) exige papel admin do CHAMADOR e
-- (2) delega à função original, que permanece trancada para clientes.
-- O frontend passa a chamar fn_admin_sync_external_connections()
-- (src/integrations/supabase/gold.ts → rpcAdminSyncExternalConnections).

CREATE OR REPLACE FUNCTION public.fn_admin_sync_external_connections()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NOT public.has_role((SELECT auth.uid()), 'admin'::public.app_role) THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;
  RETURN public.sync_external_connections_from_credentials();
END;
$$;

COMMENT ON FUNCTION public.fn_admin_sync_external_connections() IS
  'Wrapper admin-gated do sync manual de external_connections. Chamado pela UI admin (LastSyncRunPanel). A função interna permanece sem EXECUTE para clientes.';

REVOKE ALL ON FUNCTION public.fn_admin_sync_external_connections() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.fn_admin_sync_external_connections() FROM anon;
GRANT EXECUTE ON FUNCTION public.fn_admin_sync_external_connections() TO authenticated;
GRANT EXECUTE ON FUNCTION public.fn_admin_sync_external_connections() TO service_role;
