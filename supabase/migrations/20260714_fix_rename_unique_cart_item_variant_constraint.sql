-- ============================================================
-- BUG FIX CRÍTICO: ON CONFLICT ON CONSTRAINT unique_cart_item_variant
-- Detectado na auditoria exaustiva pós-deploy de restore_seller_cart.
--
-- PROBLEMA:
--   A RPC restore_seller_cart usa:
--     ON CONFLICT ON CONSTRAINT unique_cart_item_variant DO NOTHING
--
--   Mas o único índice existente se chamava 'seller_cart_items_uniq_item'
--   e foi criado com CREATE UNIQUE INDEX (não com ADD CONSTRAINT).
--
--   Em PostgreSQL, ON CONFLICT ON CONSTRAINT funciona SOMENTE com
--   named constraints (pg_constraint), não com standalone unique indexes.
--   Resultado: erro em runtime "constraint does not exist".
--
-- FIX:
--   1. Verifica ausência de duplicatas (segurança)
--   2. DROP do unique index existente
--   3. ADD CONSTRAINT UNIQUE NULLS NOT DISTINCT com nome correto
--
-- COMPORTAMENTO PRESERVADO: NULLS NOT DISTINCT idêntico ao índice anterior.
-- ============================================================

-- Pré-condição: sem duplicatas
DO $$
DECLARE cnt int;
BEGIN
  SELECT COUNT(*) INTO cnt FROM (
    SELECT cart_id, product_id, COALESCE(color_name,'__NULL__')
    FROM public.seller_cart_items
    GROUP BY cart_id, product_id, COALESCE(color_name,'__NULL__')
    HAVING COUNT(*) > 1
  ) t;
  IF cnt > 0 THEN
    RAISE EXCEPTION 'Existem % linhas duplicadas — abortar!', cnt;
  END IF;
END;
$$;

DROP INDEX IF EXISTS public.seller_cart_items_uniq_item;

ALTER TABLE public.seller_cart_items
  ADD CONSTRAINT unique_cart_item_variant
  UNIQUE NULLS NOT DISTINCT (cart_id, product_id, color_name);

-- Guard pós-migration
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'unique_cart_item_variant'
      AND conrelid = 'public.seller_cart_items'::regclass
  ) THEN
    RAISE EXCEPTION 'unique_cart_item_variant NAO foi criada!';
  END IF;
  RAISE NOTICE 'OK: unique_cart_item_variant criada como named constraint com NULLS NOT DISTINCT';
END;
$$;
