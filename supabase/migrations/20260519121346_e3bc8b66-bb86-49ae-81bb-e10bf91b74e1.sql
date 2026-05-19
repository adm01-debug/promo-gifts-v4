-- Tabela para persistência de rate limits das Edge Functions
CREATE TABLE IF NOT EXISTS public.edge_rate_limits (
    key TEXT PRIMARY KEY,
    count INTEGER NOT NULL DEFAULT 0,
    reset_at TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Segurança: Apenas o service_role (Edge Functions) pode gerenciar esta tabela
ALTER TABLE public.edge_rate_limits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role can do everything on edge_rate_limits"
ON public.edge_rate_limits
FOR ALL
USING (auth.role() = 'service_role')
WITH CHECK (auth.role() = 'service_role');

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_edge_rate_limits_reset_at ON public.edge_rate_limits (reset_at);

-- Função para limpar rate limits expirados (pode ser chamada por cron ou trigger)
CREATE OR REPLACE FUNCTION public.cleanup_expired_edge_rate_limits()
RETURNS void AS $$
BEGIN
    DELETE FROM public.edge_rate_limits WHERE reset_at < now();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- RPC para incrementar e verificar rate limit de forma atômica
CREATE OR REPLACE FUNCTION public.check_edge_rate_limit(
    p_key TEXT,
    p_window_ms INTEGER,
    p_max_requests INTEGER
)
RETURNS TABLE (
    allowed BOOLEAN,
    remaining INTEGER,
    reset_at TIMESTAMP WITH TIME ZONE
) AS $$
DECLARE
    v_now TIMESTAMP WITH TIME ZONE := now();
    v_reset_at TIMESTAMP WITH TIME ZONE;
    v_count INTEGER;
BEGIN
    -- Busca ou cria o registro
    INSERT INTO public.edge_rate_limits (key, count, reset_at)
    VALUES (p_key, 1, v_now + (p_window_ms || ' milliseconds')::interval)
    ON CONFLICT (key) DO UPDATE
    SET 
        count = CASE 
            WHEN public.edge_rate_limits.reset_at < v_now THEN 1 
            ELSE public.edge_rate_limits.count + 1 
        END,
        reset_at = CASE 
            WHEN public.edge_rate_limits.reset_at < v_now THEN v_now + (p_window_ms || ' milliseconds')::interval 
            ELSE public.edge_rate_limits.reset_at 
        END,
        updated_at = v_now
    RETURNING public.edge_rate_limits.count, public.edge_rate_limits.reset_at INTO v_count, v_reset_at;

    RETURN QUERY SELECT 
        v_count <= p_max_requests,
        GREATEST(0, p_max_requests - v_count),
        v_reset_at;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
