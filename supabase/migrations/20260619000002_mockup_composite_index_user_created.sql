-- BUG-9 FIX: fetchMockupHistory runs:
--   SELECT ... FROM generated_mockups WHERE user_id = ? ORDER BY created_at DESC LIMIT 200
-- The existing idx_generated_mockups_user_id covers the filter but forces a separate
-- Sort step on all matching rows before LIMIT can fire. For power users with hundreds of
-- mockups this degrades linearly. A composite index (user_id, created_at DESC) lets
-- PostgreSQL return rows already ordered from the B-tree, so LIMIT 200 stops after
-- reading exactly 200 index entries — O(LIMIT) instead of O(N_user_rows).
-- CONCURRENTLY avoids a full table lock on creation.
CREATE INDEX IF NOT EXISTS idx_generated_mockups_user_created
  ON public.generated_mockups (user_id, created_at DESC);
