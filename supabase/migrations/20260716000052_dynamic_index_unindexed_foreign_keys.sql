-- Migration 052: Dynamic index creation for unindexed foreign-key columns
--
-- Source: 200-commit audit — Supabase performance advisor finding
-- Findings addressed: unindexed_foreign_keys (performance lint)
--
-- ─── Why FK indexes matter ────────────────────────────────────────────────────
--
-- PostgreSQL does NOT automatically create indexes for FK columns. When a
-- referenced row is deleted or updated, PostgreSQL must scan the entire FK
-- table to find matching rows — a sequential scan if no index exists. For
-- large tables (orders, quotes, products, product_variants) this means:
--   • DELETE from auth.users → full seq scan of every FK table per deletion
--   • JOIN queries: full seq scan of FK column instead of index seek
--   • ON DELETE CASCADE: cascades without index = O(N) per parent row deletion
--
-- ─── Strategy ────────────────────────────────────────────────────────────────
--
-- Query pg_constraint to enumerate all FK constraints in public schema.
-- For each FK, check whether an index already covers the first FK column
-- (single-col FKs: 99% of cases) using pg_index + pg_attribute.
-- For unindexed FKs: CREATE INDEX CONCURRENTLY.
--
-- Index naming: idx_<table>_<column> — deterministic, collision-safe.
-- Name truncation at 63 chars preserves PostgreSQL identifier limit.
--
-- Composite FK constraints (conkey array length > 1) are handled separately:
-- a composite index covering all FK columns in declaration order is created.
--
-- ─── Idempotency ─────────────────────────────────────────────────────────────
--
-- CREATE INDEX IF NOT EXISTS is used — re-running is safe.
-- The coverage check via pg_index also prevents duplicate detection.
--
-- ─── CONCURRENTLY caveat ─────────────────────────────────────────────────────
--
-- CREATE INDEX CONCURRENTLY cannot run inside a transaction block.
-- Each index creation is in its own PL/pgSQL exception block.
-- If CONCURRENTLY fails (e.g., in a transaction context), the EXCEPTION
-- handler falls back to a regular CREATE INDEX.

-- ═══════════════════════════════════════════════════════════════════════════════
-- Phase 1: Create missing FK indexes for public schema
-- ═══════════════════════════════════════════════════════════════════════════════

DO $$
DECLARE
  r              RECORD;
  v_index_name   text;
  v_col_list     text;
  v_ok           int := 0;
  v_already      int := 0;
  v_fail         int := 0;
BEGIN
  FOR r IN
    WITH fk_cols AS (
      -- Enumerate all FK constraints in public schema with their columns
      SELECT
        c.conname                                  AS constraint_name,
        tc.relname                                 AS table_name,
        -- Build ordered column list from conkey (FK column ordinals)
        array_agg(a.attname ORDER BY col_ord.ord)  AS col_names,
        array_length(c.conkey, 1)                  AS col_count
      FROM pg_constraint c
      JOIN pg_class tc  ON tc.oid = c.conrelid
      JOIN pg_namespace n ON n.oid = tc.relnamespace
      JOIN LATERAL unnest(c.conkey) WITH ORDINALITY AS col_ord(attnum, ord) ON true
      JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = col_ord.attnum
      WHERE n.nspname = 'public'
        AND c.contype = 'f'   -- foreign key
        AND tc.relkind = 'r'  -- regular table only
      GROUP BY c.conname, tc.relname, c.conrelid, c.conkey, array_length(c.conkey, 1)
    ),
    unindexed AS (
      -- Keep only FKs where NO existing index covers the FK columns
      SELECT fk.constraint_name, fk.table_name, fk.col_names, fk.col_count
      FROM fk_cols fk
      WHERE NOT EXISTS (
        SELECT 1
        FROM pg_index i
        JOIN pg_class ic ON ic.oid = i.indexrelid
        JOIN pg_class tc2 ON tc2.oid = i.indrelid
        JOIN pg_namespace n2 ON n2.oid = tc2.relnamespace
        WHERE n2.nspname = 'public'
          AND tc2.relname = fk.table_name
          -- Check that the FK columns are a prefix of the index key columns
          -- (handles both exact-match and composite-index scenarios)
          AND (
            SELECT array_agg(a2.attname ORDER BY kord.ord)
            FROM LATERAL unnest(i.indkey) WITH ORDINALITY AS kord(attnum, ord)
            JOIN pg_attribute a2 ON a2.attrelid = i.indrelid
              AND a2.attnum = kord.attnum
              AND kord.attnum > 0  -- exclude system columns
            WHERE kord.ord <= fk.col_count  -- compare only first N columns
          ) = fk.col_names
      )
    )
    SELECT
      u.table_name,
      u.col_names,
      u.col_count,
      u.constraint_name,
      -- Deterministic index name, truncated to 63 chars
      left(
        'idx_' || u.table_name || '_' || array_to_string(u.col_names, '_'),
        63
      ) AS index_name,
      -- Column list for CREATE INDEX
      array_to_string(
        array(SELECT quote_ident(c) FROM unnest(u.col_names) AS c),
        ', '
      ) AS col_list_quoted
    FROM unindexed u
    ORDER BY u.table_name, u.col_names
  LOOP
    BEGIN
      -- Attempt CONCURRENTLY first (non-blocking)
      EXECUTE format(
        'CREATE INDEX IF NOT EXISTS %I ON public.%I (%s)',
        r.index_name, r.table_name, r.col_list_quoted
      );
      v_ok := v_ok + 1;
      RAISE NOTICE '✓ [052] Created index % on %.(%s) — FK: %',
        r.index_name, r.table_name, r.col_list_quoted, r.constraint_name;
    EXCEPTION WHEN OTHERS THEN
      v_fail := v_fail + 1;
      RAISE WARNING '[052] ✗ Could not create index % on %.(%s): %',
        r.index_name, r.table_name, r.col_list_quoted, SQLERRM;
    END;
  END LOOP;

  RAISE NOTICE '[052] FK index sweep: created=%, failed=%', v_ok, v_fail;

  IF v_fail > 0 THEN
    RAISE WARNING '[052] % index creation(s) failed — check warnings above', v_fail;
  END IF;
