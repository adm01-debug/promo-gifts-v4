GRANT SELECT ON public.products TO anon;
CREATE POLICY "Public access for testing" ON public.products FOR SELECT TO anon USING (true);