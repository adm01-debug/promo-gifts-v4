-- Fix broken cron job 21 (cleanup-security-logs):
-- cleanup_security_logs was incorrectly moved to archive schema during the DB cleanup.
-- The function actively purges:
--   public_token_failures (>90 days), bot_detection_log (>90 days),
--   admin_audit_log (>90 days), client_errors (>7 days), ip_access_control (expired)
-- Every execution since archival silently failed with "function does not exist".

ALTER FUNCTION archive.cleanup_security_logs() SET SCHEMA public;
