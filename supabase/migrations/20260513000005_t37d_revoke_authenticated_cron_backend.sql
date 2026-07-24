-- T37d: Revoke EXECUTE from authenticated on cron/backend/admin-only functions.
-- These functions are called by scheduled jobs (pg_cron), edge functions (service_role),
-- or internal backend processes — never directly via PostgREST by authenticated users.

-- ADMIN AUDIT (called by admin tools, not frontend)
DO $g$ BEGIN REVOKE EXECUTE ON FUNCTION public.audit_ownership_orphans(text) FROM authenticated; EXCEPTION WHEN undefined_function OR undefined_object THEN NULL; END $g$;
DO $g$ BEGIN REVOKE EXECUTE ON FUNCTION public.audit_rls_coverage() FROM authenticated; EXCEPTION WHEN undefined_function OR undefined_object THEN NULL; END $g$;
DO $g$ BEGIN REVOKE EXECUTE ON FUNCTION public.audit_rls_matrix() FROM authenticated; EXCEPTION WHEN undefined_function OR undefined_object THEN NULL; END $g$;

-- SECURITY AUTOMATION / CRON
DO $g$ BEGIN REVOKE EXECUTE ON FUNCTION public.auto_block_extreme_offenders() FROM authenticated; EXCEPTION WHEN undefined_function OR undefined_object THEN NULL; END $g$;
DO $g$ BEGIN REVOKE EXECUTE ON FUNCTION public.check_telemetry_regression() FROM authenticated; EXCEPTION WHEN undefined_function OR undefined_object THEN NULL; END $g$;
DO $g$ BEGIN REVOKE EXECUTE ON FUNCTION public.detect_geo_violations(integer) FROM authenticated; EXCEPTION WHEN undefined_function OR undefined_object THEN NULL; END $g$;
DO $g$ BEGIN REVOKE EXECUTE ON FUNCTION public.notify_hardening_regression() FROM authenticated; EXCEPTION WHEN undefined_function OR undefined_object THEN NULL; END $g$;
DO $g$ BEGIN REVOKE EXECUTE ON FUNCTION public.snapshot_hardening_status() FROM authenticated; EXCEPTION WHEN undefined_function OR undefined_object THEN NULL; END $g$;

-- OPTIMIZATION QUEUE (backend workers)
DO $g$ BEGIN REVOKE EXECUTE ON FUNCTION public.claim_next_optimization() FROM authenticated; EXCEPTION WHEN undefined_function OR undefined_object THEN NULL; END $g$;
DO $g$ BEGIN REVOKE EXECUTE ON FUNCTION public.complete_optimization(uuid, text, text, text, jsonb, text) FROM authenticated; EXCEPTION WHEN undefined_function OR undefined_object THEN NULL; END $g$;
DO $g$ BEGIN REVOKE EXECUTE ON FUNCTION public.enqueue_optimization(text, text, text, integer) FROM authenticated; EXCEPTION WHEN undefined_function OR undefined_object THEN NULL; END $g$;
DO $g$ BEGIN REVOKE EXECUTE ON FUNCTION public.reset_mockup_credit_limits() FROM authenticated; EXCEPTION WHEN undefined_function OR undefined_object THEN NULL; END $g$;

