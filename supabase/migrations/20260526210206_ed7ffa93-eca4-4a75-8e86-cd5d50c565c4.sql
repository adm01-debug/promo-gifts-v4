-- Migration corrigida (26/05/2026): versão segura — criada pelo Lovable bot com ON CONFLICT DO UPDATE
-- que rebaixaria quotas já configuradas manualmente (manager 5000→1000, supervisor 5000→1000, agente 1000→200).
-- Substituído por ON CONFLICT DO NOTHING para preservar todos os valores existentes.
-- Apenas insere roles que ainda não existem no banco (vendedor, coordenador).
INSERT INTO public.ai_usage_quotas (role, monthly_limit, is_unlimited)
VALUES 
  ('admin',        0, true),
  ('dev',          0, true),
  ('manager',   5000, false),
  ('supervisor', 5000, false),
  ('vendedor',    500, false),
  ('agente',     1000, false),
  ('coordenador', 1000, false)
ON CONFLICT (role) DO NOTHING;
