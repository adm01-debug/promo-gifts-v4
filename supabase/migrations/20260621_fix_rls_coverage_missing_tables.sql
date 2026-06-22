-- APLICADO: 2026-06-21
-- Fix: habilita RLS nas 4 tabelas que quebravam smoke test rls_coverage
-- category_ancestors: SELECT público (dados de taxonomia, sem PII)
-- Tabelas _backup/_bkp: acesso exclusivo service_role

ALTER TABLE public.category_ancestors ENABLE ROW LEVEL SECURITY;

CREATE POLICY "category_ancestors_select_public"
  ON public.category_ancestors
  FOR SELECT
  TO public
  USING (true);

CREATE POLICY "category_ancestors_write_service_only"
  ON public.category_ancestors
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

ALTER TABLE public._backup_stock_daily_summary_20260618 ENABLE ROW LEVEL SECURITY;
ALTER TABLE public._bkp_kit_dims_20260619               ENABLE ROW LEVEL SECURITY;
ALTER TABLE public._bkp_orphan_active_variants_20260619 ENABLE ROW LEVEL SECURITY;

CREATE POLICY "backup_stock_service_only"
  ON public._backup_stock_daily_summary_20260618
  FOR ALL TO service_role
  USING (true) WITH CHECK (true);

CREATE POLICY "bkp_kit_dims_service_only"
  ON public._bkp_kit_dims_20260619
  FOR ALL TO service_role
  USING (true) WITH CHECK (true);

CREATE POLICY "bkp_orphan_variants_service_only"
  ON public._bkp_orphan_active_variants_20260619
  FOR ALL TO service_role
  USING (true) WITH CHECK (true);

NOTIFY pgrst, 'reload schema';
