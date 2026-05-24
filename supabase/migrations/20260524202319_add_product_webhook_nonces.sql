CREATE TABLE IF NOT EXISTS public.webhook_request_nonces (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source TEXT NOT NULL,
  nonce TEXT NOT NULL,
  request_timestamp TIMESTAMPTZ NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(source, nonce)
);

CREATE INDEX IF NOT EXISTS idx_webhook_request_nonces_expires_at
  ON public.webhook_request_nonces(expires_at);

ALTER TABLE public.webhook_request_nonces ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.webhook_request_nonces FROM anon, authenticated;
GRANT SELECT, INSERT, DELETE ON TABLE public.webhook_request_nonces TO service_role;

DROP POLICY IF EXISTS "service_role_manage_webhook_request_nonces"
  ON public.webhook_request_nonces;
CREATE POLICY "service_role_manage_webhook_request_nonces"
  ON public.webhook_request_nonces
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE OR REPLACE FUNCTION public.cleanup_expired_webhook_request_nonces()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  deleted_count integer;
BEGIN
  DELETE FROM public.webhook_request_nonces
  WHERE expires_at < now();

  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$;

REVOKE ALL ON FUNCTION public.cleanup_expired_webhook_request_nonces() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.cleanup_expired_webhook_request_nonces() TO service_role;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'cleanup-product-webhook-nonces-hourly') THEN
    PERFORM cron.unschedule('cleanup-product-webhook-nonces-hourly');
  END IF;

  PERFORM cron.schedule(
    'cleanup-product-webhook-nonces-hourly',
    '17 * * * *',
    $cron$ SELECT public.cleanup_expired_webhook_request_nonces(); $cron$
  );
END;
$$;