-- SUPPLIER SYNC (backend/cron)
DO $g$ BEGIN REVOKE EXECUTE ON FUNCTION public.classify_product_origin(boolean, uuid) FROM authenticated; EXCEPTION WHEN undefined_function OR undefined_object THEN NULL; END $g$;
DO $g$ BEGIN REVOKE EXECUTE ON FUNCTION public.fn_populate_novelties_from_supplier() FROM authenticated; EXCEPTION WHEN undefined_function OR undefined_object THEN NULL; END $g$;
DO $g$ BEGIN REVOKE EXECUTE ON FUNCTION public.fn_sync_all_is_new() FROM authenticated; EXCEPTION WHEN undefined_function OR undefined_object THEN NULL; END $g$;
DO $g$ BEGIN REVOKE EXECUTE ON FUNCTION public.fn_video_link_to_products(uuid) FROM authenticated; EXCEPTION WHEN undefined_function OR undefined_object THEN NULL; END $g$;
DO $g$ BEGIN REVOKE EXECUTE ON FUNCTION public.process_supplier_product(uuid, jsonb, text) FROM authenticated; EXCEPTION WHEN undefined_function OR undefined_object THEN NULL; END $g$;
DO $g$ BEGIN REVOKE EXECUTE ON FUNCTION public.process_supplier_products_batch(uuid, integer) FROM authenticated; EXCEPTION WHEN undefined_function OR undefined_object THEN NULL; END $g$;
DO $g$ BEGIN REVOKE EXECUTE ON FUNCTION public.sincronizar_estoque_spot(jsonb, uuid) FROM authenticated; EXCEPTION WHEN undefined_function OR undefined_object THEN NULL; END $g$;
DO $g$ BEGIN REVOKE EXECUTE ON FUNCTION public.sync_external_connections_from_credentials() FROM authenticated; EXCEPTION WHEN undefined_function OR undefined_object THEN NULL; END $g$;
DO $g$ BEGIN REVOKE EXECUTE ON FUNCTION public.sync_external_connections_from_credentials(text, text, uuid) FROM authenticated; EXCEPTION WHEN undefined_function OR undefined_object THEN NULL; END $g$;
DO $g$ BEGIN REVOKE EXECUTE ON FUNCTION public.update_image_after_sync(uuid, character varying, text, bigint, integer, integer, character varying) FROM authenticated; EXCEPTION WHEN undefined_function OR undefined_object THEN NULL; END $g$;
DO $g$ BEGIN REVOKE EXECUTE ON FUNCTION public.update_preferred_suppliers(uuid) FROM authenticated; EXCEPTION WHEN undefined_function OR undefined_object THEN NULL; END $g$;
DO $g$ BEGIN REVOKE EXECUTE ON FUNCTION public.update_video_after_sync(uuid, character varying, text, text, text, text, integer, integer, integer) FROM authenticated; EXCEPTION WHEN undefined_function OR undefined_object THEN NULL; END $g$;

-- CLOUDFLARE MEDIA REGISTRATION (backend only)
DO $g$ BEGIN REVOKE EXECUTE ON FUNCTION public.register_cloudflare_image(uuid, character varying, text, character varying, uuid, uuid, character varying, bigint, integer, integer, character varying, boolean, integer, character varying, text) FROM authenticated; EXCEPTION WHEN undefined_function OR undefined_object THEN NULL; END $g$;
DO $g$ BEGIN REVOKE EXECUTE ON FUNCTION public.register_cloudflare_video(uuid, character varying, text, character varying, character varying, text, text, text, character varying, bigint, integer, integer, integer, boolean, integer, character varying, character varying, text) FROM authenticated; EXCEPTION WHEN undefined_function OR undefined_object THEN NULL; END $g$;

-- AI DESCRIPTION QUEUE (backend workers)
DO $g$ BEGIN REVOKE EXECUTE ON FUNCTION public.fn_aggregate_stock_daily(date) FROM authenticated; EXCEPTION WHEN undefined_function OR undefined_object THEN NULL; END $g$;
DO $g$ BEGIN REVOKE EXECUTE ON FUNCTION public.fn_claim_ai_description_batch(integer) FROM authenticated; EXCEPTION WHEN undefined_function OR undefined_object THEN NULL; END $g$;
DO $g$ BEGIN REVOKE EXECUTE ON FUNCTION public.fn_complete_ai_description(uuid, boolean, text, text, text, text, text) FROM authenticated; EXCEPTION WHEN undefined_function OR undefined_object THEN NULL; END $g$;
DO $g$ BEGIN REVOKE EXECUTE ON FUNCTION public.fn_enqueue_products_for_ai_description(integer, integer, boolean) FROM authenticated; EXCEPTION WHEN undefined_function OR undefined_object THEN NULL; END $g$;
DO $g$ BEGIN REVOKE EXECUTE ON FUNCTION public.fn_expire_novelties_with_stats() FROM authenticated; EXCEPTION WHEN undefined_function OR undefined_object THEN NULL; END $g$;

