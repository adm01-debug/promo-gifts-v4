-- ============================================================================
-- Draft (NÃO executar sem aprovação do PO — CLAUDE.md #Comportamento obrigatório)
-- ----------------------------------------------------------------------------
-- Contexto
--   supabase--linter (2026-07-13) apontou 57 findings 0028/0029 (SECURITY
--   DEFINER executável por PUBLIC/anon/authenticated). Baseline aceito em
--   .security/supabase-linter-baseline.json cobre 48 funções (RLS helpers +
--   RPCs do frontend). O diff atual identifica 4 funções fora do baseline:
--
--     Só edge/cron (service_role) — devem ter EXECUTE revogado:
--       • claim_webhook_delivery(p_webhook_id uuid, p_payload_hash text)
--       • release_webhook_delivery_lock(p_webhook_id uuid, p_payload_hash text)
--       • cleanup_stale_webhook_locks()
--
--     Frontend RPC intencional — mantém, só adicionar ao baseline:
--       • restore_seller_cart(_snapshot jsonb)   -- chamada em
--         src/hooks/products/useSellerCarts.ts:325
--
-- Callers verificados
--   supabase/functions/webhook-dispatcher/index.ts:254,373
--     (rpc('claim_webhook_delivery' / 'release_webhook_delivery_lock'))
--   Edge functions rodam como service_role → não são afetadas pelo REVOKE.
--   cleanup_stale_webhook_locks é acionada por cron/edge (mesma classe).
--
-- Efeito esperado
--   • Fecha 3 findings (2 de 0028 + 3 de 0029, contando overloads).
--   • Nenhuma quebra de superfície pública/autenticada.
--
-- Rollback
--   GRANT EXECUTE ON FUNCTION public.<fn>(...) TO authenticated, anon;
--
-- Aprovação
--   PO deve confirmar antes de aplicar via supabase--migration. Este arquivo
--   fica em qa/migrations-draft/ conforme convenção (mesmo padrão de
--   2026-06-18_security_definer_acl.sql e 2026-06-20_revoke_secdef_from_authenticated.sql).
-- ============================================================================

BEGIN;

-- 1) claim_webhook_delivery — atomic delivery lock, chamada só em edge
REVOKE EXECUTE ON FUNCTION public.claim_webhook_delivery(uuid, text) FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.claim_webhook_delivery(uuid, text) TO service_role;

-- 2) release_webhook_delivery_lock — libera lock após entrega
REVOKE EXECUTE ON FUNCTION public.release_webhook_delivery_lock(uuid, text) FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.release_webhook_delivery_lock(uuid, text) TO service_role;

-- 3) cleanup_stale_webhook_locks — limpeza de locks expirados (cron)
REVOKE EXECUTE ON FUNCTION public.cleanup_stale_webhook_locks() FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.cleanup_stale_webhook_locks() TO service_role;

COMMIT;

-- ----------------------------------------------------------------------------
-- Passo pós-migração (NÃO aplicar até PO aprovar a migração acima):
--
-- Atualizar .security/supabase-linter-baseline.json para aceitar
-- restore_seller_cart como RPC intencional do frontend. Diff:
--
--   { "lint": "0029_authenticated_security_definer_function_executable",
--     "name": "restore_seller_cart" }
--
-- Justificativa no commit:
--   "restore_seller_cart é RPC pública do frontend (useSellerCarts.ts:325).
--    RLS interna à função filtra por auth.uid(). SECURITY DEFINER necessário
--    para bypass de RLS controlado no INSERT do cart+items."
-- ============================================================================
