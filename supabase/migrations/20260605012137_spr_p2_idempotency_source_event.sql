CREATE UNIQUE INDEX IF NOT EXISTS uq_spr_source_event
  ON public.supplier_products_raw (supplier_id, source_event_id)
  WHERE source_event_id IS NOT NULL;

COMMENT ON INDEX public.uq_spr_source_event IS
  'Idempotencia na origem: impede reprocessar o mesmo evento de ingestao (n8n execution/item id). Parcial pois source_event_id e nullable.';