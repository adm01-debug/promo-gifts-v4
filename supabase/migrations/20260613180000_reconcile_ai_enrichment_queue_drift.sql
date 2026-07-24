-- ============================================================================
-- Reconciliacao de drift de schema (audit 200-commits, P0-2) — 2026-06-13
-- ----------------------------------------------------------------------------
-- A tabela public.ai_enrichment_queue (fila ATIVA de enriquecimento por IA, com
-- ~7,1k linhas em prod) e a view public.vw_ai_enrichment_status EXISTEM no banco
-- canonico (doufsxqlfjyuvxuezpln) porem NAO possuiam migration correspondente no
-- repositorio — drift detectado na auditoria dos ultimos 200 commits.
--
-- Esta migration RECONCILIA o repo com o estado vivo. E 100% IDEMPOTENTE
-- (IF NOT EXISTS / DO-guard / CREATE OR REPLACE / DROP POLICY IF EXISTS):
-- aplicar em producao e NO-OP; o objetivo e que um rebuild limpo a partir das
-- migrations recrie estes objetos IDENTICOS ao que ja roda em prod.
--
-- DDL extraido do catalogo vivo (pg_get_constraintdef / pg_indexes / pg_policies
-- / pg_get_viewdef) em 2026-06-13. Sem alteracao de seguranca: reproduz a unica
-- policy (SELECT org-scoped p/ authenticated) e o acesso de escrita via
-- service_role (que bypassa RLS) exatamente como estao no banco.
-- ============================================================================

-- 1) Tabela --------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.ai_enrichment_queue (
  id               uuid        NOT NULL DEFAULT gen_random_uuid(),
  product_id       uuid        NOT NULL,
  enrichment_type  text        NOT NULL,
  status           text        NOT NULL DEFAULT 'pending'::text,
  priority         integer              DEFAULT 5,
  attempts         integer              DEFAULT 0,
  max_attempts     integer              DEFAULT 3,
  last_error       text,
  last_attempt_at  timestamptz,
  created_at       timestamptz          DEFAULT now(),
  updated_at       timestamptz          DEFAULT now(),
  completed_at     timestamptz,
  locked_at        timestamptz,
  locked_by        text,
  organization_id  uuid                 DEFAULT '5db5aee1-064b-4ef4-9193-345dcd8274ea'::uuid
);

-- 2) Constraints (idempotentes) ------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='ai_enrichment_queue_pkey' AND conrelid='public.ai_enrichment_queue'::regclass) THEN
    ALTER TABLE public.ai_enrichment_queue ADD CONSTRAINT ai_enrichment_queue_pkey PRIMARY KEY (id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='ai_enrichment_queue_product_id_fkey' AND conrelid='public.ai_enrichment_queue'::regclass) THEN
    ALTER TABLE public.ai_enrichment_queue ADD CONSTRAINT ai_enrichment_queue_product_id_fkey
      FOREIGN KEY (product_id) REFERENCES public.products(id) ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='chk_enrichment_type' AND conrelid='public.ai_enrichment_queue'::regclass) THEN
    ALTER TABLE public.ai_enrichment_queue ADD CONSTRAINT chk_enrichment_type
      CHECK (enrichment_type = ANY (ARRAY['ai_title'::text,'ai_summary'::text,'schema_json'::text,'all'::text]));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='chk_status' AND conrelid='public.ai_enrichment_queue'::regclass) THEN
    ALTER TABLE public.ai_enrichment_queue ADD CONSTRAINT chk_status
      CHECK (status = ANY (ARRAY['pending'::text,'processing'::text,'done'::text,'error'::text,'skipped'::text]));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='uq_product_enrichment_type' AND conrelid='public.ai_enrichment_queue'::regclass) THEN
    ALTER TABLE public.ai_enrichment_queue ADD CONSTRAINT uq_product_enrichment_type UNIQUE (product_id, enrichment_type);
  END IF;
