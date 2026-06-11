CREATE OR REPLACE FUNCTION public.handle_password_reset_request()
RETURNS TRIGGER AS $$
BEGIN
  -- Tenta encontrar o user_id correspondente ao email na auth.users
  SELECT id INTO NEW.user_id 
  FROM auth.users 
  WHERE email = NEW.email 
  LIMIT 1;
  
  -- Se não encontrar o usuário, podemos opcionalmente impedir a criação
  -- ou deixar o gestor decidir. Aqui vamos permitir para não dar erro de UI,
  -- mas o gestor verá que não há user_id associado.
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Remove o gatilho se já existir para evitar erros
DROP TRIGGER IF EXISTS tr_handle_password_reset_request ON public.password_reset_requests;

-- Cria o gatilho
CREATE TRIGGER tr_handle_password_reset_request
BEFORE INSERT ON public.password_reset_requests
FOR EACH ROW
EXECUTE FUNCTION public.handle_password_reset_request();

-- Garante que o papel anon e authenticated possam inserir
GRANT INSERT ON public.password_reset_requests TO anon, authenticated;
GRANT SELECT ON public.password_reset_requests TO authenticated;
GRANT ALL ON public.password_reset_requests TO service_role;
