-- Higiene de segurança: fixa search_path da trigger-function consolidada
-- (evita o lint function_search_path_mutable).
ALTER FUNCTION public.fn_spr_before_write() SET search_path TO 'public';
