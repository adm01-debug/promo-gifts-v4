# Migration History Status

Reconcilied on 2026-05-23:
- Added 37 files for migrations applied via direct channel (schema_migrations orphans)
- Removed 1 duplicate version file (20260515120000)
- Marked 40 repo-only pending versions as applied (already applied via direct channel)
- 1 genuinely pending: 20260522001000 (add_contract_version to inbound_webhook_events)

Expected state: DB = 760 versions = repo files count after next workflow run applies 20260522001000.
