-- ============================================================
-- Fix: 4 divergências de schema identificadas na auditoria de migrations
-- Executado em 2026-05-26
-- ============================================================

-- 1. RPC update_quote_transactional — schema completo correto
-- (ver migration 20260526121000 para o corpo completo)
-- Divergências corrigidas:
--   quotes: discount_value→discount_amount, total_amount→total, expires_at→valid_until
--   quote_items: discount_percent→discount_percentage, discount_value→discount_amount, line_total→subtotal
--   quote_item_personalizations: location→location_code, colors→colors_count, quantity→personalized_quantity

-- 2. integration_credentials — índice no campo real (provider, não name)
CREATE INDEX IF NOT EXISTS idx_integration_creds_provider
  ON public.integration_credentials(provider, is_active);
CREATE INDEX IF NOT EXISTS idx_integration_creds_secret_name
  ON public.integration_credentials(secret_name)
  WHERE is_active = true;

-- 3. color_variations — índice nos campos reais de query (group_id, não product_id)
CREATE INDEX IF NOT EXISTS idx_color_variations_active_group
  ON public.color_variations(group_id, is_active)
  WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_color_variations_color_group
  ON public.color_variations(color_group_id)
  WHERE color_group_id IS NOT NULL;

-- 4. user_token_revocations — adiciona token_jti + expires_at para revogação granular
ALTER TABLE public.user_token_revocations
  ADD COLUMN IF NOT EXISTS token_jti   text,
  ADD COLUMN IF NOT EXISTS expires_at  timestamptz,
  ADD COLUMN IF NOT EXISTS reason      text;
CREATE INDEX IF NOT EXISTS idx_token_revocations_jti ON public.user_token_revocations(token_jti) WHERE token_jti IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_token_revocations_expires ON public.user_token_revocations(expires_at) WHERE expires_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_token_revocations_user_id ON public.user_token_revocations(user_id, revoked_at DESC);
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'cleanup-expired-token-revocations') THEN
    PERFORM cron.unschedule('cleanup-expired-token-revocations');
  END IF;
END $$;
SELECT cron.schedule('cleanup-expired-token-revocations','0 * * * *',
  $$DELETE FROM user_token_revocations WHERE (expires_at IS NOT NULL AND expires_at < now() - interval '5 minutes') OR (expires_at IS NULL AND revoked_at < now() - interval '30 days');$$);
