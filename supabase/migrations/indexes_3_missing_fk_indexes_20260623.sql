-- M3: FK indexes faltantes
CREATE INDEX IF NOT EXISTS idx_stock_daily_supplier_id ON public.stock_daily_summary(supplier_id);
CREATE INDEX IF NOT EXISTS idx_stock_snapshots_branch_id ON public.stock_snapshots(supplier_branch_id) WHERE supplier_branch_id IS NOT NULL;
