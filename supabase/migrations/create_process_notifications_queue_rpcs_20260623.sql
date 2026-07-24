-- BUG-4 FIX (2026-06-23): Criar RPCs ausentes que causam 500 em process-queue
-- A edge function process-queue invocava process_notifications_queue e
-- confirm_notifications_dispatched que simplesmente não existiam no banco.
-- Toda invocação do cron resultava em HTTP 500.

DROP FUNCTION IF EXISTS public.process_notifications_queue(integer);
DROP FUNCTION IF EXISTS public.confirm_notifications_dispatched(uuid[]);

CREATE OR REPLACE FUNCTION public.process_notifications_queue(
  p_limit integer DEFAULT 100
)
RETURNS TABLE(
  id        uuid,
  user_id   uuid,
  title     text,
  message   text,
  type      text,
  category  text,
  created_at timestamptz
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    wn.id,
    wn.user_id,
    wn.title,
    wn.message,
    wn.type,
    wn.category,
    wn.created_at
  FROM public.workspace_notifications wn
  WHERE wn.is_read = false
  ORDER BY wn.created_at ASC
  LIMIT p_limit;
$$;

COMMENT ON FUNCTION public.process_notifications_queue(integer) IS
  'Retorna até p_limit notificações não lidas em ordem FIFO. '
  'Criada em 2026-06-23 para corrigir BUG-4: edge fn process-queue '
  'invocava esta RPC que não existia, causando HTTP 500 a cada cron run.';

CREATE OR REPLACE FUNCTION public.confirm_notifications_dispatched(
  p_ids uuid[]
)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE public.workspace_notifications
  SET is_read = true
  WHERE id = ANY(p_ids)
    AND is_read = false;
$$;

COMMENT ON FUNCTION public.confirm_notifications_dispatched(uuid[]) IS
  'Marca as notificações com IDs p_ids como lidas (dispatched_at semântico). '
  'Idempotente. Criada em 2026-06-23 para corrigir BUG-4.';

GRANT EXECUTE ON FUNCTION public.process_notifications_queue(integer)       TO service_role;
GRANT EXECUTE ON FUNCTION public.confirm_notifications_dispatched(uuid[])   TO service_role;
