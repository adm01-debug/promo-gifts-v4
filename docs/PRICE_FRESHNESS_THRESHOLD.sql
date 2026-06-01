-- =============================================================================
-- Validade do Preço (price_freshness_threshold_days) — coluna na tabela products
-- =============================================================================
-- Executar UMA VEZ no BD externo canônico (Gestão de Produtos — projeto
-- doufsxqlfjyuvxuezpln), via SQL editor do Supabase.
--
-- Após rodar:
--   * Cadastro/edição de produto passa a permitir escolher 30/60/90 dias.
--   * PDP, Quick View, Sticky, Cards e Quote leem o valor direto da tabela.
--   * Default 60 dias quando não informado.
-- =============================================================================

ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS price_freshness_threshold_days integer DEFAULT 60;

-- Garante que valores fora do permitido não entrem (mantém UX simples).
ALTER TABLE public.products
  DROP CONSTRAINT IF EXISTS products_price_freshness_threshold_days_check;

ALTER TABLE public.products
  ADD CONSTRAINT products_price_freshness_threshold_days_check
  CHECK (price_freshness_threshold_days IS NULL
         OR price_freshness_threshold_days BETWEEN 1 AND 365);

-- Preenche produtos antigos com o default explícito (opcional).
UPDATE public.products
   SET price_freshness_threshold_days = 60
 WHERE price_freshness_threshold_days IS NULL;

COMMENT ON COLUMN public.products.price_freshness_threshold_days IS
  'Janela em dias após a qual o sistema avisa que o preço pode estar defasado. Configurado no cadastro do produto (30/60/90). Default 60.';
