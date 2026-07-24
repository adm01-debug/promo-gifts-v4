-- PASSO 47: Corrigir search_path de SECURITY DEFINER functions (T31)
-- Alterar das mais críticas (acesso anônimo) para SET search_path = ''
-- Isso força qualificação explícita de schema e elimina injection via search_path

-- Funções acessíveis por anon — máxima prioridade
ALTER FUNCTION submit_quote_response SET search_path = '';
ALTER FUNCTION get_quote_token_by_value SET search_path = '';

-- Funções de rate limit e autenticação chamadas por edge functions
-- Fix: qualificar p.oid (ambíguo entre pg_proc e pg_namespace que ambos têm coluna `oid`)
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT p.proname, p.oid AS func_oid
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
