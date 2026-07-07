
-- GAP #1 — GRANTs ausentes em crm_callback_events (política SSOT do public schema)
GRANT SELECT ON public.crm_callback_events TO authenticated;
GRANT ALL ON public.crm_callback_events TO service_role;

-- GAP #2 — Índice UNIQUE duplicado em request_rate_limits
-- request_rate_limits_identifier_endpoint_key (constraint UNIQUE nativa) já cobre.
DROP INDEX IF EXISTS public.idx_rate_limits_identifier_endpoint;
