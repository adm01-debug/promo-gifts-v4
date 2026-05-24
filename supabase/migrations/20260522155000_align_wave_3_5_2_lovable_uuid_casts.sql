-- ============================================================================
-- Migration (LOVABLE-ONLY, documentação): align_wave_3_5_2_lovable_uuid_casts
-- Date: 2026-05-22 15:50 UTC
-- Phase: Redeploy Fase 3.5 - Wave 2 (Integridade FK)
-- Applied via: lovable_db_query (PROJECT pqpdolkaeqlyzpdpbizo)
-- ============================================================================
-- IMPORTANTE: este arquivo NÃO é executado via `supabase db push`. Decision 010
-- proíbe push contra o oficial. Este SQL foi aplicado diretamente no banco
-- Lovable Cloud interno (pqpdolkaeqlyzpdpbizo) via MCP, e serve aqui como
-- histórico/auditoria.
-- ============================================================================
-- Objetivo: alinhar tipos de FK (text → uuid) nas tabelas de favoritos no
-- Lovable, espelhando o tipo correto que já vigia no Oficial.
-- Pré-checks: favorite_items=0 rows, favorite_lists=1 row (client_id válido).
-- ============================================================================

BEGIN;

-- 1) Drop índices que dependem do tipo atual
DROP INDEX IF EXISTS public.idx_favorite_items_product;
DROP INDEX IF EXISTS public.idx_favorite_items_unique;

-- 2) Cast text → uuid (NULLIF protege string vazia)
ALTER TABLE public.favorite_items
  ALTER COLUMN product_id TYPE uuid USING NULLIF(product_id, '')::uuid;
ALTER TABLE public.favorite_items
  ALTER COLUMN variant_id TYPE uuid USING NULLIF(variant_id, '')::uuid;
ALTER TABLE public.favorite_lists
  ALTER COLUMN client_id  TYPE uuid USING NULLIF(client_id,  '')::uuid;

-- 3) Recriar índices com tipo uuid
CREATE INDEX idx_favorite_items_product
  ON public.favorite_items USING btree (product_id);

CREATE UNIQUE INDEX idx_favorite_items_unique
  ON public.favorite_items USING btree (
    list_id,
    product_id,
    COALESCE(variant_id, '00000000-0000-0000-0000-000000000000'::uuid)
  );

COMMIT;

-- Pós-validação: data_type = 'uuid' em todas as 3 colunas ✓
