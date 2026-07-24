-- collect aprimorado: além de cf_sync_status, captura cf_uploaded_at e requires_signed_url
-- a partir do JSON da CF Images API (já presente em net._http_response.content).
-- Parsing defensivo: só faz cast quando 200/206 e content começa com '{'. COALESCE preserva valores.
-- Idempotente; mantém session_replication_role=replica p/ evitar amplificação de triggers.
CREATE OR REPLACE FUNCTION public.fn_cf_recon_collect()
RETURNS int LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, net AS $fn$
DECLARE n int := 0;
BEGIN
  BEGIN EXECUTE 'SET LOCAL session_replication_role = replica'; EXCEPTION WHEN OTHERS THEN NULL; END;

  WITH resolved AS (
    SELECT q.image_id, r.status_code, r.error_msg,
           CASE WHEN r.status_code IN (200,206) AND r.content IS NOT NULL
                     AND left(btrim(r.content),1)='{'
                THEN r.content::jsonb ELSE NULL END AS body
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
      ELSE COALESCE(res.error_msg, 'http_'||COALESCE(res.status_code::text,'timeout')) END,
    cf_uploaded_at = COALESCE((res.body->'result'->>'uploaded')::timestamptz, p.cf_uploaded_at),
    requires_signed_url = COALESCE((res.body->'result'->>'requireSignedURLs')::boolean, p.requires_signed_url)
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
REVOKE ALL ON FUNCTION public.fn_cf_recon_collect() FROM PUBLIC, anon, authenticated;