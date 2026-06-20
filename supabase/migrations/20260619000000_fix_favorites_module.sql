-- ============================================================
-- MIGRATION: fix_favorites_module
-- Date: 2026-06-19
-- Author: Claude Code (audit + fix)
--
-- BUG #1 (CRITICAL): The unique index on favorite_items uses
--   COALESCE(variant_id, '00000000-0000-0000-0000-000000000000')
--   which is a functional expression. PostgREST's upsert with
--   onConflict:'list_id,product_id,variant_id' cannot resolve
--   against functional indexes → all add-to-favorites fail with
--   42P10 "there is no unique or exclusion constraint matching".
--   Fix: replace with NULLS NOT DISTINCT (PG15+/PG17 compatible).
--
-- BUG #2: ensure_default_favorite_list had a TOCTOU race condition
--   (SELECT then INSERT) that could cause duplicate default lists.
--   Fix: wrap INSERT in exception handler.
--
-- BUG #3: fn_favorite_items_soft_delete ran as INVOKER, so
--   coordinator-level deletes of other users' items would cause
--   the trigger INSERT into trash to fail RLS. Fix: SECURITY DEFINER.
--
-- BUG #4: No atomic restore-from-trash RPC; two-step client code
--   could leave items in both tables on partial failure.
--   Fix: add restore_favorite_from_trash() RPC.
-- ============================================================

-- ─── BUG #1: fix unique index ────────────────────────────────

DROP INDEX IF EXISTS public.uniq_fi_list_product_variant;

-- NULLS NOT DISTINCT: treats NULL as equal for uniqueness,
-- same semantics as the old COALESCE sentinel but works with
-- plain-column ON CONFLICT syntax required by PostgREST.
CREATE UNIQUE INDEX uniq_fi_list_product_variant
  ON public.favorite_items USING btree (list_id, product_id, variant_id)
  NULLS NOT DISTINCT;

-- ─── BUG #2: race-safe ensure_default_favorite_list ──────────

CREATE OR REPLACE FUNCTION public.ensure_default_favorite_list(_user_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
DECLARE
  v_list_id uuid;
BEGIN
  -- Fast path: list already exists
  SELECT id INTO v_list_id
  FROM public.favorite_lists
  WHERE user_id = _user_id AND is_default = true
  LIMIT 1;

  IF v_list_id IS NOT NULL THEN
    RETURN v_list_id;
  END IF;

  -- Slow path: create, handling concurrent creation via exception
  BEGIN
    INSERT INTO public.favorite_lists (
      user_id, name, description, color, icon, is_default, position
    ) VALUES (
      _user_id, 'Meus Favoritos', 'Lista padrão de favoritos', '#3B82F6', 'Heart', true, 0
    )
    RETURNING id INTO v_list_id;
  EXCEPTION WHEN unique_violation THEN
    -- Another concurrent call won the race; fetch the winner
    SELECT id INTO v_list_id
    FROM public.favorite_lists
    WHERE user_id = _user_id AND is_default = true
    LIMIT 1;
  END;

  RETURN v_list_id;
END;
$$;

-- ─── BUG #3: soft-delete trigger — SECURITY DEFINER ──────────

CREATE OR REPLACE FUNCTION public.fn_favorite_items_soft_delete()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.favorite_items_trash (
    original_id, list_id, user_id, product_id, variant_id,
    variant_info, note, price_at_save, position, added_at, deleted_at
  ) VALUES (
    OLD.id, OLD.list_id, OLD.user_id, OLD.product_id, OLD.variant_id,
    OLD.variant_info, OLD.note, OLD.price_at_save, OLD.position, OLD.added_at, now()
  )
  ON CONFLICT DO NOTHING;  -- safeguard against duplicate trash entries
  RETURN OLD;
END;
$$;

-- ─── BUG #4: atomic restore-from-trash RPC ───────────────────

CREATE OR REPLACE FUNCTION public.restore_favorite_from_trash(
  _trash_id        uuid,
  _user_id         uuid,
  _fallback_list_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
DECLARE
  v_trash           public.favorite_items_trash%ROWTYPE;
  v_list_id         uuid;
  v_item_id         uuid;
  v_original_list   uuid;
BEGIN
  -- Load and validate ownership
  SELECT * INTO v_trash
  FROM public.favorite_items_trash
  WHERE id = _trash_id AND user_id = _user_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not-found');
  END IF;

  v_original_list := v_trash.list_id;

  -- Resolve target list: original → fallback → default
  SELECT id INTO v_list_id
  FROM public.favorite_lists
  WHERE id = v_trash.list_id
    AND user_id = _user_id
    AND is_archived = false;

  IF v_list_id IS NULL AND _fallback_list_id IS NOT NULL THEN
    SELECT id INTO v_list_id
    FROM public.favorite_lists
    WHERE id = _fallback_list_id
      AND user_id = _user_id
      AND is_archived = false;
  END IF;

  IF v_list_id IS NULL THEN
    v_list_id := public.ensure_default_favorite_list(_user_id);
  END IF;

  -- Atomically restore (idempotent via ON CONFLICT DO NOTHING)
  INSERT INTO public.favorite_items (
    list_id, user_id, product_id, variant_id, variant_info,
    note, price_at_save
  ) VALUES (
    v_list_id, _user_id, v_trash.product_id, v_trash.variant_id, v_trash.variant_info,
    v_trash.note, v_trash.price_at_save
  )
  ON CONFLICT (list_id, product_id, variant_id) DO NOTHING
  RETURNING id INTO v_item_id;

  -- Remove from trash only if insert succeeded or item already in list
  DELETE FROM public.favorite_items_trash WHERE id = _trash_id;

  RETURN jsonb_build_object(
    'ok',                   true,
    'item_id',              v_item_id,
    'list_id',              v_list_id,
    'original_list_changed', (v_list_id IS DISTINCT FROM v_original_list)
  );
END;
$$;

-- Grant execute to authenticated users
GRANT EXECUTE ON FUNCTION public.restore_favorite_from_trash(uuid, uuid, uuid)
  TO authenticated;