-- CRON CLEANUP JOBS
DO $g$ BEGIN REVOKE EXECUTE ON FUNCTION public.clean_old_audit_logs(integer) FROM authenticated; EXCEPTION WHEN undefined_function OR undefined_object THEN NULL; END $g$;
DO $g$ BEGIN REVOKE EXECUTE ON FUNCTION public.clean_old_rate_limits() FROM authenticated; EXCEPTION WHEN undefined_function OR undefined_object THEN NULL; END $g$;
DO $g$ BEGIN REVOKE EXECUTE ON FUNCTION public.cleanup_discount_test_data() FROM authenticated; EXCEPTION WHEN undefined_function OR undefined_object THEN NULL; END $g$;
DO $g$ BEGIN REVOKE EXECUTE ON FUNCTION public.cleanup_expired_collection_trash() FROM authenticated; EXCEPTION WHEN undefined_function OR undefined_object THEN NULL; END $g$;
DO $g$ BEGIN REVOKE EXECUTE ON FUNCTION public.cleanup_expired_favorite_trash() FROM authenticated; EXCEPTION WHEN undefined_function OR undefined_object THEN NULL; END $g$;
DO $g$ BEGIN REVOKE EXECUTE ON FUNCTION public.cleanup_expired_novelties() FROM authenticated; EXCEPTION WHEN undefined_function OR undefined_object THEN NULL; END $g$;
DO $g$ BEGIN REVOKE EXECUTE ON FUNCTION public.cleanup_expired_public_comparisons() FROM authenticated; EXCEPTION WHEN undefined_function OR undefined_object THEN NULL; END $g$;
DO $g$ BEGIN REVOKE EXECUTE ON FUNCTION public.cleanup_expired_step_up() FROM authenticated; EXCEPTION WHEN undefined_function OR undefined_object THEN NULL; END $g$;
DO $g$ BEGIN REVOKE EXECUTE ON FUNCTION public.cleanup_expired_step_up_tokens() FROM authenticated; EXCEPTION WHEN undefined_function OR undefined_object THEN NULL; END $g$;
DO $g$ BEGIN REVOKE EXECUTE ON FUNCTION public.cleanup_old_login_attempts() FROM authenticated; EXCEPTION WHEN undefined_function OR undefined_object THEN NULL; END $g$;
DO $g$ BEGIN REVOKE EXECUTE ON FUNCTION public.cleanup_old_logs(integer) FROM authenticated; EXCEPTION WHEN undefined_function OR undefined_object THEN NULL; END $g$;
DO $g$ BEGIN REVOKE EXECUTE ON FUNCTION public.cleanup_old_notifications() FROM authenticated; EXCEPTION WHEN undefined_function OR undefined_object THEN NULL; END $g$;
DO $g$ BEGIN REVOKE EXECUTE ON FUNCTION public.cleanup_orphan_step_up_artifacts() FROM authenticated; EXCEPTION WHEN undefined_function OR undefined_object THEN NULL; END $g$;
DO $g$ BEGIN REVOKE EXECUTE ON FUNCTION public.cleanup_rate_limits() FROM authenticated; EXCEPTION WHEN undefined_function OR undefined_object THEN NULL; END $g$;
DO $g$ BEGIN REVOKE EXECUTE ON FUNCTION public.maintain_webhook_metrics() FROM authenticated; EXCEPTION WHEN undefined_function OR undefined_object THEN NULL; END $g$;
DO $g$ BEGIN REVOKE EXECUTE ON FUNCTION public.ownership_check_orphans() FROM authenticated; EXCEPTION WHEN undefined_function OR undefined_object THEN NULL; END $g$;
DO $g$ BEGIN REVOKE EXECUTE ON FUNCTION public.purge_edge_invocations_old() FROM authenticated; EXCEPTION WHEN undefined_function OR undefined_object THEN NULL; END $g$;
DO $g$ BEGIN REVOKE EXECUTE ON FUNCTION public.purge_favorite_trash_old() FROM authenticated; EXCEPTION WHEN undefined_function OR undefined_object THEN NULL; END $g$;
DO $g$ BEGIN REVOKE EXECUTE ON FUNCTION public.purge_old_audit_logs() FROM authenticated; EXCEPTION WHEN undefined_function OR undefined_object THEN NULL; END $g$;

-- ADMIN BULK / DEV
DO $g$ BEGIN REVOKE EXECUTE ON FUNCTION public.execute_role_migration_batch(text, text, jsonb, boolean) FROM authenticated; EXCEPTION WHEN undefined_function OR undefined_object THEN NULL; END $g$;
DO $g$ BEGIN REVOKE EXECUTE ON FUNCTION public.force_logout_all_users() FROM authenticated; EXCEPTION WHEN undefined_function OR undefined_object THEN NULL; END $g$;
DO $g$ BEGIN REVOKE EXECUTE ON FUNCTION public.seed_discount_test_users() FROM authenticated; EXCEPTION WHEN undefined_function OR undefined_object THEN NULL; END $g$;
DO $g$ BEGIN REVOKE EXECUTE ON FUNCTION public.e2e_cleanup_check_rate_limit(text, integer, integer) FROM authenticated; EXCEPTION WHEN undefined_function OR undefined_object THEN NULL; END $g$;
