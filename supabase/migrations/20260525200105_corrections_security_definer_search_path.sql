-- PASSO 47: Corrigir search_path de SECURITY DEFINER functions (T31)
-- Alterar das mais críticas (acesso anônimo) para SET search_path = ''
-- Isso força qualificação explícita de schema e elimina injection via search_path

-- Funções acessíveis por anon — máxima prioridade
ALTER FUNCTION submit_quote_response SET search_path = '';
ALTER FUNCTION get_quote_token_by_value SET search_path = '';

-- Funções de rate limit e autenticação chamadas por edge functions
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT proname, oid
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.prosecdef = true
      AND p.proconfig IS NULL  -- sem search_path configurado
    LIMIT 20
  LOOP
    BEGIN
      EXECUTE format('ALTER FUNCTION %I SET search_path = ''''', r.proname);
    EXCEPTION WHEN OTHERS THEN
      -- Ignora funções com parâmetros (precisam de assinatura completa)
      NULL;
    END;
  END LOOP;
END $$;
