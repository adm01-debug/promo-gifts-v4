-- Migration: P2.9 — extend get_edge_function_secret allowlist
-- Applied: 2026-06-17
--
-- Adds the three new cron secret names to the get_edge_function_secret
-- whitelist so authorizeCron can read them from vault at runtime.
--
-- Without this, the RPC raises 'insufficient_privilege' for any name not
-- in the list, getVaultSecret() catches it and returns "", and authorizeCron
-- fail-closes with 503 instead of 401 — breaking the live test suite.
--
-- Secrets added:
--   HASH_PRODUCT_IMAGES_CRON_SECRET   (P2.7 — hash-product-images cron)
--   GENERATE_BLURHASHES_CRON_SECRET   (P2.8 — generate-blurhashes cron)
--   BACKFILL_DIM_CRON_SECRET          (P2.9 — backfill-image-dimensions cron)

CREATE OR REPLACE FUNCTION public.get_edge_function_secret(_name text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = vault, public, pg_temp
AS $function$
DECLARE
  _secret text;
BEGIN
  IF _name NOT IN (
    'WEBHOOK_DISPATCHER_SECRET',
    'CONNECTIONS_AUTO_TEST_SECRET',
    'CRON_SECRET',
    'HASH_PRODUCT_IMAGES_CRON_SECRET',
    'GENERATE_BLURHASHES_CRON_SECRET',
    'BACKFILL_DIM_CRON_SECRET'
  ) THEN
    RAISE EXCEPTION 'Nome de secret nao autorizado: %', _name USING ERRCODE = 'insufficient_privilege';
  END IF;

  SELECT decrypted_secret INTO _secret
  FROM vault.decrypted_secrets
  WHERE name = _name
  LIMIT 1;

  IF _secret IS NULL THEN
    RAISE EXCEPTION 'Secret % nao encontrado no vault', _name USING ERRCODE = 'no_data_found';
  END IF;

  RETURN _secret;
END;
$function$;

REVOKE ALL ON FUNCTION public.get_edge_function_secret(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_edge_function_secret(text) FROM anon;
REVOKE ALL ON FUNCTION public.get_edge_function_secret(text) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.get_edge_function_secret(text) TO service_role;
GRANT EXECUTE ON FUNCTION public.get_edge_function_secret(text) TO postgres;

COMMENT ON FUNCTION public.get_edge_function_secret(text) IS
  'Le secret de vault.decrypted_secrets. SECURITY DEFINER. Restrito a nomes whitelisted. Usado por triggers/cron/RPCs que chamam edge functions com auth via header. P2.9: adicionados HASH_PRODUCT_IMAGES_CRON_SECRET, GENERATE_BLURHASHES_CRON_SECRET, BACKFILL_DIM_CRON_SECRET.';
