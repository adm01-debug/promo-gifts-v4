-- ============================================================================
-- Migration (LOVABLE-ONLY, documentação): fase_1_1_drop_legacy_lovable
-- Date: 2026-05-22 16:18 UTC
-- Phase: Redeploy Fase 1.1 - DROP legacy no Lovable
-- Applied via: lovable_db_query (PROJECT pqpdolkaeqlyzpdpbizo)
-- ============================================================================
-- Objetivo: dropar 3 tabelas legacy no Lovable Cloud interno que foram
-- substituídas por implementações novas mas continuaram existindo (sobras).
-- Pré-validado: 0 rows, 0 FKs incoming, 0 views/funções deps, 0 código runtime.
-- Sucessoras ativas: admin_audit_log (particionada) + favorite_lists/items.
-- ============================================================================

BEGIN;

-- 1) admin_audit_log_old - substituída por admin_audit_log + 7 partições mensais
DROP TABLE IF EXISTS public.admin_audit_log_old CASCADE;

-- 2) favorites - substituída por favorite_lists + favorite_items (modelo de duas tabelas)
DROP TABLE IF EXISTS public.favorites CASCADE;

-- 3) mcp_keys - substituída pelo novo sistema de integration_credentials
DROP TABLE IF EXISTS public.mcp_keys CASCADE;

COMMIT;

-- Pós-validação:
--   - Lovable.tables: 145 → 142 ✓
--   - Gate CI: only_lovable=0, schema_drift=0, has_drift=false ✓
