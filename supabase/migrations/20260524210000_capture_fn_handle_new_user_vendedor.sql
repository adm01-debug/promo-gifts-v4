-- Reconciliação de drift (colapso 2026-05-24, etapa B do plano).
--
-- `public.fn_handle_new_user()` (trigger em auth.users que cria a role padrão em
-- public.user_roles) foi criada fora do versionamento (path Lovable/dashboard) e
-- NUNCA teve corpo capturado no repo — só havia um REVOKE em
-- 20260513000002_t37c_revoke_authenticated_trigger_vault.sql.
--
-- Em produção a função inseria 'seller'::app_role, valor inexistente no enum
-- public.app_role {dev,supervisor,admin,manager,agente,coordenador,vendedor}. O erro
-- era engolido por `EXCEPTION WHEN OTHERS THEN RETURN NEW`, então TODO signup novo
-- ficava SEM role silenciosamente. Corrigido direto em produção em 2026-05-24
-- (migration de prod `20260524204239`), mas a correção não existia no repo —
-- um redeploy/rebuild reintroduziria o bug.
--
-- Esta migration captura a definição canônica corrigida (idempotente).

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
  -- Mantemos o trigger não-bloqueante (signup nunca falha por causa da role),
  -- mas agora deixamos rastro em log em vez de engolir o erro em silêncio.
  RAISE NOTICE 'fn_handle_new_user falhou para user_id=%: %', NEW.id, SQLERRM;
  RETURN NEW;
END
$function$;

COMMENT ON FUNCTION public.fn_handle_new_user() IS
  'Cria role padrão (vendedor) ao criar usuário em auth.users. Corrigido em 2026-05-24 — antes inseria seller (inexistente no enum app_role), engolido por exception, deixando users novos sem role.';
