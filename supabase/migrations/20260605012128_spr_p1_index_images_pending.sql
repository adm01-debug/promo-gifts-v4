CREATE INDEX IF NOT EXISTS idx_spr_images_pending
  ON public.supplier_products_raw (supplier_id, imported_at)
  WHERE images_status <> 'processed'::supplier_raw_status;

COMMENT ON INDEX public.idx_spr_images_pending IS
  'Fila do worker de imagens. Espelha idx_spr_unprocessed mas para images_status.';