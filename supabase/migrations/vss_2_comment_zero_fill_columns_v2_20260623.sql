-- M2: COMMENTs nas colunas 0-registro de variant_supplier_sources
COMMENT ON COLUMN public.variant_supplier_sources.next_quantity_4 IS 'Restock slot 4. Hoje 0 registros. DROP requer refatoração coordenada.';
COMMENT ON COLUMN public.variant_supplier_sources.csosn IS 'CSOSN fiscal. Hoje 0 registros. DROP requer sprint fiscal.';
COMMENT ON TABLE public.variant_supplier_sources IS 'Fonte dados por variante x fornecedor. BACKLOG: cost_price_1..5+min_qty_1..5 → supplier_price_tiers; next_quantity/date_1..6 → variant_restock_schedule.';
