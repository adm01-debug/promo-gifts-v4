-- Hardening derivado da auditoria de segurança via MCP (2026-05-24).
--
-- Achados tratados:
--   1. Funções SECURITY DEFINER internas executáveis por anon/authenticated.
--      - cleanup_expired_webhook_request_nonces(): rotina de manutenção, deve
--        rodar apenas via pg_cron (postgres) / service_role.
--      - get_public_schema_signatures(): introspecção de schema, não deve ser
--        chamável pelo cliente. Nenhuma das duas é invocada pelo front-end
--        (verificado em src/ e supabase/functions/).
--      postgres e service_role mantêm EXECUTE — pg_cron e edge functions seguem
--      funcionando.
--   2. password_reset_requests tinha política de INSERT irrestrita ("Anyone can
--      request a password reset", WITH CHECK true) sem qualquer limite de taxa.
--      Como anon NÃO tem SELECT na tabela, o limite precisa de uma função
--      SECURITY DEFINER para contar solicitações recentes. Limite: 3 por e-mail
--      a cada 60 minutos (mitiga flood/abuso sem bloquear uso legítimo).

-- 1. Revoga EXECUTE das funções internas dos papéis expostos via API ------------
REVOKE EXECUTE ON FUNCTION public.cleanup_expired_webhook_request_nonces()
  FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.get_public_schema_signatures()
  FROM anon, authenticated;

-- 2. Rate-limit de solicitações de reset de senha ------------------------------
CREATE OR REPLACE FUNCTION public.enforce_password_reset_rate_limit()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  recent_count integer;
  window_minutes constant integer := 60;
  max_requests   constant integer := 3;
BEGIN
  -- Conta solicitações recentes do mesmo e-mail (case-insensitive).
  -- SECURITY DEFINER é necessário porque anon não possui SELECT na tabela.
  SELECT count(*) INTO recent_count
  FROM public.password_reset_requests
  WHERE lower(email) = lower(NEW.email)
    AND requested_at > now() - make_interval(mins => window_minutes);

  IF recent_count >= max_requests THEN
    RAISE EXCEPTION 'Muitas solicitações de redefinição de senha. Tente novamente mais tarde.'
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_password_reset_rate_limit ON public.password_reset_requests;
CREATE TRIGGER trg_password_reset_rate_limit
  BEFORE INSERT ON public.password_reset_requests
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_password_reset_rate_limit();
