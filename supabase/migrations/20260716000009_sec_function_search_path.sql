-- SEC: Pin search_path on 44 functions flagged by function_search_path_mutable (WARN)
--
-- Supabase linter lint=0011_function_search_path_mutable flags functions that have
-- a mutable search_path, allowing an attacker to create objects in a schema that
-- shadows the intended references (search-path hijacking).
--
-- All 44 functions below are non-SECDEF pipeline/utility functions in public schema
-- with proconfig=NULL (no pinned search_path). Fix: pin to 'public','extensions'
-- so they can still resolve unqualified names but cannot be redirected.
--
-- Reference: https://supabase.com/docs/guides/database/database-linter?lint=0011_function_search_path_mutable

ALTER FUNCTION public.deactivate_products(ids uuid[])                                           SET search_path = 'public', 'extensions';
ALTER FUNCTION public.ensure_default_favorite_list(_user_id uuid)                               SET search_path = 'public', 'extensions';
ALTER FUNCTION public.fn_asia_wp_to_canonical(p_wp jsonb)                                       SET search_path = 'public', 'extensions';
ALTER FUNCTION public.fn_circumference_to_diameter(p_circumference numeric)                     SET search_path = 'public', 'extensions';
ALTER FUNCTION public.fn_cron_guard(p_key bigint, p_sql text)                                   SET search_path = 'public', 'extensions';
ALTER FUNCTION public.fn_derive_parent_ref(p_supplier_id uuid, p_variant_ref text, p_raw jsonb) SET search_path = 'public', 'extensions';
ALTER FUNCTION public.fn_fix_mojibake(p text)                                                   SET search_path = 'public', 'extensions';
ALTER FUNCTION public.fn_norm_piece_label(p text)                                               SET search_path = 'public', 'extensions';
ALTER FUNCTION public.fn_normalize_packing_type(p_raw text)                                     SET search_path = 'public', 'extensions';
ALTER FUNCTION public.fn_pad_sync_status()                                                      SET search_path = 'public', 'extensions';
ALTER FUNCTION public.fn_parse_sm_site_markdown(p_md text, p_source_url text)                  SET search_path = 'public', 'extensions';
ALTER FUNCTION public.fn_parse_xbz_site_html(p_html text, p_codigo text, p_url text)           SET search_path = 'public', 'extensions';
ALTER FUNCTION public.fn_recalcular_markup(p_nivel text, p_id uuid)                             SET search_path = 'public', 'extensions';
ALTER FUNCTION public.fn_refresh_supplier_sync_telemetry(p_supplier_id uuid)                   SET search_path = 'public', 'extensions';
ALTER FUNCTION public.fn_sanitize_text(p text)                                                  SET search_path = 'public', 'extensions';
ALTER FUNCTION public.fn_set_markup(p_nivel text, p_id uuid, p_markup numeric, p_descricao text) SET search_path = 'public', 'extensions';
ALTER FUNCTION public.fn_set_product_as_new()                                                   SET search_path = 'public', 'extensions';
ALTER FUNCTION public.fn_set_updated_at_aeq()                                                   SET search_path = 'public', 'extensions';
ALTER FUNCTION public.fn_set_updated_at_pa()                                                    SET search_path = 'public', 'extensions';
ALTER FUNCTION public.fn_silver_set_updated_at()                                                SET search_path = 'public', 'extensions';
ALTER FUNCTION public.fn_site_flag_divergent(p_supplier uuid)                                   SET search_path = 'public', 'extensions';
ALTER FUNCTION public.fn_site_to_silver_all(p_supplier uuid, p_limit integer)                  SET search_path = 'public', 'extensions';
ALTER FUNCTION public.fn_slugify(p_text text)                                                   SET search_path = 'public', 'extensions';
ALTER FUNCTION public.fn_sm_category_set_updated()                                              SET search_path = 'public', 'extensions';
ALTER FUNCTION public.fn_sm_url_map_set_updated()                                               SET search_path = 'public', 'extensions';
ALTER FUNCTION public.fn_spot_batch_to_silver(p_batch_size integer)                             SET search_path = 'public', 'extensions';
ALTER FUNCTION public.fn_spr_normalize_keys()                                                   SET search_path = 'public', 'extensions';
ALTER FUNCTION public.fn_sync_novelty_expires_at()                                              SET search_path = 'public', 'extensions';
ALTER FUNCTION public.fn_test_guc_visibility()                                                  SET search_path = 'public', 'extensions';
ALTER FUNCTION public.fn_trigger_set_has_gift_box()                                             SET search_path = 'public', 'extensions';
ALTER FUNCTION public.fn_trigger_sync_product_status_fields()                                   SET search_path = 'public', 'extensions';
ALTER FUNCTION public.fn_update_ptm_timestamp()                                                 SET search_path = 'public', 'extensions';
ALTER FUNCTION public.fn_update_updated_at()                                                    SET search_path = 'public', 'extensions';
ALTER FUNCTION public.fn_xbz_batch_to_silver(p_batch_size integer)                             SET search_path = 'public', 'extensions';
ALTER FUNCTION public.fn_xbz_derivar_campos_editoriais()                                        SET search_path = 'public', 'extensions';
ALTER FUNCTION public.fn_xbz_enrich_from_site()                                                 SET search_path = 'public', 'extensions';
ALTER FUNCTION public.fn_xbz_extract_min_quantity(p_raw_data jsonb)                             SET search_path = 'public', 'extensions';
ALTER FUNCTION public.fn_xbz_propagate_site_to_silver()                                         SET search_path = 'public', 'extensions';
ALTER FUNCTION public.fn_xbz_site_collect(p_max integer)                                        SET search_path = 'public', 'extensions';
ALTER FUNCTION public.fn_xbz_site_tick(p_enqueue integer, p_collect integer, p_stale_days integer, p_api_key text) SET search_path = 'public', 'extensions';
ALTER FUNCTION public.fn_xbz_to_silver(p_bronze_id uuid)                                        SET search_path = 'public', 'extensions';
ALTER FUNCTION public.generate_image_alt_text(p_product_name text, p_image_type text, p_color_name text, p_display_order integer) SET search_path = 'public', 'extensions';
ALTER FUNCTION public.restore_favorite_from_trash(_trash_id uuid, _user_id uuid, _fallback_list_id uuid) SET search_path = 'public', 'extensions';
ALTER FUNCTION public.trg_product_images_seo_autofill()                                         SET search_path = 'public', 'extensions';

