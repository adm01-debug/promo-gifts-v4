-- 1. Revoke EXECUTE from authenticated for identified sensitive trigger and utility functions
-- These were identified by the security audit script as being improperly exposed.

DO $$ 
DECLARE 
    func_record RECORD;
BEGIN 
    FOR func_record IN 
        SELECT proname, pg_get_function_identity_arguments(pg_proc.oid) as args
        FROM pg_proc 
        JOIN pg_namespace n ON n.oid = pg_proc.pronamespace 
        WHERE n.nspname = 'public' 
        AND proname IN (
            'audit_mcp_api_keys_changes', 'audit_mcp_key_insert', 'audit_mcp_key_revoke',
            'audit_user_role_changes', 'auto_assign_user_to_promo_brindes',
            'dispatch_quote_webhook_event', 'enforce_created_by_owner',
            'enforce_seller_id_owner', 'enforce_user_id_owner',
            'fill_integration_credential_metadata', 'generate_order_number',
            'generate_quote_number', 'generate_secure_token',
            'guard_mcp_api_keys_writes', 'handle_new_user',
            'increment_row_version', 'invalidate_used_approval_token',
            'limit_recently_viewed_items', 'limit_recently_viewed_products',
            'log_mcp_key_changes', 'log_mcp_key_revocation',
            'log_mockup_prompt_change', 'move_collection_item_to_trash',
            'move_favorite_to_trash', 'notify_discount_approval_request',
            'notify_new_order', 'notify_quote_client_response',
            'notify_quote_status_change', 'prevent_profile_role_change',
            'prevent_role_self_update', 'tg_order_items_set_updated_at',
            'trg_auto_revoke_mcp_on_role_loss', 'trg_sync_external_connections',
            'trim_connection_test_history', 'validate_discount_approval_status',
            'validate_ip_access_control', 'validate_quote_real_discount',
            'validate_scheduled_report_email', 'validate_secret_rotation_action_type',
            'validate_status_fields'
        )
    LOOP 
        EXECUTE format('REVOKE EXECUTE ON FUNCTION public.%I(%s) FROM authenticated', 
            func_record.proname, 
            func_record.args);
    END LOOP; 
END $$;

-- 2. Ensure these are still executable by service_role
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO service_role;
