-- GAP-12 follow-up: make per-list favorite position assignment truly atomic.
--
-- The original fn_favorite_items_assign_position (20260620170000) still did a plain
-- `SELECT COALESCE(MAX(position), -1) + 1` inside a BEFORE INSERT trigger and called it
-- "atomic", but it is not: under READ COMMITTED two concurrent inserts to the same list
-- both read the same MAX (neither sees the other's uncommitted row) and assign duplicate
-- positions, and there is no UNIQUE(list_id, position) to reject the collision — producing
-- nondeterministic ordering and breaking drag-reorder index math.
--
-- Fix: lock the parent favorite_lists row first, so concurrent inserts to the same list
-- serialize on that row instead of racing on MAX(position). CREATE OR REPLACE heals prod
-- and replay alike.

CREATE OR REPLACE FUNCTION public.fn_favorite_items_assign_position()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.position IS NULL THEN
    -- Serialize concurrent inserts to the same list by locking the parent list row.
    PERFORM 1 FROM favorite_lists WHERE id = NEW.list_id FOR UPDATE;
    SELECT COALESCE(MAX(position), -1) + 1
      INTO NEW.position
      FROM favorite_items
     WHERE list_id = NEW.list_id;
  END IF;
  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.fn_favorite_items_assign_position() FROM anon, authenticated, PUBLIC;
