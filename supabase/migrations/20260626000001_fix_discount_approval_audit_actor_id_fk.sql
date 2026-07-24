-- =============================================================
-- MIGRATION: fix_discount_approval_audit_actor_id_fk
-- Data: 2026-06-26
-- Autor: Claude (Dev Senior)
--
-- BUG REPORTADO:
--   GET /rest/v1/discount_approval_audit?select=...actor:actor_id(full_name,email)...
--   retornava HTTP 400 Bad Request em loop infinito no frontend.
--
-- ROOT CAUSE:
--   O componente DiscountApprovalAuditTrail.tsx usa o join embedded
--   PostgREST "actor:actor_id(full_name,email)" para buscar nome/email
--   do ator de cada evento de auditoria.
--
--   O PostgREST resolve joins embedded EXCLUSIVAMENTE via Foreign Keys.
--   A coluna actor_id em discount_approval_audit NÃO tinha nenhuma FK
--   declarada → PostgREST não conseguia inferir a tabela-alvo do join
--   → retornava HTTP 400 "Bad Request" (query inválida/irresolvível).
--
-- EVIDÊNCIA DO TRIGGER:
--   fn_audit_discount_approval popula actor_id com:
--     - NEW.seller_id (INSERT) → FK de discount_approval_requests → profiles(user_id)
--     - NEW.admin_id  (UPDATE) → FK de discount_approval_requests → profiles(user_id)
--   Portanto actor_id sempre armazena um valor de profiles.user_id (= auth.users.id).
--
-- FIX APLICADO:
--   1. FK: discount_approval_audit.actor_id → profiles(user_id) ON DELETE SET NULL
--      Permite ao PostgREST resolver "actor:actor_id(full_name,email)"
--      fazendo JOIN em profiles WHERE profiles.user_id = actor_id.
--
--   2. Índice parcial em actor_id (WHERE actor_id IS NOT NULL):
--      Evita Sequential Scan em discount_approval_audit durante
--      operações de CASCADE em profiles.
--
-- ANTI-REGRESSION: Lovable bot must not remove this FK or index.
-- fix_version: dar_audit_actor_fk_v1
-- =============================================================

-- 1. FK: resolve o join PostgREST actor:actor_id(full_name,email)
ALTER TABLE public.discount_approval_audit
  ADD CONSTRAINT discount_approval_audit_actor_id_fkey
  FOREIGN KEY (actor_id)
  REFERENCES public.profiles(user_id)
  ON DELETE SET NULL;

-- 2. Índice suporte: evita seq scan em cascatas de UPDATE/DELETE em profiles
CREATE INDEX IF NOT EXISTS idx_discount_approval_audit_actor_id
  ON public.discount_approval_audit(actor_id)
  WHERE actor_id IS NOT NULL;

-- 3. Reload schema cache do PostgREST para reconhecer a nova FK imediatamente
NOTIFY pgrst, 'reload schema';
