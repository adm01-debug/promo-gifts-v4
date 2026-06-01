-- Restore EXECUTE grants for authenticated role on all public functions.
-- Migration 20260527212244 issued a broad REVOKE EXECUTE ON ALL FUNCTIONS IN SCHEMA public
-- FROM authenticated which broke every supabase.rpc() call made by the frontend
-- (e.g. get_bundle_suggestions, ensure_default_favorite_list, search_records_rerank, etc.).
-- The intent was only to lock down dangerous test/internal functions — we restore the
-- broad grant here and keep the targeted revokes from the original migration.

GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO authenticated;

-- Re-revoke the dangerous internal/test functions that must never be callable by end-users.
DO $$
BEGIN
  BEGIN
    REVOKE EXECUTE ON FUNCTION public.seed_discount_test_users() FROM authenticated, anon;
  EXCEPTION WHEN undefined_function THEN NULL;
  END;

  BEGIN
    REVOKE EXECUTE ON FUNCTION public.cleanup_discount_test_data() FROM authenticated, anon;
  EXCEPTION WHEN undefined_function THEN NULL;
  END;

  BEGIN
    REVOKE EXECUTE ON FUNCTION public.fn_run_and_persist_smoke_tests() FROM authenticated, anon;
  EXCEPTION WHEN undefined_function THEN NULL;
  END;
END $$;
