-- Hardening: substituir WITH CHECK (true) por filtro explícito de papel
-- em 5 policies de INSERT que só devem ser exercidas pelo service_role.
-- service_role bypassa RLS por design, então a verificação é redundante
-- em runtime — mas elimina o lint 0024 (permissive RLS) e documenta a intenção.

-- 1. ai_usage_logs
DROP POLICY IF EXISTS "Service role can insert AI usage logs" ON public.ai_usage_logs;
CREATE POLICY "Service role can insert AI usage logs"
  ON public.ai_usage_logs
  FOR INSERT
  TO service_role
  WITH CHECK ((auth.jwt() ->> 'role') = 'service_role');

-- 2. bot_detection_log
DROP POLICY IF EXISTS "Service role can insert bot log" ON public.bot_detection_log;
CREATE POLICY "Service role can insert bot log"
  ON public.bot_detection_log
  FOR INSERT
  TO service_role
  WITH CHECK ((auth.jwt() ->> 'role') = 'service_role');

-- 3. connection_test_history
DROP POLICY IF EXISTS "Service role inserts connection_test_history" ON public.connection_test_history;
CREATE POLICY "Service role inserts connection_test_history"
  ON public.connection_test_history
  FOR INSERT
  TO service_role
  WITH CHECK ((auth.jwt() ->> 'role') = 'service_role');

-- 4. login_attempts
DROP POLICY IF EXISTS "Service role can insert login attempts" ON public.login_attempts;
CREATE POLICY "Service role can insert login attempts"
  ON public.login_attempts
  FOR INSERT
  TO service_role
  WITH CHECK ((auth.jwt() ->> 'role') = 'service_role');

-- 5. public_token_failures
DROP POLICY IF EXISTS "Service role inserts token failures" ON public.public_token_failures;
CREATE POLICY "Service role inserts token failures"
  ON public.public_token_failures
  FOR INSERT
  TO service_role
  WITH CHECK ((auth.jwt() ->> 'role') = 'service_role');