-- Migration 065: Drop unused indexes (performance — unused_index)
--
-- Source: 200-commit audit — Supabase performance advisor
-- Findings addressed: unused_index (215 hits)
--
-- ─── Root Cause ──────────────────────────────────────────────────────────────
--
-- Many indexes were created speculatively or by ORM tooling and have never
-- been used (idx_scan = 0 in pg_stat_user_indexes). Unused indexes:
--   • Impose write overhead on every INSERT/UPDATE/DELETE
--   • Consume disk space and shared_buffers
--   • Slow VACUUM (more pages to update)
--   • Confuse the query planner (more choices → more planning time)
--
-- ─── Safety Analysis ─────────────────────────────────────────────────────────
--
-- Excluded from drop:
--   • Primary key indexes (indisprimary = true)
--   • Unique constraint indexes (indisunique = true)
--   • Exclusion constraint indexes (indisexclusion = true)
--   • Any index the DROP fails on (per-index EXCEPTION handler)
--
-- If a DROP fails (e.g. index has dependents), the EXCEPTION handler logs a
-- WARNING and continues. The migration never fails hard.
--
-- Note: pg_stat_user_indexes.idx_scan resets on pg_stat_reset() or restart.
-- We trust the Supabase advisor's 215-finding output as ground truth.
--
-- ─── Idempotency ─────────────────────────────────────────────────────────────
--
-- DROP INDEX IF EXISTS → no-op if already dropped.
-- Re-running is safe.
--
-- ─── Note on CONCURRENTLY ────────────────────────────────────────────────────
--
-- DROP INDEX CONCURRENTLY cannot run inside a transaction block.
-- Supabase migrations run inside transactions, so we use regular DROP INDEX.
-- Brief table locks are acceptable during a planned migration window.

-- ═══════════════════════════════════════════════════════════════════════════════
-- Phase 1: Drop unused non-constraint indexes in public schema
-- ═══════════════════════════════════════════════════════════════════════════════

DO $$
DECLARE
  r      RECORD;
  v_ok   int := 0;
  v_skip int := 0;
BEGIN
  FOR r IN
    SELECT
      psi.indexrelname  AS index_name,
      psi.relname       AS table_name,
      psi.idx_scan
    FROM pg_stat_user_indexes psi
    JOIN pg_index          pi  ON pi.indexrelid  = psi.indexrelid
    JOIN pg_class          ic  ON ic.oid          = psi.indexrelid
    JOIN pg_namespace      n   ON n.oid           = ic.relnamespace
    WHERE psi.schemaname = 'public'
      AND psi.idx_scan   = 0          -- never used
      AND NOT pi.indisprimary         -- not primary key
      AND NOT pi.indisunique          -- not unique constraint
      AND NOT pi.indisexclusion       -- not exclusion constraint
    ORDER BY psi.relname, psi.indexrelname
  LOOP
    BEGIN
      EXECUTE format('DROP INDEX IF EXISTS public.%I', r.index_name);
      v_ok := v_ok + 1;
      RAISE NOTICE '[065] Dropped index: public.% (table=%, scans=%)',
        r.index_name, r.table_name, r.idx_scan;
    EXCEPTION WHEN OTHERS THEN
      v_skip := v_skip + 1;
      RAISE WARNING '[065] Could not drop public.%: %', r.index_name, SQLERRM;
    END;
  END LOOP;

  IF v_ok = 0 AND v_skip = 0 THEN
    RAISE NOTICE '[065] Phase 1: No unused non-constraint indexes found — already clean';
  ELSE
    RAISE NOTICE '[065] Phase 1: dropped=%, failed=%', v_ok, v_skip;
  END IF;
END;
$$;

-- ═══════════════════════════════════════════════════════════════════════════════
-- Phase 2: Same sweep for analytics schema (if exists)
-- ═══════════════════════════════════════════════════════════════════════════════

