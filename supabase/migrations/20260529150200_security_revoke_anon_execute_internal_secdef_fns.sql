-- =====================================================================
-- Security advisor hardening: revoke EXECUTE from anon/PUBLIC on internal
-- SECURITY DEFINER functions that have NO unauthenticated caller.
--
-- SECURITY DEFINER functions execute with the *definer's* privileges; leaving
-- them callable by `anon` needlessly widens the pre-auth attack surface. Each
-- function below was verified (app code + edge functions) to have no anonymous
-- caller. Explicit `authenticated` / `service_role` grants are preserved, so
-- the admin UI (smoke tests) and service-role edge functions (send-digest,
-- send-notification) keep working.
--
-- Intentionally NOT touched — public / pre-auth RPCs that legitimately need
-- anon EXECUTE: check_login_rate_limit, enforce_password_reset_rate_limit,
-- get_quote_token_by_value, submit_quote_response.
--
-- Applied to prod via MCP on 2026-05-29; this file keeps the repo history in
-- sync. Each REVOKE is guarded by to_regprocedure() so a fresh `db reset` /
-- preview branch does not fail when a function is absent (e.g.
-- send_digest_notification is created out-of-band and has no repo migration
-- yet). REVOKE is itself a no-op when the grant is already absent, so the
-- whole migration is idempotent.
-- =====================================================================
DO $$
BEGIN
  -- smoke-test runner: prod revoked from anon only (PUBLIC grant was already absent).
  IF to_regprocedure('public.fn_run_and_persist_smoke_tests()') IS NOT NULL THEN
    REVOKE EXECUTE ON FUNCTION public.fn_run_and_persist_smoke_tests() FROM anon;
  END IF;

  IF to_regprocedure('public.is_dnd_active(uuid)') IS NOT NULL THEN
    REVOKE EXECUTE ON FUNCTION public.is_dnd_active(uuid) FROM PUBLIC, anon;
  END IF;

  IF to_regprocedure('public.send_digest_notification(uuid, uuid[], integer)') IS NOT NULL THEN
    REVOKE EXECUTE ON FUNCTION public.send_digest_notification(uuid, uuid[], integer) FROM PUBLIC, anon;
  END IF;

  IF to_regprocedure('public.sync_user_org_to_org_members()') IS NOT NULL THEN
    REVOKE EXECUTE ON FUNCTION public.sync_user_org_to_org_members() FROM PUBLIC, anon;
  END IF;

  IF to_regprocedure('public.validate_edge_functions_base_url(text)') IS NOT NULL THEN
    REVOKE EXECUTE ON FUNCTION public.validate_edge_functions_base_url(text) FROM PUBLIC, anon;
  END IF;
END $$;
