-- Composite indexes for seller_carts queries
-- The main query is: WHERE seller_id = ? ORDER BY updated_at DESC
-- The current single-column index on seller_id forces a sort step after filtering.
-- A compound (seller_id, updated_at DESC) index satisfies both clauses in one scan.
CREATE INDEX IF NOT EXISTS idx_seller_carts_seller_updated
  ON public.seller_carts(seller_id, updated_at DESC);

-- Composite index for seller_cart_items nested sort
-- PostgREST query: WHERE cart_id = ? ORDER BY sort_order ASC
-- A compound (cart_id, sort_order) index avoids a sort after the cart_id filter.
CREATE INDEX IF NOT EXISTS idx_seller_cart_items_cart_sort
  ON public.seller_cart_items(cart_id, sort_order ASC);
