-- Migration 053: Dynamic duplicate-index detection and safe cleanup
--
-- Source: 200-commit audit — Supabase performance advisor finding
-- Findings addressed: duplicate_index (performance lint)
--
-- ─── What "duplicate index" means ────────────────────────────────────────────
--
-- Two indexes are duplicates when:
--   • Same table (same indrelid)
--   • Same indexed columns in the same order (indkey arrays match)
--   • Neither is a partial index (indpred IS NULL for both)
--   • Same attribute types (no functional expressions; indexprs IS NULL)
--
-- Duplicate indexes consume storage, slow every INSERT/UPDATE/DELETE (all
-- indexes on a table are maintained), and confuse the query planner.
--
-- ─── Safety criteria — an index is SAFE to drop only when: ───────────────────
--
--   1. NOT the primary key (indisprimary = false)
--   2. NOT a unique constraint backing index where the other duplicate is
--      NOT unique (we never drop a unique in favor of a non-unique)
--   3. NOT referenced by a named constraint (pg_constraint.conindid)
--   4. Among two identical unique indexes, keep the one that backs a constraint
--   5. The keeper index exists and would survive the drop
--
-- ─── Priority: which duplicate to keep ───────────────────────────────────────
--
--   1. Index backing a named constraint (PK, UNIQUE, EXCLUDE) → always keep
--   2. Primary-key index → always keep
--   3. Unique index → prefer over non-unique
--   4. Older index (lower OID) → prefer (more stable, less likely temporary)
--
-- ─── Composite-key FK indexes ────────────────────────────────────────────────
--
-- Migration 052 created idx_<table>_<cols> indexes. If any of those duplicate
-- a pre-existing index with different name, this migration drops the older
-- pre-existing one (the auto-created one from migration 052 is the canonical
-- name). Exception: never drop a constraint-backing index.
--
-- ─── Idempotency ─────────────────────────────────────────────────────────────
--
-- DROP INDEX IF EXISTS is used. If an index was already dropped (or never
-- existed), the statement is a no-op. Re-running finds no duplicates.

-- ═══════════════════════════════════════════════════════════════════════════════
-- Phase 1: Detect and drop duplicate indexes in public schema
-- ═══════════════════════════════════════════════════════════════════════════════

DO $$
DECLARE
  r              RECORD;
  v_ok           int := 0;
  v_skip         int := 0;
  v_fail         int := 0;
BEGIN
  -- Find groups of indexes with identical (table, column-set, partial-predicate,
  -- functional-expression) signatures, then within each group mark one as the
  -- keeper and the rest as candidates for DROP.
  FOR r IN
    WITH index_signatures AS (
      SELECT
        i.indexrelid                                     AS index_oid,
        ic.relname                                       AS index_name,
        tc.relname                                       AS table_name,
        i.indrelid                                       AS table_oid,
        i.indkey::text                                   AS key_sig,     -- column ordinal array
        COALESCE(pg_get_expr(i.indpred,  i.indrelid), '') AS pred_sig,  -- partial predicate
        COALESCE(pg_get_expr(i.indexprs, i.indrelid), '') AS expr_sig,  -- functional expr
        i.indisunique                                    AS is_unique,
        i.indisprimary                                   AS is_primary,
        -- Is this index backing a named constraint (PK / UNIQUE / EXCL)?
        EXISTS (
          SELECT 1 FROM pg_constraint c
          WHERE c.conindid = i.indexrelid
        )                                                AS is_constraint_backed,
        i.indexrelid                                     AS oid_for_age  -- lower OID = older
      FROM pg_index i
      JOIN pg_class ic ON ic.oid = i.indexrelid
      JOIN pg_class tc ON tc.oid = i.indrelid
      JOIN pg_namespace n ON n.oid = tc.relnamespace
      WHERE n.nspname = 'public'
        AND tc.relkind IN ('r', 'p')   -- regular and partitioned tables
    ),
    grouped AS (
      -- Assign a group key per (table, key_sig, pred_sig, expr_sig)
      SELECT
        *,
        (table_oid::text || ':' || key_sig || ':' || pred_sig || ':' || expr_sig) AS group_key,
        -- Keeper priority score: higher = prefer to keep
        -- Constraint-backed (4) > Primary (3) > Unique (2) > Regular (1)
        -- Tie-break: lower OID wins (older index)
        (CASE WHEN is_constraint_backed THEN 4
              WHEN is_primary           THEN 3
              WHEN is_unique            THEN 2
              ELSE                           1
         END) AS keep_priority
      FROM index_signatures
    ),
    with_keeper AS (
      -- Within each group, identify the index to keep (highest priority, lowest OID)
      SELECT
        g.*,
        first_value(g.index_oid) OVER (
          PARTITION BY g.group_key
          ORDER BY g.keep_priority DESC, g.oid_for_age ASC
        ) AS keeper_oid,
        count(*) OVER (PARTITION BY g.group_key) AS group_size
      FROM grouped g
    )
    SELECT
      w.table_name,
      w.index_name,
      w.index_oid,
      w.keeper_oid,
      w.is_primary,
      w.is_constraint_backed,
      w.is_unique,
      w.group_key,
      w.group_size,
      -- Name of the keeper for logging
      (SELECT ic2.relname FROM pg_class ic2 WHERE ic2.oid = w.keeper_oid) AS keeper_name
    FROM with_keeper w
    WHERE w.group_size > 1           -- only duplicated groups
      AND w.index_oid <> w.keeper_oid  -- not the designated keeper
    ORDER BY w.table_name, w.index_name
  LOOP
    -- Safety gate: never drop PK or constraint-backed index
    IF r.is_primary OR r.is_constraint_backed THEN
      v_skip := v_skip + 1;
      RAISE NOTICE '[053] SKIP %: primary or constraint-backed — keeping (keeper: %)',
        r.index_name, r.keeper_name;
      CONTINUE;
    END IF;

    -- Safety gate: confirm keeper still exists before dropping candidate
    IF NOT EXISTS (SELECT 1 FROM pg_class WHERE oid = r.keeper_oid) THEN
      v_skip := v_skip + 1;
      RAISE WARNING '[053] SKIP %: keeper OID % no longer found — not dropping candidate',
        r.index_name, r.keeper_oid;
      CONTINUE;
    END IF;

    -- Drop the duplicate
    BEGIN
      EXECUTE format('DROP INDEX IF EXISTS public.%I', r.index_name);
      v_ok := v_ok + 1;
      RAISE NOTICE '✓ [053] Dropped duplicate index % on table % (kept: %)',
        r.index_name, r.table_name, r.keeper_name;
    EXCEPTION WHEN OTHERS THEN
      v_fail := v_fail + 1;
      RAISE WARNING '[053] ✗ Could not drop %: %', r.index_name, SQLERRM;
    END;
  END LOOP;

  RAISE NOTICE '[053] Duplicate index sweep: dropped=%, skipped=%, failed=%',
    v_ok, v_skip, v_fail;

  IF v_fail > 0 THEN
    RAISE WARNING '[053] % drop(s) failed — check warnings above', v_fail;
  END IF;
