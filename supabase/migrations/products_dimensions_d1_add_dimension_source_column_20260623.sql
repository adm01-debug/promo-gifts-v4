-- Melhoria D: Adicionar coluna dimensions_source + backfill de unit_detected
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS dimensions_source varchar(20) CHECK (dimensions_source IS NULL OR dimensions_source IN ('cm','mm','estimated','manual','supplier'));
COMMENT ON COLUMN public.products.dimensions_source IS 'Origem/unidade das dimensões. Migrado de dimensions->unit_detected em 2026-06-23.';
SELECT set_config('app.write_source','pipeline',true);
UPDATE public.products SET dimensions_source = (dimensions->>'unit_detected') WHERE dimensions IS NOT NULL AND dimensions->>'unit_detected' IS NOT NULL AND dimensions_source IS NULL;
SELECT set_config('app.write_source','ui',true);
CREATE INDEX IF NOT EXISTS idx_products_dimensions_source ON public.products(dimensions_source) WHERE dimensions_source IS NOT NULL;