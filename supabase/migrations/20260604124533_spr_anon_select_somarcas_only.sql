-- Permite que a anon key leia SOMENTE os produtos do fornecedor Só Marcas.
-- Não expõe dados de outros fornecedores. Catálogo Só Marcas é dado de revenda (não sensível).
DROP POLICY IF EXISTS spr_select_anon_somarcas ON public.supplier_products_raw;
CREATE POLICY spr_select_anon_somarcas
  ON public.supplier_products_raw
  FOR SELECT
  TO anon
  USING (supplier_id = '841cd690-210a-422a-908c-7676828db272'::uuid);