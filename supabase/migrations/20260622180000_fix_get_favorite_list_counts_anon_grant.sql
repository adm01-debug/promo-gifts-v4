-- APLICADO: 2026-06-22 via execute_sql direto (sessão de debug)
-- Bug: get_favorite_list_counts retornava 404 para role `anon`
--
-- Root cause (PGRST202):
--   PostgREST retorna 404 (não 403) quando a role chamante não tem
--   EXECUTE permission na função. O frontend chama este RPC no mount
--   do componente antes do JWT de autenticação ser restaurado do
--   localStorage, então a primeira chamada chega como role `anon`.
--
-- Por que é seguro conceder a anon:
--   A função é SECURITY DEFINER + STABLE e filtra internamente por
--   `fl.user_id = (SELECT auth.uid())`. Quando chamada como anon
--   sem JWT, auth.uid() = NULL → WHERE false → 0 linhas → retorna
--   vazio, sem vazar dados de nenhum usuário.
--
-- Auditoria complementar:
--   Verificadas 20 outras funções SECURITY DEFINER com auth.uid().
--   Nenhuma outra deve receber grant a anon (todas são mutações,
--   funções de role-check ou operações de segurança).
--
-- Smoke tests: 28/28 PASS após aplicação.

GRANT EXECUTE ON FUNCTION public.get_favorite_list_counts() TO anon;

-- Invalidar cache do PostgREST para que o grant seja reconhecido
NOTIFY pgrst, 'reload schema';
