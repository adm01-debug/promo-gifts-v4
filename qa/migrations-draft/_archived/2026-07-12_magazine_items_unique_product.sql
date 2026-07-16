-- Migration draft — Magazine items UNIQUE (magazine_id, product_id)
-- Data: 2026-07-12
-- Alvo: BD Gold canônico doufsxqlfjyuvxuezpln
-- Origem: pedido do PO para impedir duplicação de produtos na mesma revista.
--
-- Contexto
-- --------
-- magazineService.addProducts() já filtra duplicatas no cliente (Set<productId>),
-- mas isso não protege contra:
--   • dois clientes gravando ao mesmo tempo (race);
--   • jobs em edge functions ou scripts admin que insiram fora do serviço;
--   • bugs futuros que removam o filtro cliente.
--
-- A constraint abaixo é a defesa final e é barata (index parcial cobre lookup
-- por magazine_id + product_id, que já é frequente).
--
-- Pré-checagem obrigatória (rodar ANTES do CREATE INDEX):
--   SELECT magazine_id, product_id, COUNT(*)
--   FROM magazine_items
--   WHERE deleted_at IS NULL
--   GROUP BY 1, 2
--   HAVING COUNT(*) > 1;
-- Se retornar linhas, dedup manual antes de aplicar (manter menor position).
--
-- Rollout
-- -------
-- 1. CREATE UNIQUE INDEX CONCURRENTLY (não bloqueia writes; requer fora de tx).
-- 2. Promover a constraint apontando para o índice.
-- 3. Verificar no painel Supabase Linter que não há warnings.

-- ============================================================================
-- Passo 1: index único concorrente (idempotente)
-- ============================================================================
CREATE UNIQUE INDEX CONCURRENTLY IF NOT EXISTS
  magazine_items_magazine_product_uniq
ON public.magazine_items (magazine_id, product_id);

-- ============================================================================
-- Passo 2: promover a constraint reaproveitando o índice
-- ============================================================================
ALTER TABLE public.magazine_items
  ADD CONSTRAINT magazine_items_magazine_product_key
  UNIQUE USING INDEX magazine_items_magazine_product_uniq;

-- ============================================================================
-- Rollback
-- ============================================================================
-- ALTER TABLE public.magazine_items
--   DROP CONSTRAINT IF EXISTS magazine_items_magazine_product_key;
-- DROP INDEX IF EXISTS public.magazine_items_magazine_product_uniq;
