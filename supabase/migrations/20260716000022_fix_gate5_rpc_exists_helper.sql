-- Migration: Fix Gate 5 CHECK 3 and revoke mistaken anon grant
--
-- Problem:
--   Migration 021 granted anon EXECUTE on get_profile_and_roles(uuid) to make
--   the Gate 5 smoke test pass. But audit_security_definer_acl() flagged it as
--   "anon has EXECUTE (not in public-intent whitelist)" → Gate 5 CHECK 2 failed.
--
-- Solution:
--   1. REVOKE the mistaken anon grant from get_profile_and_roles
--   2. Create fn_rpc_exists(text) — a safe, read-only pg_catalog helper that anon
--      CAN call without security risk (returns only function existence boolean)
--   3. Add fn_rpc_exists to the catalog_intent whitelist in audit_security_definer_acl()
--   4. Gate 5 CHECK 3 script will call fn_rpc_exists when get_profile_and_roles
--      returns 404 (anon correctly denied) to confirm the function exists in pg_proc
--
-- Security: fn_rpc_exists only reads pg_proc metadata (no user data whatsoever).

-- ─── Part 1: REVOKE mistaken anon grant ────────────────────────────────────────
REVOKE EXECUTE ON FUNCTION public.get_profile_and_roles(uuid) FROM anon;

-- ─── Part 2: Safe pg_catalog inspection helper ─────────────────────────────────
CREATE OR REPLACE FUNCTION public.fn_rpc_exists(_fname text)
RETURNS bool
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS(
    SELECT 1
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname = _fname
  );
$$;

REVOKE ALL ON FUNCTION public.fn_rpc_exists(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.fn_rpc_exists(text) TO anon;
GRANT EXECUTE ON FUNCTION public.fn_rpc_exists(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.fn_rpc_exists(text) TO service_role;

-- ─── Part 3: Update audit function whitelist to include fn_rpc_exists ──────────
-- fn_rpc_exists reads only pg_proc metadata and is intentionally anon-accessible;
-- adding it to catalog_intent prevents the audit from flagging it.
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
             'fn_get_color_swatches_batch',
             'fn_get_customization_price',
             'fn_get_product_customization_options',
             'fn_get_similar_products',
             'fn_global_search',
             'fn_rpc_exists'
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
