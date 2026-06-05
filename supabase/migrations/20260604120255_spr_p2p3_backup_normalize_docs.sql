
-- ============ BACKUP (reversibilidade total do backfill) ============
DROP TABLE IF EXISTS public.supplier_products_raw_bkp_20260604;
CREATE TABLE public.supplier_products_raw_bkp_20260604 AS
  SELECT * FROM public.supplier_products_raw;

-- ============ P2: trigger de normalização ============
-- raw_data = só payload do fornecedor; proveniência vai p/ colunas;
-- content_hash sempre consistente com o payload limpo.
-- NÃO mexe em status/processed/updated_at (já há triggers para isso).
CREATE OR REPLACE FUNCTION public.fn_spr_normalize() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE v_clean jsonb;
BEGIN
  IF NEW.raw_data ? '_source' AND COALESCE(NEW.source_channel,'') IN ('','n8n','legacy') THEN
    NEW.source_channel := NEW.raw_data->>'_source';
  END IF;
  IF NEW.raw_data ? '_imported_at' AND NEW.imported_at IS NULL THEN
    BEGIN NEW.imported_at := (NEW.raw_data->>'_imported_at')::timestamptz;
    EXCEPTION WHEN others THEN NULL; END;
  END IF;
  v_clean := NEW.raw_data - '_source' - '_api_fields_count' - '_imported_at';
  NEW.raw_data := v_clean;
  NEW.content_hash := md5(v_clean::text);
  RETURN NEW;
END;
$$;
-- 'aa' no nome garante execução antes dos demais triggers BEFORE
DROP TRIGGER IF EXISTS trg_aa_spr_normalize ON public.supplier_products_raw;
CREATE TRIGGER trg_aa_spr_normalize BEFORE INSERT OR UPDATE ON public.supplier_products_raw
FOR EACH ROW EXECUTE FUNCTION public.fn_spr_normalize();

-- ============ P3: integridade leve do payload ============
ALTER TABLE public.supplier_products_raw
  ADD CONSTRAINT chk_spr_raw_object CHECK (jsonb_typeof(raw_data) = 'object') NOT VALID;
ALTER TABLE public.supplier_products_raw VALIDATE CONSTRAINT chk_spr_raw_object;

-- ============ P3: documentação (grão + papéis das colunas) ============
COMMENT ON TABLE public.supplier_products_raw IS
  'Bronze/landing de ingestão. GRÃO: 1 linha = 1 variante/SKU do fornecedor; o produto-pai é derivado na intermediária (produtos_padronizacao via fn_derive_parent_ref). raw_data é payload imutável do fornecedor; proveniência/controle ficam em colunas próprias.';
COMMENT ON COLUMN public.supplier_products_raw.supplier_reference IS 'Identificador da VARIANTE no fornecedor (o pai é derivado na silver).';
COMMENT ON COLUMN public.supplier_products_raw.raw_data IS 'Payload original do fornecedor (imutável). NÃO gravar metadados de controle aqui — use source_channel/source_endpoint/imported_at. Trigger trg_aa_spr_normalize remove chaves _* legadas.';
COMMENT ON COLUMN public.supplier_products_raw.content_hash IS 'md5(raw_data limpo) — SSOT de dedup/detecção de mudança. Mantido por trg_aa_spr_normalize.';
COMMENT ON COLUMN public.supplier_products_raw.raw_hash IS 'DEPRECADO — legado, preenchido inconsistentemente (~1257 linhas). Usar content_hash.';
COMMENT ON COLUMN public.supplier_products_raw.processed IS 'DERIVADO de status (mantido por trg_zz_sync_raw_status). SSOT = status.';
COMMENT ON COLUMN public.supplier_products_raw.images_processed IS 'DERIVADO de images_status. SSOT = images_status.';
COMMENT ON COLUMN public.supplier_products_raw.process_errors IS 'Erros de processamento (entrada, escrita pelo worker).';
COMMENT ON COLUMN public.supplier_products_raw.last_error IS 'Espelho do último erro (derivado de process_errors por trg_zz_sync_raw_status).';
COMMENT ON COLUMN public.supplier_products_raw.source_channel IS 'Canal de ingestão (n8n|file_upload|manual|api_direct|bitrix|mysql_sync|legacy). Proveniência de 1a classe.';
COMMENT ON COLUMN public.supplier_products_raw.source_endpoint IS 'Endpoint/URL de origem da ingestão.';
