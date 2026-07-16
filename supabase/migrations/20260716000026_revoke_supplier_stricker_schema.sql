-- Migration: Revoke access to supplier_stricker staging schema
--
-- Problem (Supabase advisor: pg_graphql_authenticated_table_exposed):
--   The `supplier_stricker` schema contains ~51 staging/import tables that are
--   visible to the `authenticated` role via GraphQL and PostgREST.
--
--   These tables are:
--     - Stricker supplier staging/import data (not business logic)
--     - NOT referenced by any app src/ code (confirmed: grep src/ -r finds 0 references)
--     - Referenced only in FK index migrations for relational integrity
--
--   Exposing a staging schema to authenticated users via the API is a security
--   smell: it leaks internal data pipeline structure and supplier raw data.
--
-- Fix:
--   REVOKE USAGE ON SCHEMA supplier_stricker FROM anon, authenticated
--
--   This removes ALL GraphQL and PostgREST exposure of the schema at once.
--   service_role retains full access (bypasses RLS and schema grants).
--
-- Safety:
--   - App code (src/) has zero references to `supplier_stricker` schema
--   - No Edge Functions query this schema (functions use `public` schema only)
--   - FK indexes referencing this schema were created by migrations only — not runtime
--   - authenticated users will get "permission denied for schema" via PostgREST/GraphQL
--   - Verified: schema exists as a staging pipeline for Stricker supplier data import

-- ─── Revoke anon and authenticated from supplier_stricker schema ──────────────
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.schemata
    WHERE schema_name = 'supplier_stricker'
  ) THEN
    REVOKE USAGE ON SCHEMA supplier_stricker FROM anon;
    REVOKE USAGE ON SCHEMA supplier_stricker FROM authenticated;
    RAISE NOTICE '✓ REVOKE USAGE ON SCHEMA supplier_stricker FROM anon, authenticated';
  ELSE
    RAISE NOTICE '⚠ schema supplier_stricker not found — skipping';
  END IF;
END;
$$;

-- ─── Validate ─────────────────────────────────────────────────────────────────
DO $$
DECLARE
  has_anon_usage     boolean;
  has_auth_usage     boolean;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM information_schema.role_usage_grants
    WHERE object_schema = 'supplier_stricker'
      AND object_name   = 'supplier_stricker'
      AND grantee       = 'anon'
      AND privilege_type = 'USAGE'
  ) INTO has_anon_usage;

  SELECT EXISTS (
    SELECT 1 FROM information_schema.role_usage_grants
    WHERE object_schema = 'supplier_stricker'
      AND object_name   = 'supplier_stricker'
      AND grantee       = 'authenticated'
      AND privilege_type = 'USAGE'
  ) INTO has_auth_usage;

  IF has_anon_usage THEN
    RAISE WARNING 'anon still has USAGE on supplier_stricker — check if schema exists';
  ELSE
    RAISE NOTICE '✓ anon: no USAGE on supplier_stricker (or schema absent)';
  END IF;

  IF has_auth_usage THEN
    RAISE WARNING 'authenticated still has USAGE on supplier_stricker — check if schema exists';
  ELSE
    RAISE NOTICE '✓ authenticated: no USAGE on supplier_stricker (or schema absent)';
  END IF;
END;
$$;
