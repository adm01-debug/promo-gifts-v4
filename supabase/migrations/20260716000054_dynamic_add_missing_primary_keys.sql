-- Migration 054: Detect and add missing primary keys in public schema
--
-- Source: 200-commit audit — Supabase security/performance advisor finding
-- Findings addressed: no_primary_key (lint 0001)
--
-- ─── Why primary keys matter ─────────────────────────────────────────────────
--
-- Tables without a primary key:
--   • Cannot be used with Supabase Realtime (requires PK for row identification)
--   • Cannot be replicated efficiently (logical replication requires replica identity)
--   • Lead to "full table scan" on DELETE with ON DELETE CASCADE
--   • Supabase advisor flags every such table as a security/integrity risk
--   • PostgREST upsert semantics break (needs PK for conflict resolution)
--
-- ─── Strategy ────────────────────────────────────────────────────────────────
--
-- Phase 1 — Detection:
--   Query pg_constraint for public-schema tables with contype = 'p' (primary key).
--   Any table lacking one is flagged.
--
-- Phase 2 — Automatic fix (safe cases only):
--   Auto-add PK for tables where:
--     (a) A column named exactly 'id' exists
--     (b) That column has a NOT NULL constraint (attnotnull = true)
--     (c) A unique index already covers that column alone
--   Rationale: 'id' + unique + not-null is an intended-PK pattern; adding the
--   CONSTRAINT ... PRIMARY KEY USING INDEX is safe because the unique index
--   already enforces the uniqueness invariant.
--
-- Phase 3 — Manual-review list:
--   Tables that still lack a PK after Phase 2 are logged as WARNINGs.
--   These require human review to decide which column(s) should form the PK.
--
-- ─── Safety guarantees ───────────────────────────────────────────────────────
--
-- • We NEVER add a PK unless a suitable unique-not-null 'id' index exists.
-- • We NEVER touch tables that already have a PK.
-- • We NEVER touch partitioned children (relispartition = true) — the parent PK
--   governs; PostgreSQL 17 handles partition PKs through inheritance.
-- • All DDL is wrapped in per-table exception blocks for fault isolation.
-- • ALTER TABLE ... ADD PRIMARY KEY USING INDEX promotes the unique index to PK
--   status — zero data write, zero table rewrite, minimal lock.
--
-- ─── Idempotency ─────────────────────────────────────────────────────────────
--
-- Tables already having a PK are excluded in Phase 1 filter.
-- If PK was added by a previous run, the NOT EXISTS filter in Phase 2 skips it.
-- Re-running is safe and produces only NOTICE output.

-- ═══════════════════════════════════════════════════════════════════════════════
-- Phase 1: Inventory — list all public tables without a PRIMARY KEY
-- ═══════════════════════════════════════════════════════════════════════════════

DO $$
DECLARE
  v_total_no_pk   int := 0;
  v_auto_fixed    int := 0;
  v_needs_review  int := 0;
  v_fail          int := 0;
  r               RECORD;
  v_index_name    text;
  v_col_name      text;