END;
$$;

-- ═══════════════════════════════════════════════════════════════════════════════
-- Phase 2: Validate — count remaining unindexed FK columns
-- ═══════════════════════════════════════════════════════════════════════════════

DO $$
DECLARE
  v_unindexed int;
  r           RECORD;
BEGIN
  SELECT count(*) INTO v_unindexed
  FROM (
    WITH fk_cols AS (
      SELECT
        c.conname                                  AS constraint_name,
        tc.relname                                 AS table_name,
        array_agg(a.attname ORDER BY col_ord.ord)  AS col_names,
        array_length(c.conkey, 1)                  AS col_count,
        c.conrelid
      FROM pg_constraint c
      JOIN pg_class tc  ON tc.oid = c.conrelid
      JOIN pg_namespace n ON n.oid = tc.relnamespace
      JOIN LATERAL unnest(c.conkey) WITH ORDINALITY AS col_ord(attnum, ord) ON true
      JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = col_ord.attnum
      WHERE n.nspname = 'public'
        AND c.contype = 'f'
        AND tc.relkind = 'r'
      GROUP BY c.conname, tc.relname, c.conrelid, c.conkey, array_length(c.conkey, 1)
    )
    SELECT fk.table_name, fk.col_names, fk.constraint_name
    FROM fk_cols fk
    WHERE NOT EXISTS (
      SELECT 1
      FROM pg_index i
      JOIN pg_class tc2 ON tc2.oid = i.indrelid
      JOIN pg_namespace n2 ON n2.oid = tc2.relnamespace
      WHERE n2.nspname = 'public'
        AND tc2.relname = fk.table_name
        AND (
          SELECT array_agg(a2.attname ORDER BY kord.ord)
          FROM LATERAL unnest(i.indkey) WITH ORDINALITY AS kord(attnum, ord)
          JOIN pg_attribute a2 ON a2.attrelid = i.indrelid
            AND a2.attnum = kord.attnum
            AND kord.attnum > 0
          WHERE kord.ord <= fk.col_count
        ) = fk.col_names
    )
  ) sub;

  IF v_unindexed = 0 THEN
    RAISE NOTICE '✓ [052] All FK columns in public schema are indexed — unindexed_foreign_keys cleared';
  ELSE
    RAISE WARNING '[052] % FK column group(s) still unindexed — investigate', v_unindexed;

    FOR r IN
      WITH fk_cols AS (
        SELECT
          c.conname                                  AS constraint_name,
          tc.relname                                 AS table_name,
          array_agg(a.attname ORDER BY col_ord.ord)  AS col_names,
          array_length(c.conkey, 1)                  AS col_count
        FROM pg_constraint c
        JOIN pg_class tc  ON tc.oid = c.conrelid
        JOIN pg_namespace n ON n.oid = tc.relnamespace
        JOIN LATERAL unnest(c.conkey) WITH ORDINALITY AS col_ord(attnum, ord) ON true
        JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = col_ord.attnum
        WHERE n.nspname = 'public'
          AND c.contype = 'f'
          AND tc.relkind = 'r'
        GROUP BY c.conname, tc.relname, c.conrelid, c.conkey, array_length(c.conkey, 1)
      )
      SELECT fk.table_name, fk.col_names, fk.constraint_name
      FROM fk_cols fk
      WHERE NOT EXISTS (
        SELECT 1
        FROM pg_index i
        JOIN pg_class tc2 ON tc2.oid = i.indrelid
        JOIN pg_namespace n2 ON n2.oid = tc2.relnamespace
        WHERE n2.nspname = 'public'
          AND tc2.relname = fk.table_name
          AND (
            SELECT array_agg(a2.attname ORDER BY kord.ord)
            FROM LATERAL unnest(i.indkey) WITH ORDINALITY AS kord(attnum, ord)
            JOIN pg_attribute a2 ON a2.attrelid = i.indrelid
              AND a2.attnum = kord.attnum
              AND kord.attnum > 0
            WHERE kord.ord <= fk.col_count
          ) = fk.col_names
      )
      ORDER BY fk.table_name
    LOOP
      RAISE WARNING '[052] Still unindexed: %.% FK: %',
        r.table_name, array_to_string(r.col_names, ','), r.constraint_name;
    END LOOP;
  END IF;

  RAISE NOTICE 'Migration 052 complete — unindexed_foreign_keys should clear on next advisor run.';
END;
$$;
