-- APLICADO 2026-06-23 | Melhoria 2/7: REVOKE anon em views sensíveis
-- bi_quotes_summary e ai_insights_cache nao devem ser lidas por anon
REVOKE SELECT ON public.bi_quotes_summary FROM anon;
REVOKE SELECT ON public.ai_insights_cache FROM anon;
NOTIFY pgrst, 'reload schema';
