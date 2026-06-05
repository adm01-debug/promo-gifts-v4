-- Segurança (auditoria PR #659): fn_process_raw_v2 é SECURITY DEFINER e seu
-- guard interno `IF auth.uid() IS NOT NULL AND NOT is_admin_or_above(...)` NÃO
-- protege chamadas anônimas (auth.uid() IS NULL pula o RAISE). Como anon e
-- authenticated têm EXECUTE por padrão (CREATE FUNCTION concede a PUBLIC),
-- qualquer requisição anônima ao endpoint PostgREST /rpc/fn_process_raw_v2
-- dispararia a importação com privilégios de definidor (escalação/integridade).
-- O motor é chamado apenas por service_role (edge functions / cron) e por
-- admins via outras rotas, então remover EXECUTE de PUBLIC/anon/authenticated
-- fecha o vetor sem afetar o pipeline.
REVOKE EXECUTE ON FUNCTION public.fn_process_raw_v2(uuid, integer, boolean) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.fn_process_raw_v2(uuid, integer, boolean) FROM anon;
REVOKE EXECUTE ON FUNCTION public.fn_process_raw_v2(uuid, integer, boolean) FROM authenticated;