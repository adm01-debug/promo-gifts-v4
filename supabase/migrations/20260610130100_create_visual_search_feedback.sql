-- Reconcilia visual_search_feedback com o que o código realmente insere
-- (src/pages/tools/VisualSearchPage.tsx → handleFeedback).
--
-- CONTEXTO: a tabela é criada por 20260526195752 com `search_terms TEXT` e
-- 20260526200904 adiciona `product_id UUID REFERENCES products(id)`. Porém o
-- código grava `search_terms` como JSON e `product_id` como id EXTERNO (texto,
-- produtos vivem no BD Promobrind, não em public.products) — incompatível com
-- aquele schema. No banco vivo a tabela nunca chegou a existir (drift pós-colapso
-- 2026-05-24), então aqui é seguro tanto CRIAR (live) quanto CORRIGIR (DB fresco
-- que já aplicou as migrações antigas). Tudo idempotente e guard-protegido.

-- 1) Garante a existência (cobre o banco vivo, onde a tabela não existia).
CREATE TABLE IF NOT EXISTS public.visual_search_feedback (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE SET NULL,
  image_url text,
  original_analysis jsonb,
  is_correct boolean,
  feedback_notes text,
  search_terms jsonb,
  product_id text,
  match_relevance numeric,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 2) Colunas que podem faltar quando a tabela veio das migrações antigas.
ALTER TABLE public.visual_search_feedback
  ADD COLUMN IF NOT EXISTS search_terms jsonb,
  ADD COLUMN IF NOT EXISTS product_id text,
  ADD COLUMN IF NOT EXISTS match_relevance numeric,
  ADD COLUMN IF NOT EXISTS image_url text,
  ADD COLUMN IF NOT EXISTS feedback_notes text;

-- 3) product_id: se veio como UUID com FK p/ products, dropar a FK e virar text
--    (ids de produto são externos; FK p/ public.products quebraria o insert).
DO $$
DECLARE
  fk_name text;
  col_type text;
BEGIN
  SELECT data_type INTO col_type FROM information_schema.columns
    WHERE table_schema='public' AND table_name='visual_search_feedback' AND column_name='product_id';
  IF col_type = 'uuid' THEN
    FOR fk_name IN
      SELECT tc.constraint_name FROM information_schema.table_constraints tc
      JOIN information_schema.key_column_usage kcu ON tc.constraint_name = kcu.constraint_name
      WHERE tc.table_schema='public' AND tc.table_name='visual_search_feedback'
        AND tc.constraint_type='FOREIGN KEY' AND kcu.column_name='product_id'
    LOOP
      EXECUTE format('ALTER TABLE public.visual_search_feedback DROP CONSTRAINT %I', fk_name);
    END LOOP;
    ALTER TABLE public.visual_search_feedback
      ALTER COLUMN product_id TYPE text USING product_id::text;
  END IF;
END $$;

-- 4) search_terms: TEXT → jsonb (o código grava JSON). Seguro: tabela vazia em DB
--    fresco; no banco vivo já é jsonb (guard pula).
DO $$
DECLARE
  col_type text;
BEGIN
  SELECT data_type INTO col_type FROM information_schema.columns
    WHERE table_schema='public' AND table_name='visual_search_feedback' AND column_name='search_terms';
  IF col_type = 'text' THEN
    -- PARSEIA o texto como JSON (search_terms::jsonb), não serializa: to_jsonb()
    -- envolveria a string num JSON string ("[\"foo\"]"), destoando do contrato.
    -- Seguro: no banco vivo já é jsonb (guard acima pula) e em DB fresco a tabela
    -- está vazia, então não há linha a converter.
    ALTER TABLE public.visual_search_feedback
      ALTER COLUMN search_terms TYPE jsonb
      USING (
        CASE
          WHEN search_terms IS NULL OR btrim(search_terms) = '' THEN NULL
          ELSE search_terms::jsonb
        END
      );
  END IF;
END $$;

-- 5) RLS + políticas (idempotentes). Insert exige dono = auth.uid() (sem linhas
--    órfãs); select restrito a dono ou admin.
ALTER TABLE public.visual_search_feedback ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS vsf_insert_authenticated ON public.visual_search_feedback;
CREATE POLICY vsf_insert_authenticated ON public.visual_search_feedback
  FOR INSERT TO authenticated
  WITH CHECK (user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS vsf_select_own_or_admin ON public.visual_search_feedback;
CREATE POLICY vsf_select_own_or_admin ON public.visual_search_feedback
  FOR SELECT USING (((SELECT auth.uid()) = user_id) OR is_admin_or_above((SELECT auth.uid())));

CREATE INDEX IF NOT EXISTS idx_vsf_created_at ON public.visual_search_feedback(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_vsf_product_id ON public.visual_search_feedback(product_id);
-- user_id é filtrado pela policy vsf_select_own_or_admin → índice evita full-scan.
CREATE INDEX IF NOT EXISTS idx_vsf_user_id ON public.visual_search_feedback(user_id);
