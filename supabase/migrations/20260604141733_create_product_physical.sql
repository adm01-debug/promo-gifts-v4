CREATE TABLE public.product_physical (
  id                 uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  product_id         uuid NOT NULL UNIQUE REFERENCES public.products(id) ON DELETE CASCADE,
  length_cm          numeric(10,2),
  width_cm           numeric(10,2),
  height_cm          numeric(10,2),
  diameter_cm        numeric(10,2),
  weight_g           numeric(12,2),
  capacity_ml        numeric(12,2),
  shape_type         text,
  internal_length_cm numeric(10,2),
  internal_width_cm  numeric(10,2),
  internal_height_cm numeric(10,2),
  box_length_cm      numeric(10,2),
  box_width_cm       numeric(10,2),
  box_height_cm      numeric(10,2),
  box_weight_kg      numeric(12,3),
  box_volume_cm3     numeric(14,2),
  box_quantity       integer,
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.product_physical IS 'Dimensoes fisicas do produto e da CAIXA MASTER (box_*). Satelite 1:1 de products (roadmap Sprint 2). A caixa master da So Marcas (dimensoes/qtd/peso, hoje so no HTML do portal) materializa-se aqui.';
COMMENT ON COLUMN public.product_physical.box_quantity IS 'Quantidade de produtos por caixa master.';
COMMENT ON COLUMN public.product_physical.box_weight_kg IS 'Peso total da caixa master com os produtos.';

ALTER TABLE public.product_physical ENABLE ROW LEVEL SECURITY;
CREATE POLICY product_physical_select  ON public.product_physical FOR SELECT TO authenticated USING (true);
CREATE POLICY product_physical_ins     ON public.product_physical FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY product_physical_upd     ON public.product_physical FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY product_physical_del     ON public.product_physical FOR DELETE TO authenticated USING (true);
CREATE POLICY product_physical_service ON public.product_physical FOR ALL TO service_role USING (true) WITH CHECK (true);