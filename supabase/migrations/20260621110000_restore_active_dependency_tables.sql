-- Restore 13 tables incorrectly archived that are referenced by active functions/triggers.
-- Verified by reading function bodies and checking row counts before restoration.

-- CRITICAL: seller discounts and quote validation
ALTER TABLE archive.seller_discount_limits SET SCHEMA public;         -- 13 rows; fn_quotes_validate_discount trigger
ALTER TABLE archive.discount_approval_requests SET SCHEMA public;     -- 0 rows; fn_quotes_validate_discount + dispatch_quote_webhook_event

-- Commemorative dates feature (completely broken without these)
ALTER TABLE archive.commemorative_date_colors SET SCHEMA public;      -- 34 rows; get_active_commemorative_dates + get_variants_for_commemorative_date
ALTER TABLE archive.commemorative_date_exclusions SET SCHEMA public;  -- 0 rows; get_variants_for_commemorative_date

-- Active data tables with real rows
ALTER TABLE archive.product_faqs SET SCHEMA public;                   -- 6 rows; calculate_seo_score
ALTER TABLE archive.product_print_positions SET SCHEMA public;        -- 3824 rows; fn_apply_auto_tag_rules
ALTER TABLE archive.query_telemetry SET SCHEMA public;                -- 997 rows; check_telemetry_regression, get_platform_failure_metrics

-- Trigger dependencies (0 rows but trigger fires on every write)
ALTER TABLE archive.mockup_prompt_history SET SCHEMA public;          -- 0 rows; log_mockup_prompt_change BEFORE UPDATE trigger
ALTER TABLE archive.mockup_approval_links SET SCHEMA public;          -- 0 rows; generate_mockup_approval_token
ALTER TABLE archive.quote_approval_tokens SET SCHEMA public;          -- 0 rows; get_quote_token_by_value

-- Admin utility tables
ALTER TABLE archive.ownership_audit_reports SET SCHEMA public;        -- 1 row; repair_ownership_orphans
ALTER TABLE archive.ownership_repair_logs SET SCHEMA public;          -- 0 rows; repair_ownership_orphans
ALTER TABLE archive.external_connections_sync_log SET SCHEMA public;  -- 0 rows; sync_external_connections_from_credentials
