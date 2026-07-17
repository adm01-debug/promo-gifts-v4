-- ============================================================================
-- ROLLBACK — reverte 2026-07-13_secdef_revoke_webhook_locks.sql
-- ----------------------------------------------------------------------------
-- Draft (NÃO executar sem aprovação do PO — CLAUDE.md §Comportamento obrigatório)
-- Alvo: doufsxqlfjyuvxuezpln
--
-- Contexto
--   A migração original revogou EXECUTE de PUBLIC/anon/authenticated em três
--   funções SECURITY DEFINER usadas apenas via edge/cron (service_role):
--     • claim_webhook_delivery(uuid, text)
--     • release_webhook_delivery_lock(uuid, text)
--     • cleanup_stale_webhook_locks()
--
-- Quando aplicar este rollback
--   1. Regressão comprovada em edge function que — por bug — não usa
--      service_role e acaba caindo em anon/authenticated ao chamar RPC.
--   2. Incidente com bloqueio de fluxo crítico rastreado a estas funções.
--   3. Necessidade de acesso emergencial via SQL editor autenticado.
--
--   Em qualquer outro caso, NÃO reverter — as funções são internas ao
--   dispatcher de webhooks e não devem ser expostas.
--
-- Estado que este script recria
--   Antes da migração original, o Postgres aplicava os defaults padrão de
--   `public`: EXECUTE para PUBLIC (herdado por anon e authenticated) +
--   EXECUTE explícito para service_role (via role hierarchy). Este script
--   restaura ESSE estado *sem* remover o GRANT explícito para service_role
--   (que continua sendo o consumidor real e não custa nada manter).
--
-- Idempotência
--   REVOKE + GRANT são idempotentes no Postgres — rodar duas vezes é safe.
--   Envolvemos em BEGIN/COMMIT para atomicidade caso qualquer statement
--   falhe (ex: assinatura de função mudou).
--
-- Verificação pós-rollback
--   -- deve mostrar as 3 funções com anon+authenticated+PUBLIC EXECUTE:
--   SELECT p.proname, pg_catalog.array_to_string(p.proacl, E'\n') AS acl
--     FROM pg_proc p
--     JOIN pg_namespace n ON n.oid = p.pronamespace
--    WHERE n.nspname = 'public'
--      AND p.proname IN (
--        'claim_webhook_delivery',
--        'release_webhook_delivery_lock',
--        'cleanup_stale_webhook_locks'
--      );
--
--   node scripts/check-security-definer-acl.mjs   -- voltará a 7 violações
-- ============================================================================

BEGIN;

-- 1) claim_webhook_delivery
GRANT EXECUTE ON FUNCTION public.claim_webhook_delivery(uuid, text) TO PUBLIC;
GRANT EXECUTE ON FUNCTION public.claim_webhook_delivery(uuid, text) TO anon, authenticated, service_role;

-- 2) release_webhook_delivery_lock
GRANT EXECUTE ON FUNCTION public.release_webhook_delivery_lock(uuid, text) TO PUBLIC;
GRANT EXECUTE ON FUNCTION public.release_webhook_delivery_lock(uuid, text) TO anon, authenticated, service_role;

-- 3) cleanup_stale_webhook_locks
GRANT EXECUTE ON FUNCTION public.cleanup_stale_webhook_locks() TO PUBLIC;
GRANT EXECUTE ON FUNCTION public.cleanup_stale_webhook_locks() TO anon, authenticated, service_role;

COMMIT;

-- ----------------------------------------------------------------------------
-- Nota de segurança
--   Aplicar este rollback reabre a superfície SECURITY DEFINER a qualquer
--   sessão anon/authenticated. NÃO deixe aplicado além do tempo estritamente
--   necessário para diagnóstico do incidente. Reaplique a migração original
--   (`2026-07-13_secdef_revoke_webhook_locks.sql`) assim que possível.
-- ============================================================================
