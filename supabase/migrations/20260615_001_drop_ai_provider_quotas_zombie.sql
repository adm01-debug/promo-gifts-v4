-- ============================================================
-- Migration: drop_ai_provider_quotas_zombie
-- Date: 2026-06-15
-- Author: cleanup audit
-- ============================================================
-- Context:
--   ai_provider_quotas was designed for per-provider spending
--   caps (monthly_limit_usd / monthly_limit_tokens), but was
--   never wired into any Edge Function or Postgres function.
--   All 5 rows have NULL limits. The actual quota system uses
--   ai_usage_quotas (keyed by app_role), not this table.
--
-- Evidence:
--   - monthly_limit_usd = NULL for all 5 rows
--   - monthly_limit_tokens = NULL for all 5 rows
--   - current_period_usage_usd = 0 (never incremented)
--   - pg_stat seq_scan = 4 (only index warm-up reads)
--   - n_tup_ins = 0 after initial seed (never written to)
--   - Zero references in supabase/functions/**
--   - Zero references in public Postgres functions
--   - Zero views or materialized views reference it
--   - No child FK tables reference it
--
-- Safety checks (all PASS before applying):
--   1. No views reference ai_provider_quotas
--   2. No edge functions reference ai_provider_quotas
--   3. No postgres functions reference ai_provider_quotas
--   4. No child FK tables point to ai_provider_quotas
--   5. tg_ai_providers_set_updated_at() survives (shared trigger fn)
--   6. ai_function_routing, ai_models, ai_providers keep their triggers
--   7. ai_usage_quotas, ai_usage_logs, ai_routing_decisions, ai_usage_events
--      are NOT dropped (all have active code references)
-- ============================================================

-- DROP TABLE (CASCADE handles the trigger + index + FK + RLS policies automatically)
DROP TABLE IF EXISTS public.ai_provider_quotas CASCADE;

-- Reload PostgREST schema cache so the table disappears from the API immediately
NOTIFY pgrst, 'reload schema';
