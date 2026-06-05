CREATE TRIGGER trg_supplier_price_tiers_updated_at
  BEFORE UPDATE ON public.supplier_price_tiers
  FOR EACH ROW EXECUTE FUNCTION moddatetime('updated_at');

CREATE TRIGGER trg_product_physical_updated_at
  BEFORE UPDATE ON public.product_physical
  FOR EACH ROW EXECUTE FUNCTION moddatetime('updated_at');