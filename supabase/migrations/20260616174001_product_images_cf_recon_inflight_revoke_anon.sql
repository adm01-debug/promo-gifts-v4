-- Hardening (gap encontrado em teste exaustivo): remove o GRANT de SELECT de
-- anon/authenticated na tabela interna de reconciliacao cf_recon_inflight.
-- RLS ja estava ligado (bloqueava linhas), mas o privilegio de tabela a mantinha
-- na superficie de API (PostgREST/GraphQL). As funcoes sao SECURITY DEFINER, entao
-- nao dependem desses grants. Idempotente.
REVOKE ALL ON public.cf_recon_inflight FROM anon, authenticated;