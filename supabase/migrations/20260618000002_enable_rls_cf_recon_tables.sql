-- Migration: enable_rls_cf_recon_tables_20260618
-- Purpose: Enable RLS on all cf_recon schema tables
-- Result: 6 tables secured (cf_image, cf_ghost_check_queue, action_log, crawl_run, metric_snapshot, remediation)

BEGIN;

-- cf_recon.cf_image
ALTER TABLE cf_recon.cf_image ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON cf_recon.cf_image FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON cf_recon.cf_image TO service_role;

-- cf_recon.cf_ghost_check_queue
ALTER TABLE cf_recon.cf_ghost_check_queue ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON cf_recon.cf_ghost_check_queue FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON cf_recon.cf_ghost_check_queue TO service_role;

-- cf_recon.action_log
ALTER TABLE cf_recon.action_log ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON cf_recon.action_log FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON cf_recon.action_log TO service_role;

-- cf_recon.crawl_run
ALTER TABLE cf_recon.crawl_run ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON cf_recon.crawl_run FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON cf_recon.crawl_run TO service_role;

-- cf_recon.metric_snapshot
ALTER TABLE cf_recon.metric_snapshot ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON cf_recon.metric_snapshot FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON cf_recon.metric_snapshot TO service_role;

-- cf_recon.remediation
ALTER TABLE cf_recon.remediation ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON cf_recon.remediation FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON cf_recon.remediation TO service_role;

COMMIT;
