-- Remove possíveis duplicatas antes de aplicar a restrição (mantém a de maior quantidade)
WITH duplicates AS (
  SELECT id,
         ROW_NUMBER() OVER (
           PARTITION BY cart_id, product_id, color_name 
           ORDER BY quantity DESC, updated_at DESC
         ) as rank
  FROM public.seller_cart_items
)
DELETE FROM public.seller_cart_items
WHERE id IN (SELECT id FROM duplicates WHERE rank > 1);

-- Adiciona índice de unicidade robusto
ALTER TABLE public.seller_cart_items 
ADD CONSTRAINT unique_cart_item_variant 
UNIQUE NULLS NOT DISTINCT (cart_id, product_id, color_name);

-- Garante que o service_role tenha acesso total para auditorias
GRANT ALL ON public.seller_carts TO service_role;
GRANT ALL ON public.seller_cart_items TO service_role;
