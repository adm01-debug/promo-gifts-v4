-- APLICADO: 2026-06-21
-- Fix: adiciona colunas geradas next_entry_date e next_entry_quantity
-- que o frontend requisitava mas não existiam em product_variants
-- Resolve: HTTP 400 em /rest/v1/product_variants (todas as requisições do grid)

ALTER TABLE public.product_variants
  ADD COLUMN IF NOT EXISTS next_entry_date    date
    GENERATED ALWAYS AS (next_date_1) STORED,
  ADD COLUMN IF NOT EXISTS next_entry_quantity integer
    GENERATED ALWAYS AS (next_quantity_1) STORED;

CREATE INDEX IF NOT EXISTS idx_pv_next_entry_date_nonnull
  ON public.product_variants (next_entry_date)
  WHERE next_entry_date IS NOT NULL;

COMMENT ON COLUMN public.product_variants.next_entry_date IS
  'Alias gerado de next_date_1 (primeira data de entrada prevista). Somente leitura — GENERATED STORED.';

COMMENT ON COLUMN public.product_variants.next_entry_quantity IS
  'Alias gerado de next_quantity_1 (quantidade da primeira entrada prevista). Somente leitura — GENERATED STORED.';

NOTIFY pgrst, 'reload schema';
