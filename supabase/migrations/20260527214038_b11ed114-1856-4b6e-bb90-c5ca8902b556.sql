CREATE POLICY "Temp public read products" ON public.products FOR SELECT USING (true);
GRANT SELECT ON public.products TO anon;