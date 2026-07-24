-- FAXINA ROLLBACK: restore 15 tables actively referenced in app/edge-function code
-- Source code scan found .from() references for all tables below.
-- optimization_queue must come before optimization_queue_runs (FK dependency).

-- Tables with no inter-dependency
ALTER TABLE archive.user_onboarding         SET SCHEMA public;
ALTER TABLE archive.video_variant_links      SET SCHEMA public;
ALTER TABLE archive.expert_conversations     SET SCHEMA public;
ALTER TABLE archive.expert_messages          SET SCHEMA public;
ALTER TABLE archive.simulator_wizard_drafts  SET SCHEMA public;
ALTER TABLE archive.kit_collaborators        SET SCHEMA public;
ALTER TABLE archive.secret_rotation_log      SET SCHEMA public;
ALTER TABLE archive.navigation_analytics     SET SCHEMA public;
ALTER TABLE archive.sales_goals              SET SCHEMA public;
ALTER TABLE archive.user_ip_allowlist        SET SCHEMA public;
ALTER TABLE archive.geo_allowed_countries    SET SCHEMA public;
ALTER TABLE archive.saved_trends_views       SET SCHEMA public;
ALTER TABLE archive.webhook_request_nonces   SET SCHEMA public;

-- optimization_queue first (optimization_queue_runs FKs to it)
ALTER TABLE archive.optimization_queue       SET SCHEMA public;
ALTER TABLE archive.optimization_queue_runs  SET SCHEMA public;

-- Restore standard grants
DO $$
DECLARE
  tbl text;
  tbls text[] := ARRAY[
    'user_onboarding','video_variant_links','expert_conversations','expert_messages',
    'simulator_wizard_drafts','kit_collaborators','secret_rotation_log','navigation_analytics',
    'sales_goals','user_ip_allowlist','geo_allowed_countries','saved_trends_views',
    'webhook_request_nonces','optimization_queue','optimization_queue_runs'
  ];
BEGIN
  FOREACH tbl IN ARRAY tbls LOOP
    EXECUTE format('REVOKE ALL ON public.%I FROM anon', tbl);
    EXECUTE format('GRANT SELECT ON public.%I TO authenticated', tbl);
    EXECUTE format('GRANT ALL ON public.%I TO service_role', tbl);
  END LOOP;
END $$;
