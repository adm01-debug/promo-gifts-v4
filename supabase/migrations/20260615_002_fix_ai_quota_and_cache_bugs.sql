-- ============================================================
-- Migration: fix_ai_quota_and_cache_bugs
-- Date: 2026-06-15
-- Bugs fixed:
--   BUG-QUOTA-001 [CRITICAL] — check_ai_quota() type mismatch app_role vs text
--   BUG-CACHE-001 [HIGH]     — ai_insights_cache view alias for dashboard_insights_cache
--   BUG-CACHE-002 [MEDIUM]   — dashboard_insights_cache missing tokens_input/tokens_output
-- ============================================================
-- Discovered during exhaustive post-DROP test battery (47 assertions).
-- None caused by DROP ai_provider_quotas — all pre-existing bugs.
-- ============================================================

-- ============================================================
-- FIX BUG-QUOTA-001: check_ai_quota() — app_role vs text type mismatch
-- Root cause: ai_usage_quotas.role is app_role enum, v_role is text.
--             WHERE role = v_role fails with: operator does not exist app_role=text
-- Fix: cast role::text for comparison (safe: role enum values are valid text)
-- Impact: Quota system was completely non-functional. All AI calls
--         that went through the quota check path were failing.
-- ============================================================

CREATE OR REPLACE FUNCTION public.check_ai_quota(_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
DECLARE
  v_role text;
  v_limit int;
  v_unlimited boolean;
  v_used int;
BEGIN
  v_role := public._get_user_primary_role(_user_id);

  -- FIX: role::text = v_role (was: role = v_role → operator does not exist: app_role=text)
  SELECT monthly_limit, is_unlimited INTO v_limit, v_unlimited
  FROM public.ai_usage_quotas WHERE role::text = v_role;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'allowed', true, 'used', 0, 'limit', -1, 'remaining', -1,
      'unlimited', true, 'reason', 'no_quota_for_role'
    );
  END IF;

  SELECT count(*)::int INTO v_used
  FROM public.ai_usage_logs
  WHERE user_id = _user_id
    AND created_at >= date_trunc('month', now())
    AND status != 'error';

  IF v_unlimited THEN
    RETURN jsonb_build_object(
      'allowed', true, 'used', v_used, 'limit', -1, 'remaining', -1, 'unlimited', true
    );
  END IF;

  RETURN jsonb_build_object(
    'allowed', v_used < v_limit,
    'used', v_used,
    'limit', v_limit,
    'remaining', greatest(0, v_limit - v_used),
    'unlimited', false
  );
END;
$function$;

-- ============================================================
-- FIX BUG-CACHE-002: Add missing columns tokens_input/tokens_output
-- Root cause: dashboard_insights_cache was missing these columns
--             that market-intelligence-insights/index.ts writes via upsert.
-- Impact: Cache writes would fail silently, causing every AI call
--         to skip the cache and always hit the AI API (2-3x cost overhead).
-- ============================================================

ALTER TABLE public.dashboard_insights_cache
  ADD COLUMN IF NOT EXISTS tokens_input integer,
  ADD COLUMN IF NOT EXISTS tokens_output integer;

-- ============================================================
-- FIX BUG-CACHE-001: Create ai_insights_cache view → dashboard_insights_cache
-- Root cause: Table was renamed from ai_insights_cache to dashboard_insights_cache
--             (or the edge fn was written against the wrong name), but
--             market-intelligence-insights/index.ts still uses .from("ai_insights_cache").
-- Fix: Create a security_invoker view so existing edge fn code works without
--      redeploy, while RLS from dashboard_insights_cache is inherited.
-- Impact: Cache was completely broken — reads and writes all failed silently.
-- ============================================================

CREATE OR REPLACE VIEW public.ai_insights_cache
  WITH (security_invoker = true)
AS
SELECT
  id,
  user_id,
  function_name,
  cache_key,
  payload,
  model,
  tokens_input,
  tokens_output,
  duration_ms,
  created_at,
  expires_at
FROM public.dashboard_insights_cache;

-- Grants for PostgREST access
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ai_insights_cache TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ai_insights_cache TO service_role;
GRANT SELECT ON public.ai_insights_cache TO anon;

-- Reload schema cache
NOTIFY pgrst, 'reload schema';
