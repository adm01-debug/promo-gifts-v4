-- APLICADO: SIM — 2026-07-17 19:00 UTC (via MCP)
-- Migration: narrow_analytics_default_privileges_to_explicit_grants
-- Resultado: pg_default_acl do schema analytics volta a ficar vazio
-- Assertivas: 5 views wrapper seguem servindo authenticated; anon segue 42501
-- Reversível: ALTER DEFAULT PRIVILEGES IN SCHEMA analytics GRANT SELECT ON TABLES TO authenticated;
--
-- CONTEXTO:
-- A versão original de 20260717181201 tentava impedir a recorrência do 403 com:
--   ALTER DEFAULT PRIVILEGES IN SCHEMA analytics GRANT SELECT ON TABLES TO authenticated
--
-- Review (codex, P1) apontou corretamente que isso é amplo demais: concede SELECT
-- direto em QUALQUER tabela ou view futura criada em analytics — não apenas nas
-- matviews que alimentam wrappers de public. Como authenticated também tem USAGE
-- no schema, dados internos futuros de analytics ficariam expostos por padrão.
--
-- Isso contraria a Phase 5 da migration 20260717000063, que fecha analytics
-- deliberadamente ("revoke direct access from all relations").
--
-- DECISÃO:
-- Grants explícitos por objeto (aplicados em 181201, com guard de existência)
-- continuam valendo — são o que faz as 5 telas funcionarem. A proteção contra
-- recorrência passa a ser um gate de CI que roda o sweep de 403, não um
-- privilégio amplo que reabre o schema.

ALTER DEFAULT PRIVILEGES IN SCHEMA analytics
  REVOKE SELECT ON TABLES FROM authenticated, service_role;

-- O REVOKE para anon permanece: é restritivo e alinhado à Phase 1 da 063
-- (ALTER DEFAULT PRIVILEGES IN SCHEMA analytics REVOKE SELECT ON TABLES FROM PUBLIC).
ALTER DEFAULT PRIVILEGES IN SCHEMA analytics
  REVOKE ALL ON TABLES FROM anon;

NOTIFY pgrst, 'reload schema';
