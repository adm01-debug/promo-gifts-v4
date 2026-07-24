GRANT SELECT ON public.products TO anon;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'products' AND policyname = 'Public access for testing'
  ) THEN
    CREATE POLICY "Public access for testing" ON public.products FOR SELECT TO anon USING (true);
  END IF;
END $$;