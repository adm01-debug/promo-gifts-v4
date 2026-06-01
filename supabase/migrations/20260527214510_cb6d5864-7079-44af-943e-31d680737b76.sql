UPDATE public.products 
SET featured = true, new_arrival = true, on_sale = true 
WHERE id = 'bea8bd6e-14f4-4482-921d-ecc179391166';

-- Política temporária permitindo leitura anônima para o print
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