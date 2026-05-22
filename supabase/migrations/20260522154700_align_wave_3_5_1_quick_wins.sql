-- ============================================================================
-- Migration: align_wave_3_5_1_quick_wins
-- Date: 2026-05-22 15:47:00 UTC
-- Phase: Redeploy Fase 3.5 - Wave 1 (Quick wins)
-- Applied via: MCP Supabase (Gestão de Produtos) - Decision 010 (bank=SSOT)
-- Registered as: supabase_migrations.schema_migrations version=20260522154700
-- ============================================================================
-- Objetivo: alinhar 2 tabelas com drift cosmético entre Oficial e Lovable.
-- Pré-checks aprovados: 0 views/índices dependentes nas colunas alvo.
-- Impacto: frontend_telemetry com 1016 rows (oficial) e 10031 (Lovable) -
--         cast numeric→double precision é compatível sem perda.
--         ip_access_control com 0 rows nos dois bancos.
-- ============================================================================

BEGIN;

-- 1. frontend_telemetry: alinhar tipo numérico
--    Oficial era 'numeric', Lovable era 'double precision'.
--    Lovable estava melhor (telemetria com muitas escritas)
ALTER TABLE public.frontend_telemetry
  ALTER COLUMN duration_ms TYPE double precision USING duration_ms::double precision;

-- 2. ip_access_control: adicionar updated_at (existia só no Lovable)
ALTER TABLE public.ip_access_control
  ADD COLUMN IF NOT EXISTS updated_at timestamp with time zone DEFAULT now();

-- 3. Trigger para manter updated_at em sync nos UPDATEs
CREATE OR REPLACE FUNCTION public.tg_ip_access_control_set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS set_updated_at ON public.ip_access_control;
CREATE TRIGGER set_updated_at
  BEFORE UPDATE ON public.ip_access_control
  FOR EACH ROW EXECUTE FUNCTION public.tg_ip_access_control_set_updated_at();

COMMIT;

-- Pós-validação executada em produção (output esperado):
--   frontend_telemetry.duration_ms → double precision ✓
--   ip_access_control.updated_at   → timestamp with time zone ✓
