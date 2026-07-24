-- ============================================================================
-- ETAPA 19 — Políticas de SELECT para tabelas de inteligência/similaridade
-- adicionadas ao REST_NATIVE_SAFE_TABLES:
--   stock_daily_summary  — sparkline de vendas no catálogo e página de produto
--   mv_stock_velocity    — velocidade de estoque (StockHistoryChart)
--   product_relationships — produtos similares (página de produto)
--   product_group_members — membros de grupo (fallback de similares)
--
-- Contexto: bridge desligado → queries vêm do cliente com anon/authenticated
-- key → RLS aplicada → sem policy SELECT → array vazio silencioso.
-- Idempotente via DO $$ IF NOT EXISTS.
-- ============================================================================

DO $$
BEGIN
  -- stock_daily_summary
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'stock_daily_summary'
      AND policyname = 'stock_daily_summary_select_public'
  ) THEN
    IF EXISTS (
      SELECT 1 FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = 'stock_daily_summary'
    ) THEN
      CREATE POLICY "stock_daily_summary_select_public"
        ON public.stock_daily_summary FOR SELECT TO anon, authenticated USING (true);
      RAISE NOTICE 'Created policy stock_daily_summary_select_public';
    ELSE
      RAISE NOTICE 'Table stock_daily_summary not found — skipping policy';
    END IF;
  END IF;

  -- mv_stock_velocity (materialized view)
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'mv_stock_velocity'
      AND policyname = 'mv_stock_velocity_select_public'
  ) THEN
    IF EXISTS (
      SELECT 1 FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = 'mv_stock_velocity'
    ) THEN
      CREATE POLICY "mv_stock_velocity_select_public"
        ON public.mv_stock_velocity FOR SELECT TO anon, authenticated USING (true);
      RAISE NOTICE 'Created policy mv_stock_velocity_select_public';
    ELSE
      RAISE NOTICE 'Table/view mv_stock_velocity not found — skipping policy';
    END IF;
  END IF;

  -- product_relationships
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'product_relationships'
      AND policyname = 'product_relationships_select_public'
  ) THEN
    IF EXISTS (
      SELECT 1 FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = 'product_relationships'
    ) THEN
      CREATE POLICY "product_relationships_select_public"
        ON public.product_relationships FOR SELECT TO anon, authenticated USING (true);
      RAISE NOTICE 'Created policy product_relationships_select_public';
    ELSE
      RAISE NOTICE 'Table product_relationships not found — skipping policy';
    END IF;
  END IF;

  -- product_group_members
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'product_group_members'
      AND policyname = 'product_group_members_select_public'
  ) THEN
    IF EXISTS (
      SELECT 1 FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = 'product_group_members'
    ) THEN
      CREATE POLICY "product_group_members_select_public"
        ON public.product_group_members FOR SELECT TO anon, authenticated USING (true);
      RAISE NOTICE 'Created policy product_group_members_select_public';
    ELSE
      RAISE NOTICE 'Table product_group_members not found — skipping policy';
    END IF;
  END IF;
END $$;
