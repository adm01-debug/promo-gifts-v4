-- P4 replicado nas tabelas raw/staging irmas de supplier_products_raw.

-- 1) supplier_products_raw_history: RLS estava DESLIGADO com grants amplos p/ anon
--    (rls_disabled_in_public). E escrita apenas pelo trigger fn_spr_history, cuja
--    sessao (service_role/owner via SECURITY DEFINER) ignora RLS. Liga RLS, adiciona
--    policies (service_role ALL, admin SELECT) e remove acesso do anon.
ALTER TABLE public.supplier_products_raw_history ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.supplier_products_raw_history FROM anon;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES ON public.supplier_products_raw_history FROM authenticated;

DROP POLICY IF EXISTS hist_all_service ON public.supplier_products_raw_history;
CREATE POLICY hist_all_service ON public.supplier_products_raw_history
  FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS hist_select_admin ON public.supplier_products_raw_history;
CREATE POLICY hist_select_admin ON public.supplier_products_raw_history
  FOR SELECT TO authenticated USING (is_admin_or_above((SELECT auth.uid())));

-- 2) Staging irmas: remove o GRANT latente de escrita do anon (RLS ja gate; anon
--    nunca escreve staging interno). authenticated mantido p/ nao quebrar tooling admin.
REVOKE INSERT, UPDATE, REFERENCES ON public.import_staging_images   FROM anon;
REVOKE INSERT, UPDATE, REFERENCES ON public.color_analysis_staging  FROM anon;
REVOKE INSERT, UPDATE, REFERENCES ON public.xbz_gallery_staging     FROM anon;
REVOKE INSERT, UPDATE, REFERENCES ON public.scraper_images_staging  FROM anon;
REVOKE INSERT, UPDATE, REFERENCES ON public.sm_images_staging       FROM anon;
REVOKE INSERT, UPDATE, REFERENCES ON public._asia_api_staging       FROM anon;