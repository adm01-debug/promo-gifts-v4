-- Migration 068: Fix last unindexed FK — collection_products.product_id
--
-- Source: 200-commit audit — post-067 validation
-- Findings addressed: unindexed_foreign_keys (1 → 0)
--
-- ─── Root Cause ──────────────────────────────────────────────────────────────
--
-- collection_products has a composite unique index:
--   collection_products_unique_pair (collection_id, product_id)
-- product_id is the SECOND column — not a leading index.
-- PostgreSQL FK enforcement requires product_id to be the LEADING column.
--
-- Migration 066 loop skipped this (no unindexed FK found due to attnum check
-- matching the unique index via a different code path).
-- Migration 067 Phase 1 hit the EXCEPTION handler silently (naming conflict
-- from 066 loop also targeting idx_collection_products_product_id).
--
-- Fix: simpler, direct CREATE INDEX with a shorter distinct name.
--
-- ─── Idempotency ─────────────────────────────────────────────────────────────
--
-- CREATE INDEX IF NOT EXISTS → no-op if already exists.

CREATE INDEX IF NOT EXISTS idx_coll_products_product_id
  ON public.collection_products (product_id);

-- ═══════════════════════════════════════════════════════════════════════════════
-- Validate: confirm 0 unindexed FKs remain
-- ═══════════════════════════════════════════════════════════════════════════════

DO $$
DECLARE
  v_count int;
BEGIN
  SELECT count(DISTINCT (c.conrelid, c.conkey[1]))
  INTO v_count
  FROM pg_constraint c
  JOIN pg_namespace n ON n.oid = (SELECT relnamespace FROM pg_class WHERE oid = c.conrelid)
  WHERE c.contype = 'f'
    AND n.nspname = 'public'
    AND NOT EXISTS (
      SELECT 1 FROM pg_index pi
      JOIN pg_attribute pa ON pa.attrelid = pi.indrelid AND pa.attnum = pi.indkey[0]
      WHERE pi.indrelid = c.conrelid AND pa.attnum = c.conkey[1]
    );

  IF v_count = 0 THEN
    RAISE NOTICE '[068] unindexed_foreign_keys: CLEARED (0 remaining)';
  ELSE
    RAISE WARNING '[068] % FK(s) still unindexed after migration', v_count;
  END IF;

  RAISE NOTICE 'Migration 068 complete.';
END;
$$;
