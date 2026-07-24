-- LOTE B 1/2 - edge_rate_limits
CREATE TABLE IF NOT EXISTS public.edge_rate_limits (
  key text NOT NULL,
  count integer NOT NULL DEFAULT 0,
  reset_at timestamptz NOT NULL,
  created_at timestamptz NULL DEFAULT now(),
  updated_at timestamptz NULL DEFAULT now(),
  CONSTRAINT edge_rate_limits_pkey PRIMARY KEY (key)
);
CREATE INDEX IF NOT EXISTS idx_edge_rate_limits_reset_at ON public.edge_rate_limits(reset_at);
ALTER TABLE public.edge_rate_limits ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='edge_rate_limits' AND policyname='Service role can do everything on edge_rate_limits') THEN CREATE POLICY "Service role can do everything on edge_rate_limits" ON public.edge_rate_limits FOR ALL TO public USING (auth.role()='service_role') WITH CHECK (auth.role()='service_role'); END IF; END $$;
