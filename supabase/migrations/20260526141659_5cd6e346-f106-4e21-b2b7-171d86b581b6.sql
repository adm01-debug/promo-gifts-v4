-- ============================================================
-- Migration: increment_webhook_stats RPC
-- ============================================================
-- Atualização atômica de last_received_at / total_received / total_invalid
-- no endpoint, evitando race condition do UPDATE direto anterior.
-- Chamada APENAS via service_role (RPC) a partir de webhook-inbound.
-- ============================================================

CREATE OR REPLACE FUNCTION public.increment_webhook_stats(
  p_endpoint_id UUID,
  p_is_invalid  BOOLEAN
) RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.inbound_webhook_endpoints
  SET
    last_received_at = NOW(),
    total_received   = COALESCE(total_received, 0) + 1,
    total_invalid    = COALESCE(total_invalid,  0) + CASE WHEN p_is_invalid THEN 1 ELSE 0 END
  WHERE id = p_endpoint_id;
END;
$$;

REVOKE ALL ON FUNCTION public.increment_webhook_stats(UUID, BOOLEAN) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.increment_webhook_stats(UUID, BOOLEAN) TO service_role, postgres;
