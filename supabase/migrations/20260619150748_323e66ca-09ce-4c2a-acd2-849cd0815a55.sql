-- Hardening: SET search_path em função SECURITY DEFINER (linter 0011_function_search_path_mutable)
-- A função é uma trigger function de reset de senha; fixar search_path = public previne
-- ataques de schema-injection. Comportamento inalterado.

ALTER FUNCTION public.handle_password_reset_request() SET search_path = public;