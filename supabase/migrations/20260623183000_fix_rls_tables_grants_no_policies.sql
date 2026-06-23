-- APLICADO 2026-06-23 | Melhoria 1/7: Fix RLS tabelas com grants mas sem policies
-- spot_health_log, spot_typecode_map, xbz_upload_mapping, produtos_site_padronizacao
CREATE POLICY spot_health_log_auth_read ON public.spot_health_log FOR SELECT TO authenticated USING (true);
CREATE POLICY spot_typecode_map_read ON public.spot_typecode_map FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY xbz_upload_mapping_auth_read ON public.xbz_upload_mapping FOR SELECT TO authenticated USING (true);
CREATE POLICY produtos_site_padronizacao_auth_read ON public.produtos_site_padronizacao FOR SELECT TO authenticated USING (true);
NOTIFY pgrst, 'reload schema';
