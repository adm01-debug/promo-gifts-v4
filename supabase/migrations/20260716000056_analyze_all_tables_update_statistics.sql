-- Migration 056: ANALYZE all public tables + unused-index detection report
--
-- Source: 200-commit audit — Supabase performance advisor
-- Findings addressed: outdated_stats / unused_index (advisory)
--
-- ─── Why ANALYZE matters ──────────────────────────────────────────────────────
--
-- PostgreSQL query planner makes decisions based on table statistics
-- (pg_statistic). Stale statistics lead to:
--   • Suboptimal join order (e.g., choosing nested-loop over hash join)
--   • Wrong index choice (e.g., seqscan when index would be faster)
--   • Bad row estimate → wrong memory grants → sort/hash spills
--
-- ANALYZE reads a sample of each table and updates pg_statistic. It is fast
-- (read-only, uses lock mode ShareUpdateExclusiveLock which does NOT block
-- reads or writes) and has no downtime risk.
--
-- After migrations 052 (new FK indexes), 053 (dropped duplicates), 054 (new PKs),
-- and 055 (new deny policies), running ANALYZE ensures the planner immediately
-- picks up new index statistics.
--
-- ─── Unused index detection ──────────────────────────────────────────────────
--
-- pg_stat_user_indexes.idx_scan tracks how many times each index was used
-- to satisfy a query since last pg_stat_reset(). Indexes with idx_scan = 0
-- are candidates for removal — they slow every INSERT/UPDATE/DELETE without
-- benefiting any SELECT.
--
-- EXCEPTION: we never DROP unused indexes in this migration because:
--   1. Statistics reset (pg_stat_reset()) clears all counters — a "0 scan"
--      index might have been heavily used before the last reset
--   2. Constraint-backing indexes (PK, UNIQUE) must never be dropped
--   3. New FK indexes (from migration 052) naturally have 0 scans at first
--
-- This migration logs them for human review. DBA can drop them after
-- confirming long-term zero usage with monitoring.
--
-- ─── Idempotency ─────────────────────────────────────────────────────────────
--
-- ANALYZE on an already-analyzed table is always safe (just updates stats).
-- The unused-index report is advisory — no schema changes.

-- ═══════════════════════════════════════════════════════════════════════════════
-- Phase 1: ANALYZE all public tables to refresh planner statistics
-- ═══════════════════════════════════════════════════════════════════════════════

DO $$
DECLARE
  r         RECORD;
  v_ok      int := 0;
  v_fail    int := 0;
BEGIN
  FOR r IN
    SELECT c.relname AS tablename
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relkind IN ('r', 'p', 'm')  -- regular, partitioned, materialized views
    ORDER BY c.relname
  LOOP
    BEGIN
      EXECUTE format('ANALYZE public.%I', r.tablename);
      v_ok := v_ok + 1;
    EXCEPTION WHEN OTHERS THEN
      v_fail := v_fail + 1;
      RAISE WARNING '[056] ✗ ANALYZE failed on %: %', r.tablename, SQLERRM;
    END;
  END LOOP;

  RAISE NOTICE '✓ [056] ANALYZE complete: analyzed=%, failed=%', v_ok, v_fail;

  IF v_fail > 0 THEN
    RAISE WARNING '[056] % table(s) could not be ANALYZEd — check warnings above', v_fail;
  END IF;
END;
$$;

-- ═══════════════════════════════════════════════════════════════════════════════
-- Phase 2: Unused index detection report
-- ═══════════════════════════════════════════════════════════════════════════════

DO $$
DECLARE
  r              RECORD;
  v_unused_count int := 0;
  v_total        int := 0;
BEGIN
  -- Count total indexes
  SELECT count(*) INTO v_total
  FROM pg_stat_user_indexes s
  JOIN pg_class tc ON tc.oid = s.relid
  JOIN pg_namespace n ON n.oid = tc.relnamespace
  WHERE n.nspname = 'public';

  -- Report unused indexes (idx_scan = 0) that are not constraint-backing
  FOR r IN
    SELECT
      s.relname                                 AS table_name,
      s.indexrelname                            AS index_name,
      s.idx_scan,
      pg_relation_size(s.indexrelid)            AS index_size_bytes,
      -- Is this index backing a constraint?
      EXISTS (
        SELECT 1 FROM pg_constraint c
        WHERE c.conindid = s.indexrelid
      )                                         AS is_constraint_backed,
      i.indisunique                             AS is_unique,
      i.indisprimary                            AS is_primary
    FROM pg_stat_user_indexes s
    JOIN pg_index i ON i.indexrelid = s.indexrelid
    JOIN pg_class tc ON tc.oid = s.relid
    JOIN pg_namespace n ON n.oid = tc.relnamespace
    WHERE n.nspname = 'public'
      AND s.idx_scan = 0
      AND NOT i.indisprimary         -- never a PK
      AND NOT EXISTS (               -- never constraint-backed
        SELECT 1 FROM pg_constraint c
        WHERE c.conindid = s.indexrelid
      )
    ORDER BY pg_relation_size(s.indexrelid) DESC, s.relname, s.indexrelname
  LOOP
    v_unused_count := v_unused_count + 1;
    RAISE WARNING '[056] UNUSED INDEX: %.% (size: % bytes, unique: %) — candidate for DROP after long-term monitoring',
      r.table_name, r.index_name, r.index_size_bytes, r.is_unique;
  END LOOP;

  IF v_unused_count = 0 THEN
    RAISE NOTICE '✓ [056] No unused non-constraint indexes found in public schema';
  ELSE
    RAISE NOTICE '[056] % of % indexes in public schema show 0 scans (advisory only — verify with pg_stat_reset date before dropping)',
      v_unused_count, v_total;
  END IF;

  -- Report last statistics reset time
  DECLARE
    v_reset_time timestamptz;
  BEGIN
    SELECT pg_stat_get_db_stat_reset_time(oid) INTO v_reset_time
    FROM pg_database
    WHERE datname = current_database();

    IF v_reset_time IS NOT NULL THEN
      RAISE NOTICE '[056] pg_stat last reset: % — unused-index data valid since then',
        v_reset_time::text;
    ELSE
      RAISE NOTICE '[056] pg_stat never reset — unused-index counts are lifetime totals';
    END IF;
  END;

  RAISE NOTICE 'Migration 056 complete — all public tables analyzed, unused indexes logged.';
END;
$$;