END $$;

-- 3) Indexes (os 2 unique acima ja criam seus indices; aqui so os demais) ------
CREATE INDEX IF NOT EXISTS idx_ai_queue_pending    ON public.ai_enrichment_queue USING btree (priority, created_at) WHERE (status = 'pending'::text);
CREATE INDEX IF NOT EXISTS idx_ai_queue_product_id ON public.ai_enrichment_queue USING btree (product_id);
CREATE INDEX IF NOT EXISTS idx_ai_queue_status     ON public.ai_enrichment_queue USING btree (status, updated_at);

-- 4) RLS + policy (reproduz exatamente o estado vivo) --------------------------
ALTER TABLE public.ai_enrichment_queue ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS authenticated_read_own_org_queue ON public.ai_enrichment_queue;
CREATE POLICY authenticated_read_own_org_queue
  ON public.ai_enrichment_queue
  FOR SELECT
  TO authenticated
  USING (organization_id = '5db5aee1-064b-4ef4-9193-345dcd8274ea'::uuid);

-- 5) Grants (writer = service_role, bypassa RLS) -------------------------------
GRANT ALL ON public.ai_enrichment_queue TO service_role;

-- 6) View de monitoramento (depende de ai_enrichment_queue + products.ai_*) ----
CREATE OR REPLACE VIEW public.vw_ai_enrichment_status AS
 WITH queue_stats AS (
         SELECT ai_enrichment_queue.enrichment_type,
            count(*) FILTER (WHERE ai_enrichment_queue.status = 'pending'::text) AS pending,
            count(*) FILTER (WHERE ai_enrichment_queue.status = 'processing'::text) AS processing,
            count(*) FILTER (WHERE ai_enrichment_queue.status = 'done'::text) AS done,
            count(*) FILTER (WHERE ai_enrichment_queue.status = 'error'::text) AS errors,
            count(*) FILTER (WHERE ai_enrichment_queue.status = 'skipped'::text) AS skipped,
            count(*) AS total,
            max(ai_enrichment_queue.completed_at) AS last_completed_at
           FROM ai_enrichment_queue
          GROUP BY ai_enrichment_queue.enrichment_type
        ), product_coverage AS (
         SELECT count(*) FILTER (WHERE products.ai_title IS NOT NULL AND length(TRIM(BOTH FROM products.ai_title)) > 0) AS has_ai_title,
            count(*) FILTER (WHERE products.ai_summary IS NOT NULL AND length(TRIM(BOTH FROM products.ai_summary)) > 0) AS has_ai_summary,
            count(*) FILTER (WHERE products.schema_json IS NOT NULL) AS has_schema_json,
            count(*) AS total
           FROM products
          WHERE products.is_active = true AND products.is_deleted = false
        )
 SELECT q.enrichment_type,
    q.pending,
    q.processing,
    q.done,
    q.errors,
    q.total AS total_queued,
    q.last_completed_at,
        CASE q.enrichment_type
            WHEN 'ai_title'::text THEN pc.has_ai_title
            WHEN 'ai_summary'::text THEN pc.has_ai_summary
            WHEN 'schema_json'::text THEN pc.has_schema_json
            ELSE NULL::bigint
        END AS products_with_field,
    pc.total AS total_products,
    round(
        CASE q.enrichment_type
            WHEN 'ai_title'::text THEN pc.has_ai_title::numeric * 100.0 / NULLIF(pc.total, 0)::numeric
            WHEN 'ai_summary'::text THEN pc.has_ai_summary::numeric * 100.0 / NULLIF(pc.total, 0)::numeric
            WHEN 'schema_json'::text THEN pc.has_schema_json::numeric * 100.0 / NULLIF(pc.total, 0)::numeric
            ELSE NULL::numeric
        END, 1) AS pct_coverage
   FROM queue_stats q
     CROSS JOIN product_coverage pc
  ORDER BY q.enrichment_type;
