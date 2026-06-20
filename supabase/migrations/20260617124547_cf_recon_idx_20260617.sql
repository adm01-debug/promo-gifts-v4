-- cf_recon_idx_20260617
-- Applied to DB at 2026-06-17 12:45:47 UTC.
-- Repo file reconstructed 2026-06-19 from pg_indexes catalog.
--
-- Performance indexes for cf_recon schema tables, created after
-- populate_cf_recon_from_audit_20260617 inserted 72k rows into cf_image.

-- cf_image: fast range scans for staleness detection
CREATE INDEX IF NOT EXISTS idx_cf_recon_cfimg_last_seen
  ON cf_recon.cf_image (last_seen_at);

CREATE INDEX IF NOT EXISTS idx_cf_recon_cfimg_uploaded
  ON cf_recon.cf_image (uploaded_at);

-- remediation: fast queue filtering by kind+status
CREATE INDEX IF NOT EXISTS idx_remediation_kind_status
  ON cf_recon.remediation (kind, status);
