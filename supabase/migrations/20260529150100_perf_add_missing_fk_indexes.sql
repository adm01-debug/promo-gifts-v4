-- =====================================================================
-- Performance advisor: add covering indexes for unindexed foreign keys.
--
-- Both foreign keys were flagged by the Supabase performance advisor
-- (unindexed_foreign_keys). A covering index speeds up FK joins and the
-- referential-integrity checks run on parent UPDATE/DELETE. Both target
-- tables are currently empty, so the index build is instant. Applied to prod
-- via MCP on 2026-05-29; this file keeps the repo history in sync and is
-- idempotent (safe to re-run / db reset).
--
--   personalization_simulations.product_id -> idx_personalization_simulations_product_id
--   user_allowed_ips.created_by            -> idx_user_allowed_ips_created_by
-- =====================================================================
CREATE INDEX IF NOT EXISTS idx_personalization_simulations_product_id
  ON public.personalization_simulations (product_id);
CREATE INDEX IF NOT EXISTS idx_user_allowed_ips_created_by
  ON public.user_allowed_ips (created_by);
