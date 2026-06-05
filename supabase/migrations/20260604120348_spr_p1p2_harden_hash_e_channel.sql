
-- content_hash agora sempre presente (trigger garante) -> NOT NULL
ALTER TABLE public.supplier_products_raw ALTER COLUMN content_hash SET NOT NULL;

-- source_channel travado a valores válidos (proveniência de 1a classe)
ALTER TABLE public.supplier_products_raw
  ADD CONSTRAINT chk_spr_source_channel
  CHECK (source_channel IN ('n8n','file_upload','file_upload_retry','file_upload_fix','manual','api_direct','bitrix','mysql_sync','legacy'));
