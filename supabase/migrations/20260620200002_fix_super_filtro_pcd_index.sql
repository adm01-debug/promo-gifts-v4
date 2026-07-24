-- BUG-SF-IDX-PCD: partial index on product_commemorative_dates for active rows.
-- fn_super_filtro_product_ids filters pcd.is_active = true via EXISTS subquery.
-- Without this index, every call with a datas filter did a full scan of ~34k rows.
-- Partial index shrinks working set to only active links, matching the WHERE clause exactly.

CREATE INDEX IF NOT EXISTS idx_pcd_product_id_active
  ON public.product_commemorative_dates (product_id)
  WHERE is_active = true;
