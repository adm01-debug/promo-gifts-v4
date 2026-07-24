-- Migration: fix audit_security_definer_acl Gate 5 failures
--
-- Two categories of issues resolved:
--
-- 1) Trigger functions with EXECUTE granted to `authenticated`
--    Trigger functions (RETURNS trigger) can ONLY be invoked by PostgreSQL's
--    trigger mechanism — they cannot be called directly. Revoking EXECUTE from
--    authenticated is 100% safe and eliminates unnecessary attack surface.
--
-- 2) Non-catalog SECURITY DEFINER functions accessible to `anon`
--    Role-helper functions (is_admin_or_above, is_org_member, etc.) and
--    analytics aggregates are revoked from anon.
--    Legitimate product-catalog functions (fn_get_color_swatches_batch, etc.)
--    are added to the `catalog_intent` whitelist inside audit_security_definer_acl.

-- ─── Part 1: revoke EXECUTE on trigger functions from authenticated ──────────
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT p.oid, p.proname, pg_get_function_identity_arguments(p.oid) AS args
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.prosecdef = true
      AND pg_get_function_result(p.oid) = 'trigger'
      AND p.proacl IS NOT NULL
      AND EXISTS (
        SELECT 1 FROM aclexplode(p.proacl) ace
        WHERE ace.grantee = (SELECT oid FROM pg_roles WHERE rolname = 'authenticated')
          AND ace.privilege_type = 'EXECUTE'
      )
  LOOP
    EXECUTE format(
      'REVOKE EXECUTE ON FUNCTION public.%I(%s) FROM authenticated',
      r.proname, r.args
    );
  END LOOP;
END $$;

-- ─── Part 2: revoke EXECUTE on role-helper & analytics functions from anon ───
-- These functions should only be accessible to authenticated users or internal roles.
-- is_* helpers: information about org membership/roles — anon always gets FALSE anyway,
-- but leaving EXECUTE open exposes unnecessary surface area.
-- Analytics aggregates: no public need for anon to call these directly.

DO $$
DECLARE
  func_name TEXT;
  func_args TEXT;
BEGIN
  FOR func_name, func_args IN VALUES
    ('is_admin_or_above',      '_user_id uuid'),
    ('is_coord_or_above',      '_user_id uuid'),
    ('is_org_member',          '_user_id uuid, _org_id uuid'),
    ('is_org_owner_or_admin',  'org_id uuid'),
    ('user_is_org_member',     'org_id uuid'),
    ('get_collections_weekly_count',  '_weeks integer'),
    ('get_top_collected_products',    '_days integer, _limit integer')
  LOOP
    IF EXISTS (
      SELECT 1 FROM pg_proc p
      JOIN pg_namespace n ON n.oid = p.pronamespace
      WHERE n.nspname = 'public' AND p.proname = func_name
        AND p.proacl IS NOT NULL
        AND EXISTS (
          SELECT 1 FROM aclexplode(p.proacl) ace
          WHERE ace.grantee = (SELECT oid FROM pg_roles WHERE rolname = 'anon')
            AND ace.privilege_type = 'EXECUTE'
        )
    ) THEN
      EXECUTE format(
        'REVOKE EXECUTE ON FUNCTION public.%I(%s) FROM anon',
        func_name, func_args
      );
    END IF;
  END LOOP;
END $$;

-- ─── Part 3: add legitimate product-catalog anon functions to the whitelist ──
-- These functions are intentionally public for the product catalog (anonymous
-- browsing). We replace audit_security_definer_acl to expand catalog_intent.
CREATE OR REPLACE FUNCTION public.audit_security_definer_acl()
RETURNS TABLE(function_name text, arguments text, problem text, granted_to text)
LANGUAGE sql
STABLE
SET search_path TO 'public', 'pg_catalog'
AS $function$
  WITH defs AS (
    SELECT p.oid, p.proname, pg_get_function_identity_arguments(p.oid) AS args,
           p.proacl,
           (pg_get_function_result(p.oid) = 'trigger') AS is_trigger,
           (p.proname IN (
             'submit_quote_response','get_quote_token_by_value','check_login_rate_limit'
           )) AS public_intent,
           (p.proname IN (
             'fn_video_queue_next','fn_xbz_enqueue_videos','fn_xbz_link_video',
             'fn_asia_link_video','fn_video_link_to_products','fn_sm_link_video',
             'fn_spot_enqueue_new_videos','fn_spot_enqueue_vimeo_eu','fn_spot_link_video',
             'fn_spot_vimeo_daily_sync','fn_video_link','fn_video_queue_old_uid',
             'fn_video_queue_recover_stuck','fn_video_queue_update','fn_video_retry_errors',
             'fn_video_set_dimensions','fn_video_sim_export','fn_video_sim_upsert'
           )) AS anon_pipeline,
           (p.proname IN (
             'fn_check_login_allowed','fn_bulk_update_image_dimensions','fn_cf_audit_ingest',
             'fn_save_ai_enrichment_results','fn_dequeue_ai_enrichment','fn_enqueue_ai_enrichment'
           )) AS anon_edge,
           (p.proname IN (
             'mcp_kv_get','mcp_kv_set','mcp_kv_try_lock'
           )) AS anon_mcp,
           (p.proname IN (
             'fn_super_filtro','fn_super_filtro_facets','fn_super_filtro_opcoes',
             'fn_super_filtro_price_range','fn_super_filtro_product_ids',
             'fn_get_all_leaf_categories','fn_get_product_intelligence_all',
             'fn_get_category_breadcrumb','fn_log_search_analytics',
             'get_promo_sales_ranking','get_catalog_bestseller_page',
             'fn_get_reposicao_listing','fn_get_reposicao_metrics',
             'fn_get_recent_restocks','fn_get_replenishment_stats',
             'fn_match_canonical_color',
             'fn_auto_revoke_secdef_public_execute',
             'fn_revoke_view_write_grants_on_create',
             'audit_security_definer_acl',
             'fn_get_edge_functions_base_url',
             'get_edge_functions_base_url',
             'get_edge_anon_key',
             'get_edge_function_secret',
             -- Product catalog functions: intentionally accessible to anon
             -- for browsing without authentication
             'fn_get_color_swatches_batch',
             'fn_get_customization_price',
             'fn_get_product_customization_options',
             'fn_get_similar_products',
             'fn_global_search'
           )) AS catalog_intent
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.prosecdef = true
  ),
  acl_expanded AS (
    SELECT d.oid, d.proname, d.args, d.is_trigger,
           d.public_intent, d.anon_pipeline, d.anon_edge, d.anon_mcp, d.catalog_intent,
           a.grantee::regrole::text AS grantee
    FROM defs d
    LEFT JOIN LATERAL (SELECT (aclexplode(d.proacl)).grantee) a ON true
    WHERE a.grantee IS NOT NULL
  )
  SELECT proname, args, 'PUBLIC has EXECUTE'::text, 'PUBLIC'::text
  FROM acl_expanded
  WHERE grantee = '-'
    AND NOT (public_intent OR catalog_intent OR anon_pipeline OR anon_edge OR anon_mcp)
  UNION ALL
  SELECT proname, args, 'anon has EXECUTE (not in public-intent whitelist)'::text, 'anon'
  FROM acl_expanded
  WHERE grantee = 'anon'
    AND NOT (public_intent OR catalog_intent OR anon_pipeline OR anon_edge OR anon_mcp)
  UNION ALL
  SELECT proname, args, 'trigger function has EXECUTE for authenticated'::text, 'authenticated'
  FROM acl_expanded
  WHERE grantee = 'authenticated' AND is_trigger
  ORDER BY 1, 2;
$function$;
