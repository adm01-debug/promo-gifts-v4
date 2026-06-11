-- p2_realtime_01: cria device_login_notifications e completa a publication realtime
--
-- Contexto (auditoria integração frontend↔medallion 2026-06-11):
--   1. A edge function detect-new-device INSERE em public.device_login_notifications
--      e o hook usePushNotifications ASSINA INSERTs dessa tabela — mas a tabela
--      nunca existiu no SSOT doufsxqlfjyuvxuezpln (escrita e subscription mortas).
--   2. useWorkspaceNotifications/notificationService assinam postgres_changes de
--      workspace_notifications e usePushNotifications assina login_attempts, mas
--      nenhuma das duas estava na publication supabase_realtime (eventos nunca
--      entregues; UI dependia só de refetch).
--
-- Segurança:
--   - RLS select-own para authenticated (realtime respeita RLS: cada usuário só
--     recebe eventos das próprias linhas; login_attempts mantém a policy
--     existente can_view_audit_logs — eventos só chegam a admin/dev).
--   - Escrita exclusiva da service_role (edge function); nenhuma policy de
--     INSERT/UPDATE/DELETE para clientes.
--   - Não toca nas tabelas sensíveis verificadas por check_hardening_status
--     (discount_approval_requests, kit_variants, kit_comments ficam fora da
--     publication — invariante realtime_isolation_ok preservada).

CREATE TABLE IF NOT EXISTS public.device_login_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  device_id text,
  ip_address text,
  user_agent text,
  location text,
  email_sent boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.device_login_notifications IS
  'Notificações de login em novo dispositivo/IP. Escrita: edge detect-new-device (service_role). Leitura: dono via RLS. Consumida em realtime por usePushNotifications.';

CREATE INDEX IF NOT EXISTS idx_device_login_notifications_user_created
  ON public.device_login_notifications (user_id, created_at DESC);

ALTER TABLE public.device_login_notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can read own device login notifications"
  ON public.device_login_notifications;
CREATE POLICY "Users can read own device login notifications"
  ON public.device_login_notifications
  FOR SELECT TO authenticated
  USING (user_id = (SELECT auth.uid()));

REVOKE ALL ON public.device_login_notifications FROM PUBLIC;
REVOKE ALL ON public.device_login_notifications FROM anon;
GRANT SELECT ON public.device_login_notifications TO authenticated;
GRANT ALL ON public.device_login_notifications TO service_role;

-- Publication realtime (idempotente — ALTER PUBLICATION falha se a tabela já estiver lá)
DO $$
DECLARE
  _tbl text;
BEGIN
  FOREACH _tbl IN ARRAY ARRAY['device_login_notifications', 'workspace_notifications', 'login_attempts']
  LOOP
    IF NOT EXISTS (
      SELECT 1
      FROM pg_publication_rel pr
      JOIN pg_class c ON c.oid = pr.prrelid
      JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE pr.prpubid = (SELECT oid FROM pg_publication WHERE pubname = 'supabase_realtime')
        AND n.nspname = 'public'
        AND c.relname = _tbl
    ) THEN
      EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', _tbl);
    END IF;
  END LOOP;
END;
$$;
