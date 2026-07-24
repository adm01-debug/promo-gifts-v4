-- Duas correções identificadas na validação pós-colapso (2026-06-01).
--
-- FIX 1 — fn_run_and_persist_smoke_tests falhava em pg_cron com "not authorized"
--   O cron job smoke_tests_monthly (0 3 1 * *) chamava esta função sem contexto JWT.
--   auth.uid() retorna NULL em pg_cron → is_admin_or_above(NULL) = false → RAISE.
--   Além disso, PostgreSQL 17 proíbe SET/RESET ROLE dentro de funções SECURITY DEFINER
--   aninhadas (fn_run_smoke_tests faz EXECUTE 'RESET role' na linha 130).
--
--   Correção: remover SECURITY DEFINER da função externa. Segurança mantida em 2 camadas:
--     a) RLS de smoke_test_runs (smoke_test_runs_insert_admin exige is_admin_or_above)
--        — bloqueia INSERT direto por authenticated não-admin
--     b) Guard request.jwt.claim.role no corpo — bloqueia chamadas HTTP não-admin;
--        pg_cron (sem contexto JWT) passa diretamente e usa postgres/superuser.
--
-- FIX 2 — Política SELECT duplicada em system_kill_switches (multiple_permissive)
--   Após a migração de consolidação da sessão anterior, ficaram duas policies SELECT:
--     * kill_switches_read_all  (TO anon, authenticated, USING true) — correta
--     * anon_read_kill_switches (TO public, USING true)              — redundante
--   Removemos a redundante. kill_switches_read_all cobre anon + authenticated;
--   service_role/postgres bypass RLS de qualquer forma.

-- FIX 1: sem SECURITY DEFINER (pg_cron executa como postgres → bypassa RLS)
-- Replay-safe: DROP antes do CREATE OR REPLACE para evitar 42P13 em casos
-- onde o snapshot do preview tenha a função com tipo diferente.
DROP FUNCTION IF EXISTS public.fn_run_and_persist_smoke_tests();
CREATE OR REPLACE FUNCTION public.fn_run_and_persist_smoke_tests()
 RETURNS void
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
DECLARE
  v_ran_at timestamptz := now();
BEGIN
  -- Quando chamado pelo PostgREST, request.jwt.claim.role está sempre preenchido
  -- (mesmo para anon). Quando chamado pelo pg_cron, o setting é NULL.
  -- Assim: cron/service passam; chamadas HTTP exigem admin.
  IF coalesce(current_setting('request.jwt.claim.role', true), '') != ''
     AND NOT public.is_admin_or_above((SELECT auth.uid()))
  THEN
    RAISE EXCEPTION 'not authorized';
  END IF;

  INSERT INTO public.smoke_test_runs (ran_at, test_name, test_category, result, details, duration_ms)
  SELECT v_ran_at, test_name, test_category, result, details, duration_ms
  FROM public.fn_run_smoke_tests();
END
$function$;

-- FIX 2: remove policy SELECT redundante
DROP POLICY IF EXISTS anon_read_kill_switches ON public.system_kill_switches;
