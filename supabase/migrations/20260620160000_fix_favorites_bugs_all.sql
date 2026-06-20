-- ================================================================
-- fix_favorites_bugs_all
-- BUG-DB-1: restore_favorite_from_trash data loss on conflict
-- BUG-DB-2: purge_favorite_trash_old TOO_MANY_ROWS crash
-- BUG-DB-3: Missing expires_at / original_id indexes on trash
-- BUG-DB-4: user_favorites INSERT policy allows anon role
-- BUG-DB-5/6: move_favorites_to_trash double-inserts to trash
-- NEW:       get_favorite_list_counts RPC (efficient GROUP BY)
-- ================================================================

-- BUG-DB-1: restore_favorite_from_trash
-- Old bug: ON CONFLICT DO NOTHING left v_item_id = NULL
-- but DELETE FROM trash still executed → item lost from trash, not in favorite_items
CREATE OR REPLACE FUNCTION public.restore_favorite_from_trash(
  _trash_id uuid,
  _user_id  uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_trash        public.favorite_items_trash%ROWTYPE;
  v_list         public.favorite_lists%ROWTYPE;
  v_item_id      uuid;
  v_list_changed bool := false;
BEGIN
  -- Fetch trash row (must belong to requesting user)
  SELECT * INTO v_trash
    FROM public.favorite_items_trash
   WHERE id = _trash_id AND user_id = _user_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_found');
  END IF;

  -- Resolve target list: prefer original, fall back to default
  SELECT * INTO v_list
    FROM public.favorite_lists
   WHERE id = v_trash.list_id
     AND user_id = _user_id
     AND is_archived = false;

  IF NOT FOUND THEN
    SELECT * INTO v_list
      FROM public.favorite_lists
     WHERE user_id = _user_id AND is_default = true
     LIMIT 1;
    v_list_changed := true;
  END IF;

  IF v_list.id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'no_target_list');
  END IF;

  -- Re-insert the item; skip if it already exists
  INSERT INTO public.favorite_items (
    list_id, user_id, product_id, variant_id, variant_info,
    note, price_at_save, position, added_at
  ) VALUES (
    v_list.id, _user_id, v_trash.product_id, v_trash.variant_id, v_trash.variant_info,
    v_trash.note, v_trash.price_at_save, v_trash.position, v_trash.added_at
  )
  ON CONFLICT (list_id, product_id, variant_id) DO NOTHING
  RETURNING id INTO v_item_id;

  -- BUG-DB-1 FIX: if the item already existed (conflict), fetch its id.
  -- Without this the old code deleted from trash even though nothing was restored.
  IF v_item_id IS NULL THEN
    SELECT id INTO v_item_id
      FROM public.favorite_items
     WHERE list_id    = v_list.id
       AND product_id = v_trash.product_id
       AND (
             (variant_id = v_trash.variant_id)
             OR (variant_id IS NULL AND v_trash.variant_id IS NULL)
           );
  END IF;

  -- Only remove from trash after confirming the item is in favorite_items
  DELETE FROM public.favorite_items_trash WHERE id = _trash_id;

  RETURN jsonb_build_object(
    'ok',                    true,
    'list_id',               v_list.id,
    'item_id',               v_item_id,
    'original_list_changed', v_list_changed
  );
END;
$$;

-- BUG-DB-2: purge_favorite_trash_old crashed with TOO_MANY_ROWS
-- when more than one expired row existed because of "RETURNING 1 INTO v_count"
CREATE OR REPLACE FUNCTION public.purge_favorite_trash_old()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count integer := 0;
BEGIN
  DELETE FROM public.favorite_items_trash
  WHERE expires_at < now();
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

-- BUG-DB-3: Add indexes that were missing on favorite_items_trash
-- (a) Speeds up scheduled TTL cleanup queries
CREATE INDEX IF NOT EXISTS idx_fit_expires_at
  ON public.favorite_items_trash(expires_at)
  WHERE expires_at IS NOT NULL;

-- (b) Speeds up undo-toast lookup by original_id (used in removeItem onSuccess)
CREATE INDEX IF NOT EXISTS idx_fit_user_original
  ON public.favorite_items_trash(user_id, original_id)
  WHERE original_id IS NOT NULL;

-- BUG-DB-4: user_favorites INSERT policy was using {public} role (includes anon)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_policies
     WHERE schemaname = 'public'
       AND tablename  = 'user_favorites'
       AND policyname = 'users_create_own_favorites'
  ) THEN
    EXECUTE 'DROP POLICY users_create_own_favorites ON public.user_favorites';
  END IF;
END
$$;
CREATE POLICY users_create_own_favorites
  ON public.user_favorites
  FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

-- BUG-DB-5/6: Simplify move_favorites_to_trash - let trigger handle trash insertion
-- Old version did CTE delete (triggering soft-delete) + explicit insert = double entries
CREATE OR REPLACE FUNCTION public.move_favorites_to_trash(_item_ids uuid[])
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count integer := 0;
BEGIN
  IF _item_ids IS NULL OR array_length(_item_ids, 1) IS NULL THEN
    RETURN 0;
  END IF;
  -- Deleting rows fires trg_fi_soft_delete → fn_favorite_items_soft_delete → trash
  DELETE FROM public.favorite_items
   WHERE id = ANY(_item_ids)
     AND user_id = auth.uid();
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
EXCEPTION WHEN OTHERS THEN
  RETURN 0;
END;
$$;

-- NEW: efficient item count per list — replaces full-table-scan in JS (BUG-FE-4)
CREATE OR REPLACE FUNCTION public.get_favorite_list_counts(_user_id uuid)
RETURNS TABLE(list_id uuid, item_count bigint)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT fi.list_id, COUNT(*)::bigint AS item_count
    FROM public.favorite_items fi
   WHERE fi.user_id = _user_id
   GROUP BY fi.list_id;
$$;

GRANT EXECUTE ON FUNCTION public.get_favorite_list_counts(uuid) TO authenticated;
