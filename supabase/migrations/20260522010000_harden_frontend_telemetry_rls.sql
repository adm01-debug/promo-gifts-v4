-- ============================================================================
-- SEC-002 — Harden RLS on public.frontend_telemetry
-- ============================================================================
-- Source: auditoria back-end sênior 2026-05-22 (PR #55).
-- Status pré-fix: as policies `frontend_telemetry_insert_anon` e
--   `frontend_telemetry_insert_authenticated` usavam `WITH CHECK (true)`,
--   permitindo qualquer caller anônimo/autenticado inserir registros
--   arbitrários — abrindo vetor de DoS por inflação, log poisoning e
--   exfiltração via payloads de texto livre. Confirmado pelo Supabase
--   advisor `rls_policy_always_true` (lint 0024).
--
-- Estratégia deste fix:
--   1) Drop ambas as policies permissivas.
--   2) Recriar com `WITH CHECK` que:
--      - Para anon: força `user_id IS NULL` (anon NÃO pode impersonar usuário).
--      - Para authenticated: força `user_id = (select auth.uid())` (cada user
--        só insere registros próprios; usa subselect para evitar
--        `auth_rls_initplan` reavaliando por linha).
--      - Aplica caps de tamanho em todos os campos de texto (event_type,
--        name, url, user_agent, session_id) e metadata JSONB.
--   3) Adicionar CHECK constraint table-level como defesa em profundidade
--      (evita drift se alguém recriar a policy sem o cap).
--
-- Backwards compatibility:
--   • Hoje 100% das 322 linhas dos últimos 7d são anon (user_id NULL),
--     com max(length(metadata::text)) = 2532 e avg 836 — comfortavelmente
--     dentro dos limites desta migration.
--   • `src/services/telemetryService.ts` continua funcionando sem mudança
--     (sempre passa user_id implícito como NULL).
--
-- Idempotência: usa `DROP POLICY IF EXISTS` e `IF NOT EXISTS` no constraint.
-- ============================================================================

BEGIN;

-- 1) Drop policies permissivas (Supabase advisor `rls_policy_always_true`).
DROP POLICY IF EXISTS frontend_telemetry_insert_anon ON public.frontend_telemetry;
DROP POLICY IF EXISTS frontend_telemetry_insert_authenticated ON public.frontend_telemetry;

-- 2) Recriar com restrição apropriada por role.

-- 2a) Anon: pode inserir telemetria do front-end (page loads, erros pré-login),
--     mas NÃO pode forjar `user_id` (rows anon SEMPRE têm user_id IS NULL).
CREATE POLICY frontend_telemetry_insert_anon
  ON public.frontend_telemetry
  FOR INSERT
  TO anon
  WITH CHECK (
    user_id IS NULL
    AND length(coalesce(event_type, '')) BETWEEN 1 AND 64
    AND length(coalesce(name,       '')) BETWEEN 1 AND 256
    AND length(coalesce(url,        '')) <= 2048
    AND length(coalesce(user_agent, '')) <= 1024
    AND length(coalesce(session_id, '')) <= 128
    AND length(coalesce(metadata::text, '')) <= 8192
  );

-- 2b) Authenticated: insere apenas em nome próprio (user_id obrigatoriamente
--     = auth.uid()) OU como anon-style (user_id IS NULL — útil para boot
--     antes do session estar totalmente carregado).
CREATE POLICY frontend_telemetry_insert_authenticated
  ON public.frontend_telemetry
  FOR INSERT
  TO authenticated
  WITH CHECK (
    (user_id IS NULL OR user_id = (select auth.uid()))
    AND length(coalesce(event_type, '')) BETWEEN 1 AND 64
    AND length(coalesce(name,       '')) BETWEEN 1 AND 256
    AND length(coalesce(url,        '')) <= 2048
    AND length(coalesce(user_agent, '')) <= 1024
    AND length(coalesce(session_id, '')) <= 128
    AND length(coalesce(metadata::text, '')) <= 8192
  );

-- 3) Defesa em profundidade: CHECK constraint table-level.
--    Garante que mesmo se policy for recriada permissiva no futuro,
--    o tamanho do metadata fica capeado.
ALTER TABLE public.frontend_telemetry
  DROP CONSTRAINT IF EXISTS frontend_telemetry_size_caps_check;

ALTER TABLE public.frontend_telemetry
  ADD CONSTRAINT frontend_telemetry_size_caps_check
  CHECK (
    length(coalesce(event_type, '')) BETWEEN 1 AND 64
    AND length(coalesce(name,       '')) BETWEEN 1 AND 256
    AND length(coalesce(url,        '')) <= 2048
    AND length(coalesce(user_agent, '')) <= 1024
    AND length(coalesce(session_id, '')) <= 128
    AND length(coalesce(metadata::text, '')) <= 8192
  );

-- 4) Comentários para auditoria futura.
COMMENT ON POLICY frontend_telemetry_insert_anon ON public.frontend_telemetry IS
  'SEC-002 hardening (2026-05-22): exige user_id IS NULL para anon + caps de tamanho. '
  'Substitui WITH CHECK (true) anterior.';

COMMENT ON POLICY frontend_telemetry_insert_authenticated ON public.frontend_telemetry IS
  'SEC-002 hardening (2026-05-22): exige user_id = auth.uid() (ou NULL) + caps. '
  'Substitui WITH CHECK (true) anterior.';

COMMENT ON CONSTRAINT frontend_telemetry_size_caps_check ON public.frontend_telemetry IS
  'SEC-002 defesa em profundidade — caps de tamanho não dependem da policy ativa.';

COMMIT;