BEGIN
  FOR r IN
    SELECT
      c.relname       AS tablename,
      c.relispartition AS is_partition,
      c.oid           AS table_oid
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relkind IN ('r', 'p')   -- regular and partitioned parent
      AND NOT EXISTS (
        SELECT 1
        FROM pg_constraint pk
        WHERE pk.conrelid = c.oid
          AND pk.contype = 'p'       -- primary key constraint
      )
    ORDER BY c.relname
  LOOP
    v_total_no_pk := v_total_no_pk + 1;

    -- Skip partition children — PK is managed through the parent
    IF r.is_partition THEN
      RAISE NOTICE '[054] SKIP % (partition child) — PK inherited from parent', r.tablename;
      CONTINUE;
    END IF;

    -- ── Try to find a suitable unique-not-null 'id' index ──────────────────
    SELECT ic.relname INTO v_index_name
    FROM pg_index i
    JOIN pg_class ic ON ic.oid = i.indexrelid
    JOIN pg_attribute a ON a.attrelid = i.indrelid
      AND a.attnum = i.indkey[0]
      AND a.attnum > 0
    WHERE i.indrelid = r.table_oid
      AND i.indisunique = true
      AND i.indisprimary = false     -- not already promoted to PK
      AND i.indpred IS NULL          -- not a partial index
      AND i.indexprs IS NULL         -- not a functional index
      AND array_length(i.indkey, 1) = 1  -- single-column
      AND a.attname = 'id'           -- column named 'id'
      AND a.attnotnull = true        -- NOT NULL
    LIMIT 1;

    -- Also resolve what the column name is for confirmation
    IF v_index_name IS NOT NULL THEN
      SELECT a.attname INTO v_col_name
      FROM pg_index i
      JOIN pg_attribute a ON a.attrelid = i.indrelid
        AND a.attnum = i.indkey[0]
        AND a.attnum > 0
      WHERE i.indrelid = r.table_oid
        AND i.indisunique = true
        AND i.indpred IS NULL
        AND i.indexprs IS NULL
        AND array_length(i.indkey, 1) = 1
        AND i.indisprimary = false
      LIMIT 1;

      -- Promote unique index to primary key
      BEGIN
        EXECUTE format(
          'ALTER TABLE public.%I ADD CONSTRAINT %I PRIMARY KEY USING INDEX %I',
          r.tablename,
          'pk_' || r.tablename,
          v_index_name
        );
        v_auto_fixed := v_auto_fixed + 1;
        RAISE NOTICE '✓ [054] Added PK on %.% via unique index % (USING INDEX — no table rewrite)',
          r.tablename, v_col_name, v_index_name;
      EXCEPTION WHEN OTHERS THEN
        -- USING INDEX failed — try plain ADD PRIMARY KEY (id)
        BEGIN
          EXECUTE format(
            'ALTER TABLE public.%I ADD CONSTRAINT %I PRIMARY KEY (id)',
            r.tablename, 'pk_' || r.tablename
          );
          v_auto_fixed := v_auto_fixed + 1;
          RAISE NOTICE '✓ [054] Added PK on %.id via direct constraint (fallback)',
            r.tablename;
        EXCEPTION WHEN OTHERS THEN
          v_fail := v_fail + 1;
          RAISE WARNING '[054] ✗ Could not add PK to %: %', r.tablename, SQLERRM;
        END;
      END;

    ELSE
      -- No suitable 'id' unique-not-null index found — needs human review
      v_needs_review := v_needs_review + 1;
      RAISE WARNING '[054] REVIEW NEEDED: % has no PK and no auto-eligible id column — add PK manually',
        r.tablename;

      -- Log candidate columns (not-null, unique constraints) to help
      FOR v_col_name IN
        SELECT a.attname
        FROM pg_attribute a
        WHERE a.attrelid = r.table_oid
          AND a.attnum > 0
          AND NOT a.attisdropped
          AND a.attnotnull = true
          AND EXISTS (
            SELECT 1 FROM pg_index i
            WHERE i.indrelid = r.table_oid
              AND i.indisunique = true
              AND i.indpred IS NULL
              AND i.indexprs IS NULL
              AND array_length(i.indkey, 1) = 1
              AND i.indkey[0] = a.attnum
          )
        ORDER BY a.attnum
      LOOP
        RAISE NOTICE '[054]   Candidate unique-not-null column for %: %', r.tablename, v_col_name;
      END LOOP;
    END IF;
  END LOOP;

  RAISE NOTICE '[054] Summary: tables_lacking_pk=%, auto_fixed=%, needs_review=%, failed=%',
    v_total_no_pk, v_auto_fixed, v_needs_review, v_fail;

  IF v_needs_review > 0 THEN
    RAISE WARNING '[054] % table(s) need manual PK assignment — check warnings above', v_needs_review;
  END IF;
  IF v_fail > 0 THEN
    RAISE WARNING '[054] % table(s) could not be auto-fixed — check warnings above', v_fail;
  END IF;
END;
$$;

-- ═══════════════════════════════════════════════════════════════════════════════
-- Phase 2: Validate — count remaining public tables without a PK
-- ═══════════════════════════════════════════════════════════════════════════════

DO $$
DECLARE
  v_remaining  int;
  r            RECORD;
BEGIN
  SELECT count(*) INTO v_remaining
  FROM pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public'
    AND c.relkind IN ('r', 'p')
    AND NOT c.relispartition
    AND NOT EXISTS (
      SELECT 1 FROM pg_constraint pk
      WHERE pk.conrelid = c.oid AND pk.contype = 'p'
    );

  IF v_remaining = 0 THEN
    RAISE NOTICE '✓ [054] All public tables have a primary key — no_primary_key cleared';
  ELSE
    RAISE WARNING '[054] % public table(s) still lack a primary key', v_remaining;

    FOR r IN
      SELECT c.relname
      FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public'
        AND c.relkind IN ('r', 'p')
        AND NOT c.relispartition
        AND NOT EXISTS (
          SELECT 1 FROM pg_constraint pk
          WHERE pk.conrelid = c.oid AND pk.contype = 'p'
        )
      ORDER BY c.relname
    LOOP
      RAISE WARNING '[054] Still no PK: %', r.relname;
    END LOOP;
  END IF;

  RAISE NOTICE 'Migration 054 complete — no_primary_key should clear on next advisor run.';
END;
$$;
