-- Migration 044: Move relocatable extensions from public to extensions schema
--
-- Source: 200-commit audit — Supabase security advisor finding
-- Findings addressed: extension_in_public
--
-- ─── Background ──────────────────────────────────────────────────────────────
--
-- Supabase advisor (lint 0018_extension_in_public) flags extensions installed
-- in the public schema. Best practice is the extensions schema so extension
-- functions don't pollute the public namespace and search-path hijacking of
-- extension functions is prevented.
--
-- All functions after migration 042 have search_path = 'public','extensions',
-- which means they can resolve extension functions from either schema. Moving
-- extensions to the extensions schema is therefore safe for all internal code.
--
-- ─── Which extensions can be moved ───────────────────────────────────────────
--
-- Relocatable extensions (pg_extension.extrelocatable = true):
--   uuid-ossp, pgcrypto, pg_trgm, fuzzystrmatch, unaccent, tablefunc,
--   cube, earthdistance, citext, hstore, ltree, intarray, btree_gin,
--   btree_gist, isn, lo, bloom, tcn, seg, dict_int, dict_xsyn,
--   pg_stat_statements (system — skip), pg_buffercache (system — skip)
--
-- Non-relocatable (skip, leave in place):
--   plpgsql, plv8 — procedural languages (pg_catalog domain)
--   pg_net         — has its own schema (net), not in public typically
--   pgsodium       — has its own schema (pgsodium)
--   supabase_vault — has its own schema (vault)
--   pg_graphql     — has its own schema (graphql)
--   vector         — stores data types in pg_type, relocation unsafe with data
--   http           — may be non-relocatable depending on version
--
-- Strategy: Try to move each known-relocatable extension found in public schema.
-- Use per-extension exception handling so one failure does not abort the rest.
-- The extensions schema is created by Supabase by default.
--
-- ─── Search path safety ──────────────────────────────────────────────────────
--
-- After migration 042, all public functions have:
--   SET search_path = 'public', 'extensions'
-- PostgREST uses the Supabase default search_path which includes extensions.
-- Application code that calls uuid_generate_v4(), crypt(), gen_salt(), etc.
-- unqualified will still resolve correctly after the move.

-- ═══════════════════════════════════════════════════════════════════════════════
-- Ensure the extensions schema exists (Supabase creates it, but guard anyway)
-- ═══════════════════════════════════════════════════════════════════════════════

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_namespace WHERE nspname = 'extensions'
  ) THEN
    CREATE SCHEMA IF NOT EXISTS extensions;
    RAISE NOTICE '[044] Created extensions schema';
  ELSE
    RAISE NOTICE '[044] extensions schema already exists';
  END IF;
END;
$$;

-- ═══════════════════════════════════════════════════════════════════════════════
-- Move relocatable extensions from public to extensions schema
-- ═══════════════════════════════════════════════════════════════════════════════

DO $$
DECLARE
  r              RECORD;
  v_ok           int := 0;
  v_skip         int := 0;
  v_fail         int := 0;
  -- Well-known relocatable extensions to attempt moving
  v_candidates   text[] := ARRAY[
    'uuid-ossp',
    'pgcrypto',
    'pg_trgm',
    'fuzzystrmatch',
    'unaccent',
    'tablefunc',
    'cube',
    'earthdistance',
    'citext',
    'hstore',
    'ltree',
    'intarray',
    'btree_gin',
    'btree_gist',
    'isn',
    'lo',
    'bloom',
    'tcn',
    'seg',
    'dict_int',
    'dict_xsyn'
  ];
  v_ext_name     text;
  v_ext_schema   text;
  v_relocatable  boolean;
