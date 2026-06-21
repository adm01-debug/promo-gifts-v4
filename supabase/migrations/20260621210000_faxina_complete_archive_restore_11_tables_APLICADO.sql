-- APLICADO via MCP (apply_migration) em 2026-06-21 — reconciliação de estado.
--
-- CONTEXTO / ROOT CAUSE:
-- A migration 20260621100100_faxina_restore_active_tables_from_archive pretendia mover 15
-- tabelas de archive -> public, mas foi aplicada apenas PARCIALMENTE: somente 4 chegaram em
-- public (user_onboarding, navigation_analytics, secret_rotation_log, user_ip_allowlist).
-- As 11 restantes ficaram presas em archive, produzindo PGRST205 (HTTP 404 "Could not find
-- the table public.<x> in the schema cache") em todo .from() do app/edge-functions que as
-- referencia. O sintoma observado em produção foi expert_conversations na QuoteViewPage.
--
-- POR QUE SET SCHEMA É SEGURO:
-- ALTER TABLE ... SET SCHEMA muda apenas pg_class.relnamespace; o OID é preservado, então
-- policies (RLS), constraints, FKs e GRANTS (ACL em relacl) viajam junto e permanecem válidos.
-- Verificado antes de aplicar: authenticated mantém DML completo nas tabelas de feature
-- (expert_*, kit_collaborators, sales_goals, etc.), webhook_request_nonces fica SELECT-only,
-- anon sem acesso, service_role ALL. A policy de expert_messages referencia expert_conversations
-- por OID, portanto passou a resolver para public.expert_conversations automaticamente.
-- Ordem parent-first respeita a FK optimization_queue_runs.queue_id -> optimization_queue.
-- Bloco idempotente: move apenas o que está em archive e ainda não existe em public.

DO $$
DECLARE
  t text;
  ordered text[] := ARRAY[
    'optimization_queue',        -- pai antes do filho (FK)
    'optimization_queue_runs',
    'expert_conversations',      -- antes de expert_messages (policy referencia por OID)
    'expert_messages',
    'geo_allowed_countries',
    'kit_collaborators',
    'sales_goals',
    'saved_trends_views',
    'simulator_wizard_drafts',
    'video_variant_links',
    'webhook_request_nonces'
  ];
BEGIN
  FOREACH t IN ARRAY ordered LOOP
    IF EXISTS (
      SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
      WHERE n.nspname='archive' AND c.relname=t AND c.relkind='r'
    ) AND NOT EXISTS (
      SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
      WHERE n.nspname='public' AND c.relname=t
    ) THEN
      EXECUTE format('ALTER TABLE archive.%I SET SCHEMA public', t);
      EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
      EXECUTE format('REVOKE ALL ON public.%I FROM anon', t);
      EXECUTE format('GRANT ALL ON public.%I TO service_role', t);
    END IF;
  END LOOP;
END $$;

NOTIFY pgrst, 'reload schema';

-- NOTA DE FOLLOW-UP (não aplicado aqui — requer decisão do arquiteto):
-- public.kit_collaborators.kit_id tem FK para archive.custom_kits (que permaneceu em archive).
-- A FK cross-schema é válida e não quebra, mas a feature kit-builder depende de custom_kits;
-- avaliar incluir custom_kits (e tabelas relacionadas) num próximo restore.
