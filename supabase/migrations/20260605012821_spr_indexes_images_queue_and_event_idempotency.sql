-- Worker de imagens: 11.641 linhas pending sem indice -> seq scan de 57MB a cada poll
CREATE INDEX IF NOT EXISTS idx_spr_images_pending
  ON public.supplier_products_raw (supplier_id, imported_at)
  WHERE images_status <> 'processed'::supplier_raw_status;

-- Idempotencia de ingestao por evento (vazio hoje pois source_event_id e 100% NULL;
-- protege contra reentrega/duplicacao quando o n8n passar a popular)
CREATE UNIQUE INDEX IF NOT EXISTS uq_spr_source_event
  ON public.supplier_products_raw (supplier_id, source_event_id)
  WHERE source_event_id IS NOT NULL;