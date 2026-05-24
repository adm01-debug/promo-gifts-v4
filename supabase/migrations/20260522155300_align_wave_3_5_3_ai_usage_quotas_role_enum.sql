-- ============================================================================
-- Migration: align_wave_3_5_3_ai_usage_quotas_role_enum
-- Date: 2026-05-22 15:53 UTC
-- Phase: Redeploy Fase 3.5 - Wave 3 (Enum compartilhado)
-- Applied via: MCP Supabase (Gestão de Produtos) - Decision 010
-- Registered as: supabase_migrations.schema_migrations
-- ============================================================================
-- Objetivo: ai_usage_quotas.role text → app_role enum (oficial estava em text,
-- Lovable já era enum). Pré-validado: todos os 5 valores distintos em uso
-- (admin, agente, dev, manager, supervisor) já existem no enum oficial.
--
-- COMPLEMENTAR (Lovable): ALTER TYPE app_role ADD VALUE 'agente', 'coordenador'
-- foi aplicado via lovable_db_query separadamente (enum oficial é superset).
-- ============================================================================

BEGIN;

-- Conversão direta - 5 rows preservadas, todas com valores válidos no enum
ALTER TABLE public.ai_usage_quotas
  ALTER COLUMN role TYPE public.app_role USING role::public.app_role;

COMMIT;

-- Pós-validação:
--   data_type: USER-DEFINED ✓
--   udt_name: app_role ✓
--   rows_preserved: 5 ✓
--   distinct_roles: admin, agente, dev, manager, supervisor ✓