DO $$
DECLARE
  r      RECORD;
  v_ok   int := 0;
  v_skip int := 0;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_namespace WHERE nspname = 'analytics') THEN
    RAISE NOTICE '[065] Phase 2: analytics schema does not exist — skipping';
    RETURN;
  END IF;

  FOR r IN
    SELECT
      psi.indexrelname  AS index_name,
      psi.relname       AS table_name,
      psi.idx_scan
    FROM pg_stat_user_indexes psi
    JOIN pg_index          pi  ON pi.indexrelid  = psi.indexrelid
    JOIN pg_class          ic  ON ic.oid          = psi.indexrelid
    JOIN pg_namespace      n   ON n.oid           = ic.relnamespace
    WHERE psi.schemaname = 'analytics'
      AND psi.idx_scan   = 0
      AND NOT pi.indisprimary
      AND NOT pi.indisunique
      AND NOT pi.indisexclusion
    ORDER BY psi.relname, psi.indexrelname
  LOOP
    BEGIN
      EXECUTE format('DROP INDEX IF EXISTS analytics.%I', r.index_name);
      v_ok := v_ok + 1;
      RAISE NOTICE '[065] Dropped index: analytics.% (table=%)', r.index_name, r.table_name;
    EXCEPTION WHEN OTHERS THEN
      v_skip := v_skip + 1;
      RAISE WARNING '[065] Could not drop analytics.%: %', r.index_name, SQLERRM;
    END;
  END LOOP;

  IF v_ok = 0 AND v_skip = 0 THEN
    RAISE NOTICE '[065] Phase 2: No unused analytics indexes found — already clean';
  ELSE
    RAISE NOTICE '[065] Phase 2: dropped=%, failed=%', v_ok, v_skip;
  END IF;
END;
$$;

-- ═══════════════════════════════════════════════════════════════════════════════
-- Phase 3: Validate — count remaining unused indexes
-- ═══════════════════════════════════════════════════════════════════════════════

DO $$
DECLARE
  v_remaining_public    int;
  v_remaining_analytics int;
  r                     RECORD;
BEGIN
  SELECT count(*) INTO v_remaining_public
  FROM pg_stat_user_indexes psi
  JOIN pg_index pi ON pi.indexrelid = psi.indexrelid
  WHERE psi.schemaname = 'public'
    AND psi.idx_scan   = 0
    AND NOT pi.indisprimary
    AND NOT pi.indisunique
    AND NOT pi.indisexclusion;

  SELECT count(*) INTO v_remaining_analytics
  FROM pg_stat_user_indexes psi
  JOIN pg_index pi ON pi.indexrelid = psi.indexrelid
  WHERE psi.schemaname = 'analytics'
    AND psi.idx_scan   = 0
    AND NOT pi.indisprimary
    AND NOT pi.indisunique
    AND NOT pi.indisexclusion;

  RAISE NOTICE '[065] Validation: remaining unused public=%, analytics=%',
    v_remaining_public, v_remaining_analytics;

  IF v_remaining_public = 0 THEN
    RAISE NOTICE '[065] public schema: unused_index CLEARED';
  ELSE
    RAISE WARNING '[065] % unused index(es) remain in public (check warnings above)', v_remaining_public;
    FOR r IN
      SELECT psi.indexrelname, psi.relname
      FROM pg_stat_user_indexes psi
      JOIN pg_index pi ON pi.indexrelid = psi.indexrelid
      WHERE psi.schemaname = 'public'
        AND psi.idx_scan   = 0
        AND NOT pi.indisprimary
        AND NOT pi.indisunique
        AND NOT pi.indisexclusion
      ORDER BY psi.relname, psi.indexrelname
    LOOP
      RAISE WARNING '[065]   still present: public.% (table=%)', r.indexrelname, r.relname;
    END LOOP;
  END IF;

  RAISE NOTICE 'Migration 065 complete — unused_index should clear on next advisor run.';
END;
$$;
