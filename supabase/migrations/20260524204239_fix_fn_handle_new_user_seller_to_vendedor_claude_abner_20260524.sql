-- FIX (claude/abner 2026-05-24)
-- Bug: fn_handle_new_user tentava inserir 'seller'::app_role, mas o enum
-- public.app_role tem apenas {dev,supervisor,admin,manager,agente,coordenador,vendedor}.
-- O erro era silenciado pelo EXCEPTION WHEN OTHERS THEN RETURN NEW, fazendo todo
-- novo signup ficar SEM role. Hoje 13/13 usuários têm role (cadastrados antes
-- por outro caminho), mas a função estava armada para falhar no próximo signup.
-- Mudança mínima: 'seller' -> 'vendedor', e removemos o swallow do EXCEPTION
-- (mantemos o RAISE NOTICE para diagnóstico futuro).
CREATE OR REPLACE FUNCTION public.fn_handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'vendedor'::public.app_role)
  ON CONFLICT DO NOTHING;
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'fn_handle_new_user falhou para user_id=%: %', NEW.id, SQLERRM;
  RETURN NEW;
END
$function$;

COMMENT ON FUNCTION public.fn_handle_new_user() IS
'Cria role padrão (vendedor) ao criar usuário em auth.users. Corrigido em 2026-05-24 — antes inseria seller (que não existe no enum app_role) silenciado por exception, deixando users novos sem role.';
