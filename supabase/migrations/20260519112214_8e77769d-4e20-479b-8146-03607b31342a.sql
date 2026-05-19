-- ============================================================================
-- SANITIZADA EM 19/MAI/2026 — REMOVE PII E AMPLIA SEMÂNTICA
-- ============================================================================
--
-- ⚠️ HISTÓRICO DESTE ARQUIVO:
-- Originalmente continha um DELETE ad-hoc com email específico de um usuario
-- (PII) hardcoded — gerado pelo Lovable para destravar tentativas de login
-- bloqueadas por rate limit. Esse tipo de comando NUNCA deveria ter sido
-- commitado como migration permanente. Foi sanitizado nesta mesma data.
--
-- O QUE ESTA MIGRATION FAZ AGORA:
-- Limpa tentativas de login FALHADAS antigas (>30 dias) de TODA a tabela
-- login_attempts. Sem hardcoded de usuário. Sem PII no histórico do git.
--
-- IDEMPOTENTE: na 2ª execução, retorna 0 rows (todos já apagados).
-- ============================================================================

DELETE FROM public.login_attempts
WHERE success = false
  AND created_at < now() - interval '30 days';

DO $$
DECLARE
  _deleted integer;
BEGIN
  GET DIAGNOSTICS _deleted = ROW_COUNT;
  RAISE NOTICE '[cleanup_login_attempts] Removed % stale failed login attempts (>30 days old)', _deleted;
END $$;
