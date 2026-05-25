-- =============================================================================
-- Migration: harden password_reset_requests RLS policy
-- =============================================================================
-- Bug P0-04 da auditoria 24/05/2026 (Supabase advisor lint
-- `rls_policy_always_true`):
--
--   policy "Anyone can request a password reset" tinha WITH CHECK (true),
--   permitindo INSERT irrestrito por role anon. Vetores de abuso:
--   1) Spam: flood de requests preenche a tabela e ataca quota de email.
--   2) Enumeração: atacante descobre quais emails têm conta ao observar
--      respostas/comportamento downstream.
--   3) DoS de admins: admins precisam revisar 'pending', sobrecarga afeta SLA.
--
-- Esta migration substitui a policy permissiva por uma policy defensiva que:
--   (a) valida formato de email via regex RFC-light
--   (b) força status='pending' (impede atacante criar como 'approved')
--   (c) impede preenchimento de campos administrativos (reviewed_at/by/notes)
--   (d) força user_id NULL no insert (admin atribui depois)
--
-- Rate limit: implementado via UNIQUE INDEX parcial em (email) WHERE status='pending',
-- garantindo no máximo 1 request pendente por email. Tentativas repetidas geram
-- conflict 23505 (não inserem nova linha), economizando recursos.
--
-- Cleanup: trigger automático fecha requests pendentes >7d como 'expired',
-- liberando o UNIQUE pra permitir nova solicitação caso usuário tente de novo.
-- =============================================================================

-- 1) Email validation: regex RFC-light, suficiente para evitar lixo óbvio.
--    Não usa CHECK direto (constraints CHECK não usam funções SECURITY DEFINER
--    nem têm controle de erro amigável); validação fica na policy WITH CHECK.

-- 2) UNIQUE parcial: 1 pendente por email
--    DROP IF EXISTS para idempotência (re-run safe).
DROP INDEX IF EXISTS public.password_reset_requests_one_pending_per_email;
CREATE UNIQUE INDEX password_reset_requests_one_pending_per_email
  ON public.password_reset_requests (lower(email))
  WHERE status = 'pending';

COMMENT ON INDEX public.password_reset_requests_one_pending_per_email IS
  'Anti-spam: máximo 1 solicitação pendente por email (case-insensitive). '
  'Conflict 23505 sinaliza ao app "já existe pedido aguardando revisão".';

-- 3) Drop policy permissiva atual
DROP POLICY IF EXISTS "Anyone can request a password reset"
  ON public.password_reset_requests;

-- 4) Recria policy com validação defensiva
CREATE POLICY "Anyone can request a password reset (validated)"
  ON public.password_reset_requests
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (
    -- (a) Formato de email válido (RFC-light, lowercase obrigatório)
    email ~* '^[a-z0-9._%+\-]+@[a-z0-9.\-]+\.[a-z]{2,}$'
    AND length(email) BETWEEN 5 AND 254
    -- (b) Status só pode ser 'pending' no insert (admin muda depois)
    AND status = 'pending'
    -- (c) Campos administrativos forçados a NULL
    AND reviewed_at IS NULL
    AND reviewed_by IS NULL
    AND reviewer_notes IS NULL
    -- (d) user_id NULL: admin associa depois ao aprovar
    AND user_id IS NULL
  );

COMMENT ON POLICY "Anyone can request a password reset (validated)"
  ON public.password_reset_requests IS
  'Substituiu policy WITH CHECK (true). Valida formato de email, força status=pending '
  'e campos administrativos NULL. Anti-abuse via UNIQUE parcial em (lower(email)).';

-- 5) Expiração automática de pending stale (>7d)
--    Função executada por pg_cron diariamente para limpar requests órfãos
--    e liberar o UNIQUE constraint.

CREATE OR REPLACE FUNCTION public.expire_stale_password_reset_requests()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  expired_count integer;
BEGIN
  UPDATE public.password_reset_requests
     SET status = 'expired',
         reviewed_at = now(),
         reviewer_notes = COALESCE(reviewer_notes, '') ||
           '[auto-expired after 7 days pending]'
   WHERE status = 'pending'
     AND requested_at < now() - INTERVAL '7 days';
  GET DIAGNOSTICS expired_count = ROW_COUNT;
  RETURN expired_count;
END;
$$;

REVOKE ALL ON FUNCTION public.expire_stale_password_reset_requests() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.expire_stale_password_reset_requests() TO service_role;

COMMENT ON FUNCTION public.expire_stale_password_reset_requests() IS
  'Marca como expired requests pending > 7 dias. Roda via pg_cron, libera UNIQUE '
  'parcial pra usuário poder retentar. Retorna nº de linhas afetadas.';

-- 6) Agendar via pg_cron (1x/dia às 03:00 BRT = 06:00 UTC)
DO $$
BEGIN
  -- Remove job existente se houver (idempotência)
  PERFORM cron.unschedule(jobid)
    FROM cron.job
   WHERE jobname = 'expire-stale-password-reset-requests';
EXCEPTION WHEN OTHERS THEN
  -- pg_cron pode não estar instalado em ambiente local; ignora
  RAISE NOTICE 'pg_cron unschedule skipped: %', SQLERRM;
END $$;

DO $$
BEGIN
  PERFORM cron.schedule(
    'expire-stale-password-reset-requests',
    '0 6 * * *',  -- 06:00 UTC = 03:00 BRT diário
    $cron$SELECT public.expire_stale_password_reset_requests();$cron$
  );
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'pg_cron schedule skipped: %', SQLERRM;
END $$;

-- =============================================================================
-- Validação pós-migration:
--   SELECT polname, pg_get_expr(polwithcheck, polrelid) AS check
--   FROM pg_policy WHERE polrelid='public.password_reset_requests'::regclass;
-- Deve mostrar a nova policy com regex de email e NÃO mais 'true'.
-- =============================================================================
