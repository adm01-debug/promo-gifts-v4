INSERT INTO public.ai_usage_quotas (role, monthly_limit, is_unlimited)
VALUES 
  ('admin', 5000, true),
  ('dev', 5000, true),
  ('manager', 1000, false),
  ('supervisor', 1000, false),
  ('vendedor', 500, false),
  ('agente', 200, false),
  ('coordenador', 1000, false)
ON CONFLICT (role) DO UPDATE 
SET monthly_limit = EXCLUDED.monthly_limit, is_unlimited = EXCLUDED.is_unlimited;