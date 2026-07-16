-- SEC: Revoke public access to archive.* and backup.* schemas
--
-- These schemas contain historical backups and deprecated tables.
-- They were accidentally granted to anon/authenticated via the default
-- public role USAGE, exposing internal business data (audit_log,
-- auth_login_attempts, staging data, deprecated pipelines, etc.).
--
-- After this migration, only postgres + service_role (and superusers)
-- can access these schemas. Edge functions using service_role are unaffected.
--
-- Idempotent: REVOKE is a no-op when the privilege doesn't exist.

-- ─── archive schema ───────────────────────────────────────────────────────────
REVOKE USAGE ON SCHEMA archive FROM anon, authenticated;
REVOKE ALL PRIVILEGES ON ALL TABLES IN SCHEMA archive FROM anon, authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA archive REVOKE ALL ON TABLES FROM anon, authenticated;

-- ─── backup schema ────────────────────────────────────────────────────────────
REVOKE USAGE ON SCHEMA backup FROM anon, authenticated;
REVOKE ALL PRIVILEGES ON ALL TABLES IN SCHEMA backup FROM anon, authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA backup REVOKE ALL ON TABLES FROM anon, authenticated;

-- Validation: confirm no more dangerous grants exist
DO $$
DECLARE
  v_count integer;
BEGIN
  SELECT count(*) INTO v_count
  FROM information_schema.role_table_grants
  WHERE table_schema IN ('archive', 'backup')
    AND grantee IN ('anon', 'authenticated');

  IF v_count > 0 THEN
    RAISE EXCEPTION
      'archive/backup schema hardening FAILED — % grants remain for anon/authenticated', v_count;
  END IF;
END;
$$;
