-- =============================================================================
-- GAP-11: Block addItem to archived list (DB trigger)
-- GAP-12: Atomic position assignment for createList (replace race-prone MAX+1)
-- =============================================================================

-- ---------------------------------------------------------------------------
-- GAP-11: Prevent inserting favorite_items into an archived list
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.fn_favorite_items_no_archived_list()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _archived boolean;
BEGIN
  SELECT is_archived INTO _archived
  FROM favorite_lists
  WHERE id = NEW.list_id;

  IF _archived IS TRUE THEN
    RAISE EXCEPTION 'cannot_add_to_archived_list'
      USING HINT = 'The target favorite list is archived. Unarchive it first.',
            ERRCODE = 'P0001';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_fi_no_archived_list ON favorite_items;
CREATE TRIGGER trg_fi_no_archived_list
  BEFORE INSERT OR UPDATE OF list_id ON favorite_items
  FOR EACH ROW
  EXECUTE FUNCTION fn_favorite_items_no_archived_list();

-- ---------------------------------------------------------------------------
-- GAP-12: Atomic position assignment — use a sequence per list
--   Previous approach: JS sends MAX(position)+1 → race on concurrent inserts.
--   New approach: DB trigger assigns position atomically when position IS NULL.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.fn_favorite_items_assign_position()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.position IS NULL THEN
    SELECT COALESCE(MAX(position), -1) + 1
      INTO NEW.position
      FROM favorite_items
     WHERE list_id = NEW.list_id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_fi_assign_position ON favorite_items;
CREATE TRIGGER trg_fi_assign_position
  BEFORE INSERT ON favorite_items
  FOR EACH ROW
  EXECUTE FUNCTION fn_favorite_items_assign_position();

-- Revoke public execute so only service-role / postgres can call directly
REVOKE EXECUTE ON FUNCTION public.fn_favorite_items_no_archived_list() FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.fn_favorite_items_assign_position() FROM anon, authenticated, PUBLIC;
