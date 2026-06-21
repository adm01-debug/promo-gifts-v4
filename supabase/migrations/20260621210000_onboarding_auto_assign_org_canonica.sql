-- APLICADO 2026-06-21 (Supabase MCP execute_sql, projeto doufsxqlfjyuvxuezpln).
-- Documenta migração JÁ APLICADA em produção (convenção: aplicar + versionar com header APLICADO).
--
-- BUG / GAP: nenhum mecanismo de onboarding vinculava novos usuários a uma organização.
--   handle_new_user (auth.users) cria apenas o profile; fn_grant_default_role_on_profile
--   concede apenas user_roles. O antigo trigger auto_assign (apontado para org fantasma)
--   foi removido. Resultado: todo novo usuário ficaria SEM linha em user_organizations,
--   que é a tabela consultada pela RLS de quotes (user_is_org_member) -> não conseguiria
--   criar orçamento (e o fallback do RPC retornaria 23502).
--
-- CORREÇÃO: trigger AFTER INSERT em profiles que vincula o novo perfil à organização
--   canônica (5db5aee1) em AMBAS as tabelas de membership. Idempotente; guarded contra
--   preview-snapshots sem a org.
CREATE OR REPLACE FUNCTION public.fn_auto_assign_org_on_profile()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _org constant uuid := '5db5aee1-064b-4ef4-9193-345dcd8274ea'; -- unica org real (Promo Brindes)
BEGIN
  IF EXISTS (SELECT 1 FROM public.organizations WHERE id = _org) THEN
    INSERT INTO public.user_organizations (organization_id, user_id)
    VALUES (_org, NEW.id) ON CONFLICT (organization_id, user_id) DO NOTHING;
    INSERT INTO public.organization_members (organization_id, user_id)
    VALUES (_org, NEW.id) ON CONFLICT (organization_id, user_id) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_auto_assign_org ON public.profiles;
CREATE TRIGGER trg_auto_assign_org
  AFTER INSERT ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.fn_auto_assign_org_on_profile();

-- HIGIENE: remove vinculos de membership orfaos (usuarios deletados de auth.users e profiles).
-- Seguro: so remove quem nao existe nem em auth.users nem em profiles. Idempotente.
WITH orf AS (
  SELECT uo.user_id FROM public.user_organizations uo
  WHERE NOT EXISTS (SELECT 1 FROM auth.users au WHERE au.id=uo.user_id)
    AND NOT EXISTS (SELECT 1 FROM public.profiles p WHERE p.id=uo.user_id)
  UNION
  SELECT om.user_id FROM public.organization_members om
  WHERE NOT EXISTS (SELECT 1 FROM auth.users au WHERE au.id=om.user_id)
    AND NOT EXISTS (SELECT 1 FROM public.profiles p WHERE p.id=om.user_id)
),
d1 AS (DELETE FROM public.user_organizations uo USING orf WHERE uo.user_id=orf.user_id RETURNING 1),
d2 AS (DELETE FROM public.organization_members om USING orf WHERE om.user_id=orf.user_id RETURNING 1)
SELECT (SELECT count(*) FROM d1) AS removidos_uo, (SELECT count(*) FROM d2) AS removidos_om;
