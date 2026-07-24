-- =============================================================================
-- APLICADO em 2026-06-21 via Supabase MCP (apply_migration). Registro da migration.
-- Projeto: doufsxqlfjyuvxuezpln (sa-east-1)
-- Migration: harden_grants_login_attempts_least_privilege
-- =============================================================================
--
-- OBJETIVO
-- Higienizar grants de public.login_attempts (tabela de auditoria do fluxo de auth),
-- alinhando ao surface REAL das policies (least-privilege). Removia privilégio inerte:
--   • anon          tinha REFERENCES, TRIGGER (ruído; inócuos sem ownership/DDL)
--   • authenticated tinha DML completo (INSERT/UPDATE/DELETE) sobre dado de auditoria
--
-- ANÁLISE READ-ONLY DO WRITE-PATH (provada antes de aplicar):
--   • Policy única "Devs can view login attempts" = SELECT p/ authenticated,
--     gated por can_view_audit_logs(auth.uid()). NÃO existe policy de INSERT/UPDATE/DELETE
--     → escrita de authenticated/anon JÁ era negada pelo RLS (grants 100% inertes).
--   • INSERT real: edge function supabase/functions/log-login-attempt (service_role, bypassa RLS).
--                  Tabela tinha 2331 linhas no momento da aplicação (write-path ativo, intacto).
--   • cleanup/rate-limit/lockout: funções SECURITY DEFINER (dono postgres, bypassam RLS):
--       cleanup_old_login_attempts, purge_expired_security_data, check_login_rate_limit,
--       fn_check_login_allowed, auto_block_extreme_offenders.
--   • Frontend: useLoginAttempts / useLoginAttemptStats / useSecurityData / dashboards de
--     segurança / usePushNotifications → SOMENTE SELECT e realtime-listen (zero escrita cliente).
--
-- CONCLUSÃO: authenticated só precisa de SELECT; anon de nada; service_role mantém ALL.
-- Impacto funcional: ZERO (apenas remoção de privilégio inerte). RLS/policy/realtime intactos.
-- =============================================================================

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='login_attempts') THEN
    EXECUTE 'REVOKE ALL ON public.login_attempts FROM anon';
    EXECUTE 'REVOKE ALL ON public.login_attempts FROM authenticated';
    EXECUTE 'GRANT SELECT ON public.login_attempts TO authenticated';
    EXECUTE 'GRANT ALL ON public.login_attempts TO service_role';
  END IF;
END $$;

NOTIFY pgrst, 'reload schema';

-- =============================================================================
-- VERIFICAÇÃO PÓS-APLICAÇÃO (todas PASS)
--   • authenticated → SELECT | anon → (revogado) | service_role → ALL
--   • RLS=true, 1 policy intacta (não tocada)
--   • realtime publication intacto
--   • can_view_audit_logs presente (gate dos dashboards admin)
--   • smoke SELECT OK (2331 linhas — write-path service_role intacto)
-- =============================================================================
