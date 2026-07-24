-- supplier_id: proteger a bronze contra exclusao acidental de fornecedor
ALTER TABLE public.supplier_products_raw DROP CONSTRAINT supplier_products_raw_supplier_id_fkey;
ALTER TABLE public.supplier_products_raw
  ADD CONSTRAINT supplier_products_raw_supplier_id_fkey
  FOREIGN KEY (supplier_id) REFERENCES public.suppliers(id) ON DELETE RESTRICT;

-- product_id: vinculo derivado (silver/gold) -> bronze sobrevive
ALTER TABLE public.supplier_products_raw DROP CONSTRAINT supplier_products_raw_product_id_fkey;
ALTER TABLE public.supplier_products_raw
  ADD CONSTRAINT supplier_products_raw_product_id_fkey
  FOREIGN KEY (product_id) REFERENCES public.products(id) ON DELETE SET NULL;

-- variant_id: vinculo derivado -> bronze sobrevive
ALTER TABLE public.supplier_products_raw DROP CONSTRAINT supplier_products_raw_variant_id_fkey;
ALTER TABLE public.supplier_products_raw
  ADD CONSTRAINT supplier_products_raw_variant_id_fkey
  FOREIGN KEY (variant_id) REFERENCES public.product_variants(id) ON DELETE SET NULL;

-- import_batch_id: metadado de lote -> bronze sobrevive ao expurgo de lotes
ALTER TABLE public.supplier_products_raw DROP CONSTRAINT supplier_products_raw_import_batch_id_fkey;
ALTER TABLE public.supplier_products_raw
  ADD CONSTRAINT supplier_products_raw_import_batch_id_fkey
  FOREIGN KEY (import_batch_id) REFERENCES public.supplier_import_batches(id) ON DELETE SET NULL;