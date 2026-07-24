
-- ════════════════════════════════════════════════════════════════
-- Fix two categories of security WARNs:
--
--   1. enforce_password_reset_rate_limit() had an overly broad
--      PUBLIC EXECUTE grant (=X/postgres). Revoke it — explicit
--      grants to anon, authenticated, service_role remain.
--
--   2. Internal/staging tables visible to anon in the GraphQL
--      schema (pg_graphql_anon_table_exposed). These tables all
--      have RLS enabled with zero anon policies so no data leaks,
--      but revoking SELECT removes them from GraphQL introspection.
-- ════════════════════════════════════════════════════════════════

-- ── 1. Tighten enforce_password_reset_rate_limit() ───────────────
REVOKE EXECUTE ON FUNCTION public.enforce_password_reset_rate_limit()
  FROM PUBLIC;
-- explicit grants to anon/authenticated/service_role remain intact

-- ── 2. Hide internal tables from anon GraphQL schema ─────────────
-- Underscore-prefixed (internal pipeline / backup)
REVOKE SELECT ON TABLE public._asia_api_staging              FROM anon;
REVOKE SELECT ON TABLE public._backup_produtos_padronizacao_20260604 FROM anon;

-- AI provider / routing internals
REVOKE SELECT ON TABLE public.ai_function_routing            FROM anon;
REVOKE SELECT ON TABLE public.ai_provider_quotas             FROM anon;
REVOKE SELECT ON TABLE public.ai_providers                   FROM anon;
REVOKE SELECT ON TABLE public.ai_routing_decisions           FROM anon;
REVOKE SELECT ON TABLE public.ai_usage_events                FROM anon;
REVOKE SELECT ON TABLE public.ai_usage_quotas                FROM anon;

-- Staging tables (import / image pipeline)
REVOKE SELECT ON TABLE public.color_analysis_staging         FROM anon;
REVOKE SELECT ON TABLE public.import_staging_images          FROM anon;
REVOKE SELECT ON TABLE public.scraper_images_staging         FROM anon;
REVOKE SELECT ON TABLE public.sm_images_staging              FROM anon;
REVOKE SELECT ON TABLE public.xbz_gallery_staging            FROM anon;

-- Staging views
REVOKE SELECT ON TABLE public.v_import_staging_by_product    FROM anon;
REVOKE SELECT ON TABLE public.v_import_staging_progress      FROM anon;
