-- Integridade do módulo Carrinhos (seller_cart_items / seller_carts)
-- FIX 1: sort_order estável e gapless por carrinho (insert + move)
-- FIX 2: propagar updated_at do item para o carrinho-pai (insert/update/delete)
-- Idempotente: CREATE OR REPLACE + DROP TRIGGER IF EXISTS + backfill só de NULLs.

-- ===== FIX 1 =====
CREATE OR REPLACE FUNCTION public.assign_cart_item_sort_order()
RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public' AS $$
BEGIN
  IF (TG_OP = 'INSERT' AND NEW.sort_order IS NULL)
     OR (TG_OP = 'UPDATE' AND NEW.cart_id <> OLD.cart_id) THEN
    SELECT COALESCE(MAX(sort_order), -1) + 1
      INTO NEW.sort_order
      FROM public.seller_cart_items
     WHERE cart_id = NEW.cart_id AND id <> NEW.id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_assign_cart_item_sort_order ON public.seller_cart_items;
CREATE TRIGGER trg_assign_cart_item_sort_order
  BEFORE INSERT OR UPDATE OF cart_id ON public.seller_cart_items
  FOR EACH ROW EXECUTE FUNCTION public.assign_cart_item_sort_order();

-- Backfill determinístico dos NULLs existentes (preserva ordem já definida)
WITH maxes AS (
  SELECT cart_id, COALESCE(MAX(sort_order) FILTER (WHERE sort_order IS NOT NULL), -1) AS max_so
  FROM public.seller_cart_items GROUP BY cart_id
),
to_fix AS (
  SELECT id, cart_id, ROW_NUMBER() OVER (PARTITION BY cart_id ORDER BY created_at, id) AS rn
  FROM public.seller_cart_items WHERE sort_order IS NULL
)
UPDATE public.seller_cart_items s
SET sort_order = m.max_so + t.rn
FROM to_fix t JOIN maxes m ON m.cart_id = t.cart_id
WHERE s.id = t.id;

-- ===== FIX 2 =====
CREATE OR REPLACE FUNCTION public.touch_seller_cart_on_item_change()
RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public' AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    UPDATE public.seller_carts SET updated_at = now() WHERE id = OLD.cart_id;
    RETURN OLD;
  END IF;
  UPDATE public.seller_carts SET updated_at = now() WHERE id = NEW.cart_id;
  IF TG_OP = 'UPDATE' AND NEW.cart_id <> OLD.cart_id THEN
    UPDATE public.seller_carts SET updated_at = now() WHERE id = OLD.cart_id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_touch_seller_cart_on_item_change ON public.seller_cart_items;
CREATE TRIGGER trg_touch_seller_cart_on_item_change
  AFTER INSERT OR UPDATE OR DELETE ON public.seller_cart_items
  FOR EACH ROW EXECUTE FUNCTION public.touch_seller_cart_on_item_change();
