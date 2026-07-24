-- Integridade do módulo Carrinhos: completa o invariante de quantidade em
-- seller_cart_items para 1 <= quantity <= 999999.
--
-- Contexto: a migration 20260618000000 adicionou o piso (quantity >= 1), mas
-- não havia TETO no banco. O hook useSellerCarts clampa a edição direta em
-- 999999, porém os caminhos de MESCLAGEM (add/move/duplicate) somavam
-- `existing + qty`. Sem teto no banco, somas repetidas poderiam crescer sem
-- limite e, no extremo, estourar o range de int4 — produzindo subtotais
-- absurdos no carrinho e no orçamento gerado. O cliente passou a clampar o
-- teto; este CHECK é a última linha de defesa para qualquer caminho que escape
-- à UI (RPC futura, importação em massa, restore, regressão).
--
-- Idempotente: clampa linhas legadas > 999999 antes de aplicar e só adiciona o
-- CHECK se ele ainda não existir. Mantido como constraint separada do piso para
-- não precisar derrubar/recriar a constraint já existente.

-- 1) Sanea linhas legadas eventualmente acima do teto (clamp para 999999)
--    LOCK elimina a janela de corrida: sem ele um INSERT/UPDATE concorrente
--    poderia escrever quantity > 999999 entre o UPDATE abaixo e o ADD CONSTRAINT.
LOCK TABLE public.seller_cart_items IN SHARE ROW EXCLUSIVE MODE;

UPDATE public.seller_cart_items
SET quantity = 999999
WHERE quantity > 999999;

-- 2) Adiciona o CHECK de teto apenas se ainda não existir
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.seller_cart_items'::regclass
      AND conname = 'seller_cart_items_quantity_max'
  ) THEN
    ALTER TABLE public.seller_cart_items
      ADD CONSTRAINT seller_cart_items_quantity_max CHECK (quantity <= 999999);
  END IF;
END $$;
