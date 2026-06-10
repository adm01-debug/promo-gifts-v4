-- P1: Invariantes da Gold viram constraint (não cron-curativo) + higiene de índices
-- + aposenta tabelas de de-para sem nenhuma referência em código (0 funções/0 views).

CREATE UNIQUE INDEX IF NOT EXISTS uq_products_supplier_ref
  ON public.products (supplier_id, supplier_reference)
  WHERE supplier_reference IS NOT NULL;

ALTER TABLE public.products
  ADD CONSTRAINT chk_products_active_has_identity
  CHECK (NOT (is_active AND sku IS NULL AND supplier_reference IS NULL)) NOT VALID;
ALTER TABLE public.products VALIDATE CONSTRAINT chk_products_active_has_identity;

CREATE INDEX IF NOT EXISTS idx_padvar_color_id_2
  ON public.produtos_padronizacao_variantes (color_id_2)
  WHERE color_id_2 IS NOT NULL;

ALTER TABLE public.product_videos DROP CONSTRAINT IF EXISTS uq_product_videos_product_cf;
DROP INDEX IF EXISTS public.sm_site_url_map_site_id_idx;

ALTER TABLE IF EXISTS public.attribute_equivalences        SET SCHEMA backup;
ALTER TABLE IF EXISTS public.supplier_technique_mappings   SET SCHEMA backup;
ALTER TABLE IF EXISTS public.de_para_site                  SET SCHEMA backup;

COMMENT ON TABLE backup.attribute_equivalences IS
  'Aposentada em 2026-06-10 (auditoria medallion): populada porém sem nenhuma referência em funções/views. Reativação requer integração explícita ao motor de-para.';
COMMENT ON TABLE backup.supplier_technique_mappings IS
  'Aposentada em 2026-06-10 (auditoria medallion): populada porém sem nenhuma referência em funções/views.';
COMMENT ON TABLE backup.de_para_site IS
  'Aposentada em 2026-06-10 (auditoria medallion): populada porém sem nenhuma referência em funções/views.';