-- ─── Validate ─────────────────────────────────────────────────────────────────
DO $$
DECLARE
  v_still_mutable integer;
BEGIN
  SELECT count(*) INTO v_still_mutable
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public'
    AND p.proname = ANY(ARRAY[
      'deactivate_products','ensure_default_favorite_list','fn_asia_wp_to_canonical',
      'fn_circumference_to_diameter','fn_cron_guard','fn_derive_parent_ref',
      'fn_fix_mojibake','fn_norm_piece_label','fn_normalize_packing_type',
      'fn_pad_sync_status','fn_parse_sm_site_markdown','fn_parse_xbz_site_html',
      'fn_recalcular_markup','fn_refresh_supplier_sync_telemetry','fn_sanitize_text',
      'fn_set_markup','fn_set_product_as_new','fn_set_updated_at_aeq',
      'fn_set_updated_at_pa','fn_silver_set_updated_at','fn_site_flag_divergent',
      'fn_site_to_silver_all','fn_slugify','fn_sm_category_set_updated',
      'fn_sm_url_map_set_updated','fn_spot_batch_to_silver','fn_spr_normalize_keys',
      'fn_sync_novelty_expires_at','fn_test_guc_visibility','fn_trigger_set_has_gift_box',
      'fn_trigger_sync_product_status_fields','fn_update_ptm_timestamp',
      'fn_update_updated_at','fn_xbz_batch_to_silver','fn_xbz_derivar_campos_editoriais',
      'fn_xbz_enrich_from_site','fn_xbz_extract_min_quantity',
      'fn_xbz_propagate_site_to_silver','fn_xbz_site_collect','fn_xbz_site_tick',
      'fn_xbz_to_silver','generate_image_alt_text','restore_favorite_from_trash',
      'trg_product_images_seo_autofill'
    ])
    AND (
      p.proconfig IS NULL
      OR NOT EXISTS (
        SELECT 1 FROM unnest(p.proconfig) cfg WHERE cfg LIKE 'search_path=%'
      )
    );

  IF v_still_mutable > 0 THEN
    RAISE EXCEPTION 'search_path pin FAILED — % functions still have mutable search_path', v_still_mutable;
  END IF;

  RAISE NOTICE 'search_path pinned on 44 functions — function_search_path_mutable warnings resolved';
END;
$$;
