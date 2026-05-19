-- Create tables for tracking simulations
CREATE TABLE public.simulation_runs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    mode TEXT NOT NULL, -- resilience, load, fuzzing, stress
    status TEXT NOT NULL DEFAULT 'running', -- running, completed, failed
    total_scenarios INTEGER DEFAULT 0,
    successes INTEGER DEFAULT 0,
    failures INTEGER DEFAULT 0,
    avg_latency_ms NUMERIC,
    p50_latency_ms NUMERIC,
    p90_latency_ms NUMERIC,
    p99_latency_ms NUMERIC,
    metadata JSONB DEFAULT '{}'::jsonb
);

CREATE TABLE public.simulation_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    run_id UUID REFERENCES public.simulation_runs(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    fn_name TEXT NOT NULL,
    status_code INTEGER,
    error_message TEXT,
    payload JSONB,
    latency_ms NUMERIC
);

-- Enable RLS
ALTER TABLE public.simulation_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.simulation_logs ENABLE ROW LEVEL SECURITY;

-- Policies (Admins only for now)
CREATE POLICY "Admins can view simulation runs"
ON public.simulation_runs FOR SELECT
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.profiles
        WHERE profiles.id = auth.uid()
        AND profiles.role = 'admin'
    )
);

CREATE POLICY "Admins can view simulation logs"
ON public.simulation_logs FOR SELECT
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.profiles
        WHERE profiles.id = auth.uid()
        AND profiles.role = 'admin'
    )
);

-- Index for performance
CREATE INDEX idx_simulation_logs_run_id ON public.simulation_logs(run_id);
CREATE INDEX idx_simulation_runs_created_at ON public.simulation_runs(created_at DESC);
