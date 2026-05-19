-- Função para ler segredos do vault de forma segura para as Edge Functions
-- Isso permite que as funções verifiquem tokens de cron/dispatcher sem expô-los em variáveis de ambiente se desejado.
CREATE OR REPLACE FUNCTION public.get_edge_function_secret(_name text)
RETURNS text AS $$
DECLARE
    _secret text;
BEGIN
    -- Busca no vault.secrets (tabela padrão do Supabase Vault)
    -- O nome do segredo deve bater com o que foi configurado no Dashboard > Vault
    SELECT decrypted_secret INTO _secret
    FROM vault.decrypted_secrets
    WHERE name = _name
    LIMIT 1;

    RETURN _secret;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, vault;

-- Revoga acesso PUBLIC por padrão
REVOKE EXECUTE ON FUNCTION public.get_edge_function_secret(text) FROM PUBLIC;

-- Permite apenas service_role
GRANT EXECUTE ON FUNCTION public.get_edge_function_secret(text) TO service_role;
