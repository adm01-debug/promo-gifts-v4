CREATE TABLE public.supplier_price_tiers (
  id                   uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  variant_supplier_id  uuid NOT NULL REFERENCES public.variant_supplier_sources(id) ON DELETE CASCADE,
  tier_order           smallint NOT NULL,
  min_qty              integer NOT NULL,
  cost_price           numeric(12,4) NOT NULL,
  valid_from           timestamptz,
  valid_to             timestamptz,
  created_at           timestamptz NOT NULL DEFAULT now(),
  updated_at           timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT supplier_price_tiers_uq UNIQUE (variant_supplier_id, tier_order)
);

COMMENT ON TABLE public.supplier_price_tiers IS 'Faixas de preco por quantidade por variante-fornecedor. Substitui cost_price_1..5/min_qty_1..5 de variant_supplier_sources (roadmap Sprint 3). cost_price = custo base do fornecedor, sem impostos; impostos via product_fiscal.ipi_rate; gravacao e componente a parte.';
COMMENT ON COLUMN public.supplier_price_tiers.tier_order IS 'Ordem da faixa, 1..N (1 = menor quantidade).';
COMMENT ON COLUMN public.supplier_price_tiers.min_qty IS 'Quantidade minima que ativa a faixa.';

ALTER TABLE public.supplier_price_tiers ENABLE ROW LEVEL SECURITY;
CREATE POLICY supplier_price_tiers_select  ON public.supplier_price_tiers FOR SELECT TO authenticated USING (true);
CREATE POLICY supplier_price_tiers_ins     ON public.supplier_price_tiers FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY supplier_price_tiers_upd     ON public.supplier_price_tiers FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY supplier_price_tiers_del     ON public.supplier_price_tiers FOR DELETE TO authenticated USING (true);
CREATE POLICY supplier_price_tiers_service ON public.supplier_price_tiers FOR ALL TO service_role USING (true) WITH CHECK (true);