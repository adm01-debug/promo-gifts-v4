-- Melhoria 5: DROP da coluna dimensions jsonb
-- PRÉ-REQUISITOS: v_products_public atualizada, 0 dependências
ALTER TABLE public.products DROP COLUMN IF EXISTS dimensions;