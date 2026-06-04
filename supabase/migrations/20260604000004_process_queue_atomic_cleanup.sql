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
  -- 1. Busca notificações não lidas (dentro da mesma transação)
  RETURN QUERY
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
    ORDER BY wn.created_at DESC
    LIMIT p_limit;

  -- 2. Limpa notificações antigas APÓS ter retornado as atuais
  -- (expired = lidas há mais de 30 dias OU criadas há mais de 90 dias)
  DELETE FROM public.workspace_notifications
  WHERE
    (is_read = true AND updated_at < NOW() - INTERVAL '30 days')
    OR created_at < NOW() - INTERVAL '90 days';

END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = 'public';

COMMENT ON FUNCTION public.process_notifications_queue IS
  'Retorna notificações não lidas e limpa antigas em transação única. '
  'Substitui o padrão de dois comandos separados na edge function process-queue.';
