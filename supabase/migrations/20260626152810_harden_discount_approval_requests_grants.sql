-- Defesa-em-profundidade na própria tabela discount_approval_requests (dado interno vendedor/admin).
-- As 4 RLS policies são TO authenticated => anon já não enxerga linhas; aqui removemos o grant
-- residual de tabela do anon (default do Supabase) e REFERENCES/TRIGGER do authenticated, ficando
-- consistente com o hardening já feito em quotes, quote_approval_tokens e discount_approval_audit (M2).
-- authenticated MANTÉM SELECT/INSERT/UPDATE/DELETE (gateados por RLS); service_role MANTÉM ALL.
-- Obs.: TRIGGER/REFERENCES são privilégios de CRIAR trigger/FK — revogá-los NÃO afeta triggers já
-- existentes (auditoria/notify/M1-M6 seguem disparando normalmente).
REVOKE ALL ON public.discount_approval_requests FROM anon;
REVOKE REFERENCES, TRIGGER ON public.discount_approval_requests FROM authenticated;
