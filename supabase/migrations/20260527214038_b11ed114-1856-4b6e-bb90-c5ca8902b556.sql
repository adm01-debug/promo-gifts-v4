DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'products' AND policyname = 'Temp public read products'
  ) THEN
    CREATE POLICY "Temp public read products" ON public.products FOR SELECT USING (true);
  END IF;
END $$;
GRANT SELECT ON public.products TO anon;