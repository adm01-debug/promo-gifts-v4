-- PASSO 50: Adicionar índice e cleanup automático em user_token_revocations (T37)
-- Tabela sem índice — se ativada em produção degrada rapidamente
-- Nota: sem CONCURRENTLY para compatibilidade com transações de migration (Supabase branching).

-- Índice para lookup eficiente por token + validade
DO $$
BEGIN
  IF (SELECT count(*) FROM information_schema.columns WHERE table_schema='public' AND table_name='user_token_revocations' AND column_name IN ('token_jti')) = 1 THEN
    CREATE INDEX IF NOT EXISTS idx_token_revocations_token
  ON user_token_revocations(token_jti)
  WHERE expires_at > NOW();
  END IF;
END $$;

-- Índice para limpeza por expiração
DO $$
BEGIN
  IF (SELECT count(*) FROM information_schema.columns WHERE table_schema='public' AND table_name='user_token_revocations' AND column_name IN ('expires_at')) = 1 THEN
    CREATE INDEX IF NOT EXISTS idx_token_revocations_expires
  ON user_token_revocations(expires_at);
  END IF;
END $$;

-- Job de limpeza automática de tokens expirados (evita crescimento ilimitado)
SELECT cron.schedule(
  'cleanup-expired-token-revocations',
  '0 * * * *',  -- a cada hora
  $$DELETE FROM user_token_revocations WHERE expires_at < NOW() - INTERVAL '5 minutes'$$
) WHERE NOT EXISTS (
  SELECT 1 FROM cron.job WHERE jobname = 'cleanup-expired-token-revocations'
);
