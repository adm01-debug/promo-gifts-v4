-- Reconciliação CF<->DB — engine 100% Postgres (pg_net + pg_cron), sem Edge Function.
-- Fonte AUTORITATIVA: Cloudflare Images API (GET /accounts/{acct}/images/v1/{id}) -> 200=verified, 404=missing.
-- Credenciais lidas do Supabase Vault em runtime (CF_ACCOUNT_ID, CF_API_TOKEN) — nunca em código.
--
-- NOTA (lição de campo): a 1a versão sondava o CDN (imagedelivery.net) com Range:0-0,
-- mas o CDN retorna 206 mesmo para IDs inexistentes (placeholder) -> NÃO confiável.
-- Por isso usamos a API de controle, que é autoritativa.
-- Pré-requisito: pg_net + pg_cron habilitados e CF_ACCOUNT_ID/CF_API_TOKEN no vault.

CREATE TABLE IF NOT EXISTS public.cf_recon_inflight (
  request_id    bigint PRIMARY KEY,
  image_id      uuid NOT NULL,
  dispatched_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_cf_recon_inflight_dispatched ON public.cf_recon_inflight(dispatched_at);
ALTER TABLE public.cf_recon_inflight ENABLE ROW LEVEL SECURITY;

-- DISPATCH: enfileira checagens na CF Images API p/ N linhas pending/failed (prioriza primárias)
CREATE OR REPLACE FUNCTION public.fn_cf_recon_dispatch(p_batch int DEFAULT 200)
RETURNS int LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, net, vault AS $fn$
DECLARE r record; n int := 0; rid bigint; _acct text; _tok text; _base text;
BEGIN
  SELECT decrypted_secret INTO _acct FROM vault.decrypted_secrets WHERE name='CF_ACCOUNT_ID' LIMIT 1;
  SELECT decrypted_secret INTO _tok  FROM vault.decrypted_secrets WHERE name='CF_API_TOKEN'  LIMIT 1;
  IF _acct IS NULL OR _tok IS NULL THEN
    RAISE EXCEPTION 'CF_ACCOUNT_ID/CF_API_TOKEN ausentes no vault';
  END IF;
  _base := 'https://api.cloudflare.com/client/v4/accounts/'||_acct||'/images/v1/';

  FOR r IN
    SELECT id, cloudflare_image_id
    FROM public.product_images
    WHERE cf_sync_status IN ('pending','failed')
      AND cf_check_attempts < 5
      AND NOT EXISTS (SELECT 1 FROM public.cf_recon_inflight q WHERE q.image_id = product_images.id)
    ORDER BY is_primary DESC NULLS LAST, is_active DESC NULLS LAST, created_at
    LIMIT p_batch
  LOOP
    rid := net.http_get(url := _base || r.cloudflare_image_id,
                        headers := jsonb_build_object('Authorization','Bearer '||_tok),
                        timeout_milliseconds := 8000);
    INSERT INTO public.cf_recon_inflight(request_id, image_id)
      VALUES (rid, r.id) ON CONFLICT (request_id) DO NOTHING;
    n := n + 1;
  END LOOP;
  RETURN n;
END $fn$;

-- COLLECT: lê net._http_response -> grava cf_sync_status; idempotente; suprime amplificação de triggers
CREATE OR REPLACE FUNCTION public.fn_cf_recon_collect()
RETURNS int LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, net AS $fn$
DECLARE n int := 0;
BEGIN
  BEGIN EXECUTE 'SET LOCAL session_replication_role = replica'; EXCEPTION WHEN OTHERS THEN NULL; END;

  WITH resolved AS (
    SELECT q.image_id, r.status_code, r.error_msg
    FROM public.cf_recon_inflight q
    JOIN net._http_response r ON r.id = q.request_id
  )
  UPDATE public.product_images p SET
    cf_sync_status = CASE
      WHEN res.status_code IN (200,206) THEN 'verified'
      WHEN res.status_code IN (404,410) THEN 'missing'
      ELSE 'failed' END,
    cf_verified_at = now(),
    cf_check_attempts = p.cf_check_attempts + 1,
    cf_last_error = CASE
      WHEN res.status_code IN (200,206,404,410) THEN NULL
      ELSE COALESCE(res.error_msg, 'http_'||COALESCE(res.status_code::text,'timeout')) END
  FROM resolved res
  WHERE p.id = res.image_id;
  GET DIAGNOSTICS n = ROW_COUNT;

  WITH done AS (
    DELETE FROM public.cf_recon_inflight q
    USING net._http_response r
    WHERE r.id = q.request_id
    RETURNING q.request_id
  )
  DELETE FROM net._http_response WHERE id IN (SELECT request_id FROM done);

  DELETE FROM public.cf_recon_inflight WHERE dispatched_at < now() - interval '15 minutes';
  RETURN n;
END $fn$;

REVOKE ALL ON FUNCTION public.fn_cf_recon_dispatch(int) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.fn_cf_recon_collect()    FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE VIEW public.v_cf_recon_progress AS
SELECT cf_sync_status, count(*) AS n,
       round(100.0*count(*)/NULLIF(sum(count(*)) OVER (),0),2) AS pct
FROM public.product_images GROUP BY cf_sync_status;
REVOKE ALL ON public.v_cf_recon_progress FROM anon, authenticated;

COMMENT ON TABLE public.cf_recon_inflight IS 'Mapa request_id->image_id das checagens CF API em voo (pg_net).';
COMMENT ON FUNCTION public.fn_cf_recon_dispatch(int) IS 'Enfileira checagens na CF Images API (token do vault) p/ pending/failed; prioriza primárias.';
COMMENT ON FUNCTION public.fn_cf_recon_collect()    IS 'Processa net._http_response -> cf_sync_status (verified/missing/failed); idempotente.';