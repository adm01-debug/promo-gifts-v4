CREATE INDEX IF NOT EXISTS idx_products_active_sale_price
  ON public.products (sale_price)
  WHERE active = true;

CREATE INDEX IF NOT EXISTS idx_products_active_created_at
  ON public.products (created_at DESC)
  WHERE active = true;

CREATE INDEX IF NOT EXISTS idx_products_active_stock_quantity
  ON public.products (stock_quantity DESC)
  WHERE active = true;