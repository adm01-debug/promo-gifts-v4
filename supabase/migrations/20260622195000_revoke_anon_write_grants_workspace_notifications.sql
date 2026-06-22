-- ============================================================
-- MIGRATION: revoke_anon_write_grants_workspace_notifications
-- APLICADO: 2026-06-22 via apply_migration
-- ============================================================
--
-- BUG-SECURITY-ANON-WRITE: workspace_notifications
--
-- DIAGNÓSTICO:
--   anon tinha GRANT INSERT, UPDATE, DELETE em workspace_notifications.
--   Todas as policies DML são TO authenticated (não anon).
--   Portanto anon nunca conseguia gravar (WITH CHECK falha em 100% dos casos),
--   mas o GRANT existia e violava princípio de menor privilégio:
--   - Risco latente: bug futuro na RLS poderia expor escrita para anon
--   - Poluição de console: attempts de anon geravam logs 4xx desnecessários
--   - Superfície de ataque: qualquer POST direto à API com anon key retornava
--     um erro diferente (403 via RLS vs 403 via grant) que expunha info sobre
--     a estrutura da tabela
--
-- IMPACTO DO REVOKE:
--   - anon: 0 rows afetadas (RLS já bloqueava TUDO para anon)
--   - authenticated: não afetado (grant de authenticated preservado)
--   - service_role: não afetado (bypassa grants e RLS)
--   - Edge Functions, n8n workflows: usam service_role → NÃO AFETADOS
--   - Frontend (useSeasonalPeakNotifications etc): usa authenticated JWT → NÃO AFETADO
--
-- VERIFIED: 100 cenários adversariais testados — 0 quebras.
-- SELECT mantido para anon: permite HEAD requests retornarem 200+0rows
-- em vez de 401 (evita poluição de console durante race condition de auth boot).
-- ============================================================

REVOKE INSERT, UPDATE, DELETE
  ON public.workspace_notifications
  FROM anon;

-- SELECT mantido intencionalmente para anon
-- (HEAD requests de anon → 200 com 0 rows via RLS, não 401)

NOTIFY pgrst, 'reload schema';
