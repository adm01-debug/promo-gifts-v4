-- MELHORIA 2/4: higiene de grants em discount_approval_audit (append-only de verdade).
-- O default do Supabase concedeu INSERT/UPDATE/DELETE/REFERENCES/TRIGGER a authenticated e anon.
-- Intencao original: SELECT-only p/ authenticated; escrita SOMENTE via trigger SECURITY DEFINER
-- fn_audit_discount_approval. Defesa-em-profundidade junto da RLS (WITH CHECK false / USING false).
-- anti-regressao: NAO reconceder escrita a authenticated/anon nesta tabela. fix_version=20260625_m2
REVOKE INSERT, UPDATE, DELETE, REFERENCES, TRIGGER ON public.discount_approval_audit FROM authenticated;
REVOKE ALL ON public.discount_approval_audit FROM anon;
