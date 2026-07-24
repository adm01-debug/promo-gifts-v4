-- =============================================================================
-- APLICADO em 2026-06-21 via Supabase MCP (apply_migration). Registro de 2 migrations.
-- Projeto: doufsxqlfjyuvxuezpln (sa-east-1)
-- Decisão de arquiteto (Pink e Cérebro): opção (a) — restaurar as tabelas de
-- notificação de segurança que o scan da FAXINA (20260621100100) deixou em archive.
-- =============================================================================
--
-- CONTEXTO
-- src/hooks/ui/usePushNotifications.tsx assina realtime postgres_changes(INSERT) em
-- 3 tabelas: notifications, device_login_notifications e login_attempts.
-- As duas primeiras estavam presas em archive → o canal nunca conectava
-- (CHANNEL_ERROR, agora gracioso após o fix de tópico único por montagem).
-- login_attempts já estava em public+realtime (não exigiu ação).
--
-- SIMULAÇÃO ADVERSARIAL (9 classes, 0 FAIL) antes da mutação:
--   • Estrutural: PK + replica identity (notifications=FULL, device_login=PK) OK
--   • Colunas lidas pelo frontend existem (title/message/type; ip_address/location)
--   • RLS habilitado + policies user-scoped em ambas
--   • SEM FK cross-schema (saída só p/ auth.users; nenhuma FK de entrada)
--   • SEM triggers; SEM views dependentes
--   • Nenhum writer SQL (send_digest_notification escreve em workspace_notifications,
--     confirmando que workspace_notifications é a substituta ativa) → mover é inócuo
--   • Ambas já eram membros de supabase_realtime (associação segue por OID no SET SCHEMA)
--
-- =============================================================================
-- MIGRATION 1: faxina_restore_security_notification_tables_from_archive
-- =============================================================================
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='archive' AND table_name='notifications')
     AND NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='notifications') THEN
    EXECUTE 'ALTER TABLE archive.notifications SET SCHEMA public';
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='archive' AND table_name='device_login_notifications')
     AND NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='device_login_notifications') THEN
    EXECUTE 'ALTER TABLE archive.device_login_notifications SET SCHEMA public';
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='notifications') THEN
    EXECUTE 'ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY';
    EXECUTE 'REVOKE ALL ON public.notifications FROM anon';
    EXECUTE 'GRANT SELECT, UPDATE ON public.notifications TO authenticated';
    EXECUTE 'GRANT ALL ON public.notifications TO service_role';
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='device_login_notifications') THEN
    EXECUTE 'ALTER TABLE public.device_login_notifications ENABLE ROW LEVEL SECURITY';
    EXECUTE 'REVOKE ALL ON public.device_login_notifications FROM anon';
    EXECUTE 'GRANT SELECT ON public.device_login_notifications TO authenticated';
    EXECUTE 'GRANT ALL ON public.device_login_notifications TO service_role';
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND schemaname='public' AND tablename='notifications') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND schemaname='public' AND tablename='device_login_notifications') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.device_login_notifications;
  END IF;
END $$;
NOTIFY pgrst, 'reload schema';

-- =============================================================================
-- MIGRATION 2: harden_grants_security_notification_tables (least-privilege)
-- As tabelas carregavam grants legados de DML completo p/ authenticated
-- (pré-arquivamento). Inerte hoje (RLS sem policy INSERT/DELETE nega), mas risco
-- latente. Alinhado ao surface REAL das policies:
--   notifications              → SELECT, UPDATE (lê + marca como lido)
--   device_login_notifications → SELECT (audit append-only; usuário não altera histórico)
-- SELECT preservado → realtime postgres_changes continua autorizado.
-- =============================================================================
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='notifications') THEN
    EXECUTE 'REVOKE ALL ON public.notifications FROM authenticated';
    EXECUTE 'GRANT SELECT, UPDATE ON public.notifications TO authenticated';
    EXECUTE 'REVOKE ALL ON public.notifications FROM anon';
    EXECUTE 'GRANT ALL ON public.notifications TO service_role';
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='device_login_notifications') THEN
    EXECUTE 'REVOKE ALL ON public.device_login_notifications FROM authenticated';
    EXECUTE 'GRANT SELECT ON public.device_login_notifications TO authenticated';
    EXECUTE 'REVOKE ALL ON public.device_login_notifications FROM anon';
    EXECUTE 'GRANT ALL ON public.device_login_notifications TO service_role';
  END IF;
END $$;
NOTIFY pgrst, 'reload schema';

-- =============================================================================
-- VERIFICAÇÃO PÓS-APLICAÇÃO (todas PASS)
--   • notifications + device_login_notifications em public + RLS on
--   • grants alinhados às policies (notif: SELECT,UPDATE | devlogin: SELECT); anon=0; service_role=ALL
--   • ambas na publicação supabase_realtime
--   • zero FK cross-schema public→archive (regressão global)
--   • queries .from() resolvem sem PGRST205
--   • login_attempts (3º listener) já estava public+realtime+colunas OK → feature de
--     alertas de segurança funcional ponta a ponta
--
-- FLAG P/ ARQUITETO (NÃO aplicado — fora do escopo + blast-radius alto):
--   public.login_attempts (tabela do fluxo de auth) tem grants residuais p/ anon
--   (REFERENCES, TRIGGER) e DML completo p/ authenticated em dado de auditoria.
--   Higienizar exige analisar o write-path de lockout/auditoria antes. Recomendado,
--   mas deixado para decisão do arquiteto.
-- =============================================================================
