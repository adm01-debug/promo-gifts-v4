-- =============================================================
-- COLAPSO FASE 2 — ALTER ROLE timeouts
-- Substitui ALTER DATABASE idle_session_timeout (bloqueado no Supabase Cloud).
-- =============================================================

ALTER ROLE authenticator SET idle_in_transaction_session_timeout = '60000';
ALTER ROLE authenticator SET idle_session_timeout = '600000';
ALTER ROLE anon SET idle_in_transaction_session_timeout = '30000';
ALTER ROLE authenticated SET idle_in_transaction_session_timeout = '60000';
ALTER ROLE service_role SET idle_in_transaction_session_timeout = '60000';
ALTER ROLE service_role SET idle_session_timeout = '300000';
