-- Hardening: garante anon SEM EXECUTE em get_favorite_list_counts de forma deterministica.
-- Contexto: a funcao consta na whitelist de fn_auto_revoke_secdef_public_execute, entao aquele
-- event trigger NAO a revoga. Um (re)CREATE pela migration canonica 20260622200000 (DROP+CREATE+GRANT,
-- sem REVOKE) pode deixar anon=EXECUTE via default privileges do schema public. Esta migration tem
-- timestamp superior e revoga explicitamente, garantindo least-privilege como ULTIMA palavra em
-- qualquer `supabase db push`. Idempotente + guard de existencia (segura isolada).
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = 'get_favorite_list_counts'
      AND pg_get_function_identity_arguments(p.oid) = '_user_id uuid'
  ) THEN
    REVOKE EXECUTE ON FUNCTION public.get_favorite_list_counts(uuid) FROM PUBLIC;
    REVOKE EXECUTE ON FUNCTION public.get_favorite_list_counts(uuid) FROM anon;
    GRANT  EXECUTE ON FUNCTION public.get_favorite_list_counts(uuid) TO authenticated;
  END IF;
END $$;
NOTIFY pgrst, 'reload schema';
