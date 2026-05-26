-- PASSO 50: Adicionar índice e cleanup automático em user_token_revocations (T37)
-- Tabela sem índice — se ativada em produção degrada rapidamente
-- Nota: sem CONCURRENTLY para compatibilidade com transações de migration (Supabase branching).

-- Índice para lookup eficiente por token + validade
CREATE INDEX IF NOT EXISTS idx_token_revocations_token
  ON user_token_revocations(token_jti)
  WHERE expires_at > NOW();

-- Índice para limpeza por expiração
CREATE INDEX IF NOT EXISTS idx_token_revocations_expires
  ON user_token_revocations(expires_at);

-- Job de limpeza automática de tokens expirados (evita crescimento ilimitado)
SELECT cron.schedule(
  'cleanup-expired-token-revocations',
  '0 * * * *',  -- a cada hora
  $$DELETE FROM user_token_revocations WHERE expires_at < NOW() - INTERVAL '5 minutes'$$
) WHERE NOT EXISTS (
  SELECT 1 FROM cron.job WHERE jobname = 'cleanup-expired-token-revocations'
);
