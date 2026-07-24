-- MEDALLION — Fase 8 / Item 3: Categorias integradas ao pipeline (fill-only).
-- Problema: o pipeline novo (Bronze→Silver→Gold) não atribuía category_id; o legado
-- fn_*_to_silver (deprecado) fazia isso. Produtos novos ficariam sem categoria.
-- Solução: agendar fn_backfill_product_categories (fill-only: só preenche category_id NULL
-- via fn_master_classify_product, classificação por nome) como passo recorrente do pipeline.
-- Zero regressão (nunca sobrescreve categoria existente). Backlog histórico limpo na aplicação.
DO $$ BEGIN
  PERFORM cron.unschedule('pipeline-classify-categories');
EXCEPTION WHEN OTHERS THEN NULL; END $$;

SELECT cron.schedule(
  'pipeline-classify-categories',
  '*/10 * * * *',
  $cron$ SELECT public.fn_backfill_product_categories(300, false); $cron$
);