BEGIN
  FOREACH v_ext_name IN ARRAY v_candidates
  LOOP
    -- Check if extension is installed and currently in public schema
    SELECT n.nspname, e.extrelocatable
    INTO v_ext_schema, v_relocatable
    FROM pg_extension e
    JOIN pg_namespace n ON n.oid = e.extnamespace
    WHERE e.extname = v_ext_name;

    IF NOT FOUND THEN
      -- Extension not installed — skip silently
      RAISE NOTICE '[044] - % not installed — skipping', v_ext_name;
      v_skip := v_skip + 1;
      CONTINUE;
    END IF;

    IF v_ext_schema <> 'public' THEN
      -- Already in correct schema (extensions or other)
      RAISE NOTICE '[044] - % already in schema "%" — skipping', v_ext_name, v_ext_schema;
      v_skip := v_skip + 1;
      CONTINUE;
    END IF;

    IF NOT v_relocatable THEN
      -- Not marked as relocatable — cannot move
      RAISE WARNING '[044] - % is in public but NOT relocatable — leaving in place', v_ext_name;
      v_skip := v_skip + 1;
      CONTINUE;
    END IF;

    -- Attempt the move
    BEGIN
      EXECUTE format('ALTER EXTENSION %I SET SCHEMA extensions', v_ext_name);
      v_ok := v_ok + 1;
      RAISE NOTICE '✓ [044] Moved % from public to extensions schema', v_ext_name;
    EXCEPTION WHEN OTHERS THEN
      v_fail := v_fail + 1;
      RAISE WARNING '[044] ✗ Could not move % (in public, relocatable): %',
        v_ext_name, SQLERRM;
    END;
  END LOOP;

  RAISE NOTICE '[044] Extension moves: moved=%, skipped=%, failed=%', v_ok, v_skip, v_fail;

  IF v_fail > 0 THEN
    RAISE WARNING '[044] % extension(s) could not be moved — check warnings above', v_fail;
  END IF;
END;
$$;

-- ─── Validation ───────────────────────────────────────────────────────────────
DO $$
DECLARE
  v_in_public   int;
  v_ext_name    text;
BEGIN
  -- Count extensions still in public schema (should be only non-relocatable system ones)
  SELECT count(*) INTO v_in_public
  FROM pg_extension e
  JOIN pg_namespace n ON n.oid = e.extnamespace
  WHERE n.nspname = 'public';

  IF v_in_public = 0 THEN
    RAISE NOTICE '✓ [044] No extensions remain in public schema — extension_in_public cleared';
  ELSE
    -- List them (might be non-relocatable ones that legitimately stay)
    FOR v_ext_name IN
      SELECT e.extname
      FROM pg_extension e
      JOIN pg_namespace n ON n.oid = e.extnamespace
      WHERE n.nspname = 'public'
      ORDER BY e.extname
    LOOP
      RAISE NOTICE '[044] Still in public schema: % (may be non-relocatable)', v_ext_name;
    END LOOP;

    IF v_in_public <= 3 THEN
      RAISE NOTICE '[044] % extension(s) remain in public — likely non-relocatable, check advisor',
        v_in_public;
    ELSE
      RAISE WARNING '[044] % extensions still in public schema — investigate', v_in_public;
    END IF;
  END IF;

  -- Verify uuid-ossp is in extensions schema (or not installed)
  IF EXISTS (
    SELECT 1 FROM pg_extension e
    JOIN pg_namespace n ON n.oid = e.extnamespace
    WHERE e.extname = 'uuid-ossp' AND n.nspname = 'extensions'
  ) THEN
    RAISE NOTICE '✓ [044] uuid-ossp confirmed in extensions schema';
  END IF;

  IF EXISTS (
    SELECT 1 FROM pg_extension e
    JOIN pg_namespace n ON n.oid = e.extnamespace
    WHERE e.extname = 'pgcrypto' AND n.nspname = 'extensions'
  ) THEN
    RAISE NOTICE '✓ [044] pgcrypto confirmed in extensions schema';
  END IF;

  RAISE NOTICE 'Migration 044 complete — extension_in_public should clear on next advisor run.';
END;
$$;
