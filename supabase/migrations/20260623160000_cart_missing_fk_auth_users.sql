-- BUG-16 FIX: seller_carts e cart_templates não tinham FK para auth.users(id).
--
-- CAUSA RAIZ: A tabela seller_carts foi criada pela migration 20260214152115 sem FK.
-- A migration 20260304014416 tentou recriar com FK usando "CREATE TABLE IF NOT EXISTS"
-- — que é um no-op quando a tabela já existe. A FK nunca foi aplicada.
--
-- IMPACTO:
--   1. deleteUser() em auth.admin NÃO cascateava para seller_carts (dados órfãos)
--   2. seller_id e user_id podiam referenciar usuários inexistentes (sem integridade referencial)
--   3. Funções de teste (test-cart-limit, test-cart-concurrency, test-cart-rls) que
--      usam auth.admin.deleteUser() como cleanup deixavam registros órfãos no banco
--
-- VERIFICADO: 0 seller_carts/cart_templates com seller_id/user_id inválidos antes
-- de aplicar as constraints — seguro adicionar sem violação de integridade.

ALTER TABLE public.seller_carts
  ADD CONSTRAINT IF NOT EXISTS seller_carts_seller_id_fkey
  FOREIGN KEY (seller_id) REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE public.cart_templates
  ADD CONSTRAINT IF NOT EXISTS cart_templates_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
