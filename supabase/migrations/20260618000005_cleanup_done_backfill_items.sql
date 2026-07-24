-- Migration: cleanup_done_backfill_items_20260618
-- Purpose: Remove completed backfill queue entries to keep table lean
-- Result: 720 done rows deleted

BEGIN;

DELETE FROM public.image_backfill_queue
WHERE status = 'done';

COMMIT;
