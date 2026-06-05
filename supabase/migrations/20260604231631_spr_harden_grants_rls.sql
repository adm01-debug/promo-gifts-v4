REVOKE INSERT, UPDATE, REFERENCES ON public.supplier_products_raw FROM anon;
REVOKE INSERT, UPDATE, REFERENCES ON public.supplier_products_raw FROM authenticated;
REVOKE SELECT (last_error, claimed_at, attempts, source_event_id, source_endpoint)
  ON public.supplier_products_raw FROM anon;