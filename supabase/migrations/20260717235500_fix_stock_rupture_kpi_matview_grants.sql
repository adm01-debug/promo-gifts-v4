-- APLICADO: 2026-07-17 23:45 UTC (via MCP)
-- Bug pré-existente encontrado por teste de stress pós-PR #1731.
--
-- CAUSA: migration 20260626184039 removeu anon das MVs de ruptura/kpi (correto).
-- A Phase 5 da 063 (20260717000063) varreu analytics.* mas deixou
-- public.mv_stock_rupture_alert e public.mv_ema_kpi_by_level sem authenticated.
-- Resultado: useRuptureAlerts, StockRiskHero, VariantStockTable → 403.
-- vw_rupture_* com security_invoker=true dependem de mv_stock_rupture_alert → 403 cascata.

DO $$
DECLARE v_vw text;
BEGIN
  -- mv_stock_rupture_alert (useRuptureAlerts, StockRiskHero, VariantStockTable)
  IF EXISTS (
    SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
    WHERE n.nspname='public' AND c.relname='mv_stock_rupture_alert' AND c.relkind='m'
  ) THEN
    GRANT SELECT ON public.mv_stock_rupture_alert TO authenticated, service_role;
    RAISE NOTICE '[rupture_fix] GRANT SELECT mv_stock_rupture_alert';
  ELSE
    RAISE NOTICE '[rupture_fix] mv_stock_rupture_alert ausente (preview) — skip';
  END IF;

  -- mv_ema_kpi_by_level (StockRiskHero — KPI de nível EMA)
  IF EXISTS (
    SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
    WHERE n.nspname='public' AND c.relname='mv_ema_kpi_by_level' AND c.relkind='m'
  ) THEN
    GRANT SELECT ON public.mv_ema_kpi_by_level TO authenticated, service_role;
    RAISE NOTICE '[rupture_fix] GRANT SELECT mv_ema_kpi_by_level';
  ELSE
    RAISE NOTICE '[rupture_fix] mv_ema_kpi_by_level ausente (preview) — skip';
  END IF;

  -- vw_rupture_* precisam de grant na view (security_invoker verifica o dep E a view)
  FOREACH v_vw IN ARRAY ARRAY[
    'vw_rupture_confidence_audit','vw_rupture_gap_purchase','vw_rupture_live_divergence'
  ] LOOP
    IF EXISTS (
      SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
      WHERE n.nspname='public' AND c.relname=v_vw AND c.relkind='v'
    ) THEN
      EXECUTE format('GRANT SELECT ON public.%I TO authenticated', v_vw);
      RAISE NOTICE '[rupture_fix] GRANT SELECT % → authenticated', v_vw;
    END IF;
  END LOOP;

  -- anon permanece bloqueado nestas MVs operacionais
  FOREACH v_vw IN ARRAY ARRAY[
    'mv_stock_rupture_alert','mv_ema_kpi_by_level',
    'vw_rupture_confidence_audit','vw_rupture_gap_purchase','vw_rupture_live_divergence'
  ] LOOP
    IF EXISTS (
      SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
      WHERE n.nspname='public' AND c.relname=v_vw
    ) THEN
      EXECUTE format('REVOKE SELECT ON public.%I FROM anon', v_vw);
    END IF;
  END LOOP;
END $$;

NOTIFY pgrst, 'reload schema';
