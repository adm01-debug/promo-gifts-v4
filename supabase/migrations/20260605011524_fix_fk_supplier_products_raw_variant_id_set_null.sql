
-- Corrigir FK: variant_id deve ser SET NULL ao deletar variante, não RESTRICT
ALTER TABLE supplier_products_raw
  DROP CONSTRAINT supplier_products_raw_variant_id_fkey;

ALTER TABLE supplier_products_raw
  ADD CONSTRAINT supplier_products_raw_variant_id_fkey
  FOREIGN KEY (variant_id) REFERENCES product_variants(id)
  ON DELETE SET NULL;
