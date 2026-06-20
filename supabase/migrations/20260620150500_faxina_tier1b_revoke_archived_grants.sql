-- FAXINA DB — Tier 1b: harden the archive/backup schemas (remove from API attack surface)
--
-- Applied to production (doufsxqlfjyuvxuezpln) on 2026-06-20 via Supabase MCP.
-- Rationale: ALTER TABLE ... SET SCHEMA archive does NOT revoke the anon/authenticated
-- privileges, so the security advisor still reports ~150 GraphQL/REST exposure findings
-- on the archive (128) and backup (23) schemas. Archived/backup objects must not be
-- reachable by the public API roles. service_role / postgres keep full access, so crons
-- and edge functions (which use the service role) are unaffected. Live app uses only
-- the public schema, so this cannot break runtime behaviour.
--
-- Idempotent: REVOKE is naturally repeatable. We also flip DEFAULT PRIVILEGES so future
-- objects archived into these schemas are not auto-granted to the API roles.

revoke all privileges on all tables    in schema archive from anon, authenticated;
revoke all privileges on all sequences in schema archive from anon, authenticated;
revoke all privileges on all functions in schema archive from anon, authenticated;
revoke usage on schema archive from anon, authenticated;

revoke all privileges on all tables    in schema backup from anon, authenticated;
revoke all privileges on all sequences in schema backup from anon, authenticated;
revoke usage on schema backup from anon, authenticated;

-- Prevent future re-exposure when more objects are archived.
alter default privileges in schema archive revoke all on tables from anon, authenticated;
alter default privileges in schema archive revoke all on sequences from anon, authenticated;
alter default privileges in schema backup  revoke all on tables from anon, authenticated;
