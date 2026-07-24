-- Adiciona circumference_cm à tabela Gold (products).
-- Campo já existe em produtos_site_padronizacao e produtos_padronizacao (Silver/Bronze)
-- mas nunca foi promovido para a camada Gold, impedindo a exibição no frontend.
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS circumference_cm numeric NULL;

COMMENT ON COLUMN public.products.circumference_cm IS
  'Circunferência do produto em centímetros. Promovido de produtos_site_padronizacao.circumference_cm.';
