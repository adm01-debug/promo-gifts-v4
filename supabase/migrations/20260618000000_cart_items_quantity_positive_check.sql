-- Integridade do módulo Carrinhos: garante quantity >= 1 em seller_cart_items.
--
-- Contexto: a UI (SortableCartItem / tabela) e o hook useSellerCarts já clampam
-- quantidade para >= 1, mas o banco precisa ser a última linha de defesa contra
-- qualquer caminho que escape a UI (RPC futura, importação em massa, restore,
-- bug de regressão). Sem este CHECK, uma quantidade 0/negativa produziria
-- subtotais zerados/negativos silenciosos no carrinho e no orçamento gerado.
--
-- Idempotente: clampa linhas legadas inválidas antes de aplicar e só adiciona o
-- CHECK se ele ainda não existir.

-- 1) Sanea linhas legadas eventualmente <= 0 (clamp para 1, preserva o item)
UPDATE public.seller_cart_items
SET quantity = 1
WHERE quantity IS NULL OR quantity < 1;

-- 2) Adiciona o CHECK apenas se ainda não existir
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.seller_cart_items'::regclass
      AND conname = 'seller_cart_items_quantity_positive'
  ) THEN
    ALTER TABLE public.seller_cart_items
      ADD CONSTRAINT seller_cart_items_quantity_positive CHECK (quantity >= 1);
  END IF;
END $$;
