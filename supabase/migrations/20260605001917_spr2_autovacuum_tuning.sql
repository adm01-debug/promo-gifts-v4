
ALTER TABLE public.supplier_products_raw SET (
  autovacuum_analyze_scale_factor = 0.02,
  autovacuum_vacuum_scale_factor  = 0.05
);
ANALYZE public.supplier_products_raw;
