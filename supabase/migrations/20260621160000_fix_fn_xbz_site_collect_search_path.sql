-- Correction: fn_xbz_site_collect search_path must be public,extensions,pg_temp
--
-- ROOT CAUSE OF CONFLICT
--   Migration 20260621100400 (fix_fn_xbz_site_collect_search_path, from PR #1251)
--   set search_path = public,extensions,pg_temp — correct for this function because
--   it uses unqualified table names (supplier_products_raw, net._http_response).
--
--   Migration 20260621150000 (security_perf_fixes) then ran ALTER FUNCTION with
--   search_path = '' (empty) which clobbers the earlier fix and breaks the function
--   ("relation does not exist" errors at runtime).
--
-- NOTE: fn_xbz_site_collect is NOT SECURITY DEFINER, so empty search_path is not
--   required for security. The appropriate fix is an explicit, minimal path.
--   fn_cron_guard (also patched in 150000) IS safe with search_path='' because
--   it only calls other functions by fully-qualified name.
--
-- IDEMPOTENT: ALTER FUNCTION is safe to re-apply.

ALTER FUNCTION public.fn_xbz_site_collect(integer)
  SET search_path = public, extensions, pg_temp;
