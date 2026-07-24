-- =============================================================
-- HARDENING — defesa em profundidade na public.system_kill_switches
--
-- Cenário atual:
--   - RLS ativo com policy admin-only para INSERT/UPDATE/DELETE → OK
--   - GRANT INSERT/UPDATE/DELETE para anon e authenticated → redundante
--     mas representa risco se RLS for desabilitada por engano.
--
-- Ação: REVOKE de writes para anon e authenticated; preserva SELECT
-- (necessário para o kill-switch-client.ts ler o estado).
-- service_role e postgres preservam todos os privilégios (admin path).
-- =============================================================

REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER
  ON public.system_kill_switches FROM anon;

REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER
  ON public.system_kill_switches FROM authenticated;

-- authenticated mantém SELECT (necessário para front-end checks pós-login)
GRANT SELECT ON public.system_kill_switches TO authenticated;
GRANT SELECT ON public.system_kill_switches TO anon;

-- Verificação rápida
SELECT
  grantee,
  string_agg(privilege_type, ', ' ORDER BY privilege_type) AS privs
FROM information_schema.table_privileges
WHERE table_schema = 'public'
  AND table_name = 'system_kill_switches'
  AND grantee IN ('anon','authenticated')
GROUP BY grantee
ORDER BY grantee;
