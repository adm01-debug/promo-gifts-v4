-- Migration: fix_favorites_security_position
-- 2026-06-21
--
-- 1. SECURITY FIX: get_favorite_list_counts must verify caller is the requested user.
--    Previous version allowed any authenticated user to read another user's list counts
--    by passing an arbitrary _user_id (SECURITY DEFINER with no auth.uid() guard).
--
-- 2. POSITION: Add atomic position assignment trigger for favorite_lists table.
--    favorite_items already has trg_fi_assign_position; favorite_lists lacked one,
--    leaving position = client-supplied value (race between concurrent create calls).

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. Secure get_favorite_list_counts
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.get_favorite_list_counts(_user_id uuid)
RETURNS TABLE(list_id uuid, item_count bigint)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  -- Caller must be _user_id. Prevents horizontal privilege escalation where
  -- any authenticated user could query another user's list counts.
  SELECT fi.list_id, COUNT(*)::bigint AS item_count
    FROM public.favorite_items fi
   WHERE fi.user_id = _user_id
     AND _user_id = auth.uid()
   GROUP BY fi.list_id;
$$;

GRANT EXECUTE ON FUNCTION public.get_favorite_list_counts(uuid) TO authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. Atomic position for favorite_lists
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.fn_favorite_lists_assign_position()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_max int;
BEGIN
  -- Assign position = current max + 1 for this user, ignoring client-supplied value
  SELECT COALESCE(MAX(position), -1) + 1
    INTO v_max
    FROM public.favorite_lists
   WHERE user_id = NEW.user_id;
  NEW.position := v_max;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_fl_assign_position ON public.favorite_lists;
CREATE TRIGGER trg_fl_assign_position
  BEFORE INSERT ON public.favorite_lists
  FOR EACH ROW EXECUTE FUNCTION public.fn_favorite_lists_assign_position();