END;
$$;

-- ═══════════════════════════════════════════════════════════════════════════════
-- Phase 2: Validate — count remaining duplicate index groups
-- ═══════════════════════════════════════════════════════════════════════════════

DO $$
DECLARE
  v_remaining int;
  r           RECORD;
BEGIN
  SELECT count(*) INTO v_remaining
  FROM (
    WITH sigs AS (
      SELECT
        i.indexrelid,
        tc.relname                                       AS table_name,
        ic.relname                                       AS index_name,
        i.indrelid::text || ':' ||
        i.indkey::text || ':' ||
        COALESCE(pg_get_expr(i.indpred,  i.indrelid), '') || ':' ||
        COALESCE(pg_get_expr(i.indexprs, i.indrelid), '') AS sig
      FROM pg_index i
      JOIN pg_class ic ON ic.oid = i.indexrelid
      JOIN pg_class tc ON tc.oid = i.indrelid
      JOIN pg_namespace n ON n.oid = tc.relnamespace
      WHERE n.nspname = 'public'
        AND tc.relkind IN ('r', 'p')
    )
    SELECT sig, count(*) AS cnt
    FROM sigs
    GROUP BY sig
    HAVING count(*) > 1
  ) dup;

  IF v_remaining = 0 THEN
    RAISE NOTICE '✓ [053] No duplicate index groups remain — duplicate_index advisory cleared';
  ELSE
    RAISE WARNING '[053] % duplicate index group(s) still remain', v_remaining;

    FOR r IN
      WITH sigs AS (
        SELECT
          i.indexrelid,
          tc.relname  AS table_name,
          ic.relname  AS index_name,
          i.indrelid::text || ':' ||
          i.indkey::text || ':' ||
          COALESCE(pg_get_expr(i.indpred,  i.indrelid), '') || ':' ||
          COALESCE(pg_get_expr(i.indexprs, i.indrelid), '') AS sig,
          EXISTS (SELECT 1 FROM pg_constraint c WHERE c.conindid = i.indexrelid) AS backed
        FROM pg_index i
        JOIN pg_class ic ON ic.oid = i.indexrelid
        JOIN pg_class tc ON tc.oid = i.indrelid
        JOIN pg_namespace n ON n.oid = tc.relnamespace
        WHERE n.nspname = 'public'
          AND tc.relkind IN ('r', 'p')
      ),
      dup_sigs AS (
        SELECT sig FROM sigs GROUP BY sig HAVING count(*) > 1
      )
      SELECT s.table_name, s.index_name, s.backed
      FROM sigs s
      JOIN dup_sigs d ON d.sig = s.sig
      ORDER BY s.table_name, s.index_name
    LOOP
      RAISE WARNING '[053] Still duplicated: %.% (constraint-backed: %)',
        r.table_name, r.index_name, r.backed;
    END LOOP;
  END IF;

  -- Report total index count in public schema for reference
  DECLARE
    v_total int;
  BEGIN
    SELECT count(*) INTO v_total
    FROM pg_index i
    JOIN pg_class tc ON tc.oid = i.indrelid
    JOIN pg_namespace n ON n.oid = tc.relnamespace
    WHERE n.nspname = 'public' AND tc.relkind IN ('r', 'p');

    RAISE NOTICE '[053] Total indexes in public schema after sweep: %', v_total;
  END;

  RAISE NOTICE 'Migration 053 complete — duplicate_index should clear on next advisor run.';
END;
$$;
