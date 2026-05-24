-- ============================================================================
-- Migration (LOVABLE-ONLY, documentação): align_wave_3_5_4_lovable_order_items
-- Date: 2026-05-22 15:55 UTC
-- Phase: Redeploy Fase 3.5 - Wave 4 (caso grave - order_items)
-- Applied via: lovable_db_query (PROJECT pqpdolkaeqlyzpdpbizo)
-- ============================================================================
-- IMPORTANTE: arquivo doc-only. Decision 010 proíbe push contra oficial.
-- Aplicado diretamente no Lovable Cloud interno.
-- ============================================================================
-- Objetivo: order_items no Lovable estava com schema legado de "kit consumidor",
-- enquanto oficial tem schema B2B (orçamento → produção → desconto). Como 0 rows,
-- foi possível refatorar destrutivamente sem perda de dados.
-- ============================================================================

BEGIN;

-- 1) Drop índices dependentes
DROP INDEX IF EXISTS public.idx_order_items_organization_id;
DROP INDEX IF EXISTS public.idx_order_items_product_id;

-- 2) DROP 9 colunas legacy (kit/consumidor)
ALTER TABLE public.order_items
  DROP COLUMN IF EXISTS color_hex,
  DROP COLUMN IF EXISTS color_name,
  DROP COLUMN IF EXISTS gender,
  DROP COLUMN IF EXISTS kit_group_id,
  DROP COLUMN IF EXISTS kit_name,
  DROP COLUMN IF EXISTS notes,
  DROP COLUMN IF EXISTS organization_id,
  DROP COLUMN IF EXISTS size_code,
  DROP COLUMN IF EXISTS total_price;

-- 3) Cast product_id text → uuid
ALTER TABLE public.order_items
  ALTER COLUMN product_id TYPE uuid USING NULLIF(product_id, '')::uuid;

-- 4) ADD 9 colunas do oficial (B2B)
ALTER TABLE public.order_items
  ADD COLUMN IF NOT EXISTS discount_amount        numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS personalization_config jsonb,
  ADD COLUMN IF NOT EXISTS personalization_cost   numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS product_description    text,
  ADD COLUMN IF NOT EXISTS production_notes       text,
  ADD COLUMN IF NOT EXISTS production_status      text DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS quote_item_id          uuid,
  ADD COLUMN IF NOT EXISTS subtotal               numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS updated_at             timestamp with time zone DEFAULT now();

-- 5) Recriar índice product_id (agora uuid)
CREATE INDEX idx_order_items_product_id
  ON public.order_items USING btree (product_id);

-- 6) Trigger updated_at
CREATE OR REPLACE FUNCTION public.tg_order_items_set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

DROP TRIGGER IF EXISTS set_updated_at ON public.order_items;
CREATE TRIGGER set_updated_at
  BEFORE UPDATE ON public.order_items
  FOR EACH ROW EXECUTE FUNCTION public.tg_order_items_set_updated_at();

COMMIT;

-- Pós-validação: signature de order_items 100% idêntica entre Lovable e Oficial.
