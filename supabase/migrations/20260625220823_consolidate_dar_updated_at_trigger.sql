-- MELHORIA 1/4: consolida os dois triggers BEFORE UPDATE de updated_at em discount_approval_requests.
-- O bespoke trg_discount_approval_updated_at -> update_discount_approval_updated_at() (now(), sem search_path)
-- disparava DEPOIS do canonico (ordem alfabetica) e sobrescrevia updated_at com now() (transaction start),
-- revertendo o fix de clock_timestamp(). Mantem o canonico trg_dar_updated_at -> fn_set_updated_at()
-- (clock_timestamp, SECURITY DEFINER, usado por 19 tabelas).
-- anti-regressao (Lovable): NAO recriar update_discount_approval_updated_at. fix_version=20260625_m1
DROP TRIGGER IF EXISTS trg_discount_approval_updated_at ON public.discount_approval_requests;
DROP FUNCTION IF EXISTS public.update_discount_approval_updated_at();
