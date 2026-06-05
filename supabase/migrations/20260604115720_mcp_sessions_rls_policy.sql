ALTER TABLE public.mcp_sessions ENABLE ROW LEVEL SECURITY;

-- Permite que a chave anon (usada pelo Worker) gerencie apenas esta tabela.
-- A proteção real de acesso é o MCP_BEARER_TOKEN no Worker + o nome da chave.
DROP POLICY IF EXISTS mcp_sessions_anon_all ON public.mcp_sessions;
CREATE POLICY mcp_sessions_anon_all
  ON public.mcp_sessions
  FOR ALL
  TO anon
  USING (true)
  WITH CHECK (true);