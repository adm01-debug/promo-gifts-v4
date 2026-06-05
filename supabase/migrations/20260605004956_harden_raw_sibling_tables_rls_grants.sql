-- Replica o endurecimento P4 de supplier_products_raw nas tabelas raw/staging irmãs.
-- (As irmãs NÃO têm o anti-pattern de estado duplo: já usam `status` único, sem
--  `processed`/`raw_hash`, e estão vazias — então o cutover pesado não se aplica.
--  O que se aplica é a correção de segurança de grants/RLS.)

-- 1) supplier_products_raw_history: estava com RLS DESLIGADO e `anon` com
--    INSERT/SELECT/UPDATE/DELETE/TRUNCATE/REFERENCES (rls_disabled_in_public) —
--    anon podia ler/apagar/truncar todo o histórico de payloads via API.
--    É escrita apenas pelo trigger fn_spr_history, cuja sessão (service_role/owner
--    via SECURITY DEFINER) ignora RLS. Liga RLS + policies + remove o anon.
ALTER TABLE public.supplier_products_raw_history ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.supplier_products_raw_history FROM anon;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES ON public.supplier_products_raw_history FROM authenticated;

DROP POLICY IF EXISTS hist_all_service ON public.supplier_products_raw_history;
CREATE POLICY hist_all_service ON public.supplier_products_raw_history
  FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS hist_select_admin ON public.supplier_products_raw_history;
CREATE POLICY hist_select_admin ON public.supplier_products_raw_history
  FOR SELECT TO authenticated USING (is_admin_or_above((SELECT auth.uid())));

-- 2) Staging irmãs: remove o GRANT latente de escrita do anon (RLS já gate; anon
--    nunca escreve staging interno). authenticated mantido p/ não quebrar tooling admin.
REVOKE INSERT, UPDATE, REFERENCES ON public.import_staging_images   FROM anon;
REVOKE INSERT, UPDATE, REFERENCES ON public.color_analysis_staging  FROM anon;
REVOKE INSERT, UPDATE, REFERENCES ON public.xbz_gallery_staging     FROM anon;
REVOKE INSERT, UPDATE, REFERENCES ON public.scraper_images_staging  FROM anon;
REVOKE INSERT, UPDATE, REFERENCES ON public.sm_images_staging       FROM anon;
REVOKE INSERT, UPDATE, REFERENCES ON public._asia_api_staging       FROM anon;
