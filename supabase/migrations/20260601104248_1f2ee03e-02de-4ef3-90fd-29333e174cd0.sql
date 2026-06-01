-- Conceder SELECT nas tabelas principais para usuários authenticated e anon
-- (A segurança real é aplicada via RLS nessas tabelas)
-- Guards: tabelas/views podem não existir em preview snapshots.

DO $$
DECLARE
  objs text[] := ARRAY[
    'products', 'suppliers', 'categories', 'product_variants', 'variant_supplier_sources',
    'v_products_public', 'v_suppliers_public'
  ];
  o text;
BEGIN
  FOREACH o IN ARRAY objs LOOP
    IF EXISTS (
      SELECT 1 FROM pg_class c
      JOIN pg_namespace n ON c.relnamespace = n.oid
      WHERE n.nspname = 'public' AND c.relname = o AND c.relkind IN ('r','v','m','f','p')
    ) THEN
      EXECUTE format('GRANT SELECT ON public.%I TO authenticated, anon', o);
    END IF;
  END LOOP;
END $$;
