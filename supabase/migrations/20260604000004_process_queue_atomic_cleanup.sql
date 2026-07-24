-- Migration: process_queue atomic cleanup function
-- Problema: edge function process-queue fazia cleanup e fetch em operações separadas.
-- Se o cleanup era bem-sucedido mas o fetch falhava, notificações eram perdidas.
-- Fix: função SQL SECURITY DEFINER que faz cleanup + fetch em transação única,
-- retornando as notificações não lidas ANTES de limpá-las.
-- A edge function passa a chamar um único RPC em vez de dois comandos separados.

CREATE OR REPLACE FUNCTION public.process_notifications_queue(
  p_limit INT DEFAULT 500
)
RETURNS TABLE (
  id UUID,
  user_id UUID,
  title TEXT,
  message TEXT,
  type TEXT,
  category TEXT,
  created_at TIMESTAMPTZ
) AS $$
BEGIN
  -- 1. Atomically claim and return unread notifications.
  -- FOR UPDATE SKIP LOCKED ensures concurrent callers skip rows already claimed
  -- by a peer, preventing duplicate dispatch across parallel edge function invocations.
  RETURN QUERY
    WITH claimed AS (
      SELECT wn.id
      FROM public.workspace_notifications wn
      WHERE wn.is_read = false
      ORDER BY wn.created_at ASC
      LIMIT p_limit
      FOR UPDATE SKIP LOCKED
    )
    UPDATE public.workspace_notifications wn
    SET is_read = true
    FROM claimed
    WHERE wn.id = claimed.id
    RETURNING wn.id, wn.user_id, wn.title, wn.message, wn.type, wn.category, wn.created_at;

  -- 2. Limpa notificações LIDAS antigas APÓS ter retornado as atuais.
  -- Only deletes is_read=true rows so unread notifications older than 90 days
  -- (e.g. inactive users) are never silently discarded before processing.
  -- workspace_notifications has no updated_at column; use created_at only.
  DELETE FROM public.workspace_notifications
  WHERE is_read = true
    AND created_at < NOW() - INTERVAL '90 days';

END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = 'public';

COMMENT ON FUNCTION public.process_notifications_queue IS
  'Retorna notificações não lidas e limpa antigas em transação única. '
  'Deve ser chamada apenas pela edge function process-queue via service_role.';

-- A função lê workspace_notifications sem filtro por user_id (processamento de fila
-- global). Revogar acesso público para impedir que clientes leiam notificações de
-- outros usuários via PostgREST.
REVOKE EXECUTE ON FUNCTION public.process_notifications_queue FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.process_notifications_queue TO service_role;
