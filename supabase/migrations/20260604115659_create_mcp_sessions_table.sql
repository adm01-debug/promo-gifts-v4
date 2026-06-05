CREATE TABLE IF NOT EXISTS public.mcp_sessions (
  chave         text PRIMARY KEY,
  cookie        text NOT NULL,
  atualizado_em timestamptz NOT NULL DEFAULT now(),
  ultimo_check  timestamptz,
  viva          boolean,
  updated_at    timestamptz NOT NULL DEFAULT now()
);
COMMENT ON TABLE public.mcp_sessions IS 'Sessoes de portais externos usadas por MCPs (cookie + auto-refresh).';