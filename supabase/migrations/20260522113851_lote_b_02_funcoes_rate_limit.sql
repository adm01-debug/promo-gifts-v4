-- LOTE B 2/2 - rate limit functions
CREATE OR REPLACE FUNCTION public.check_edge_rate_limit(p_key text, p_window_ms integer, p_max_requests integer)
RETURNS TABLE(allowed boolean, remaining integer, reset_at timestamptz)
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE v_now timestamptz := now(); v_reset_at timestamptz; v_count integer;
BEGIN
  INSERT INTO public.edge_rate_limits (key,count,reset_at) VALUES (p_key,1,v_now+(p_window_ms||' milliseconds')::interval)
  ON CONFLICT (key) DO UPDATE SET
    count = CASE WHEN public.edge_rate_limits.reset_at < v_now THEN 1 ELSE public.edge_rate_limits.count+1 END,
    reset_at = CASE WHEN public.edge_rate_limits.reset_at < v_now THEN v_now+(p_window_ms||' milliseconds')::interval ELSE public.edge_rate_limits.reset_at END,
    updated_at = v_now
  RETURNING public.edge_rate_limits.count, public.edge_rate_limits.reset_at INTO v_count, v_reset_at;
  RETURN QUERY SELECT v_count<=p_max_requests, GREATEST(0,p_max_requests-v_count), v_reset_at;
END; $$;
REVOKE EXECUTE ON FUNCTION public.check_edge_rate_limit(text,integer,integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.check_edge_rate_limit(text,integer,integer) TO service_role;

CREATE OR REPLACE FUNCTION public.cleanup_expired_edge_rate_limits()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN DELETE FROM public.edge_rate_limits WHERE reset_at < now(); END; $$;
REVOKE EXECUTE ON FUNCTION public.cleanup_expired_edge_rate_limits() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.cleanup_expired_edge_rate_limits() TO service_role;
