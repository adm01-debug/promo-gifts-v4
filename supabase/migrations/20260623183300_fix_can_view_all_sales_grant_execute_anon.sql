-- APLICADO 2026-06-23 | Melhoria 5b: Bug fix can_view_all_sales() + GRANT EXECUTE anon
-- BUG: auth.uid() IS NULL retornava TRUE para anon -> potencial data leak de vendas
CREATE OR REPLACE FUNCTION public.can_view_all_sales() RETURNS boolean LANGUAGE sql STABLE SET search_path TO 'public' AS $function$ SELECT auth.uid() IS NOT NULL AND (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'manager'::app_role) OR public.has_role(auth.uid(), 'supervisor'::app_role) OR public.has_role(auth.uid(), 'dev'::app_role)); $function$;
GRANT EXECUTE ON FUNCTION public.can_view_all_sales() TO anon;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, app_role) TO anon;
GRANT EXECUTE ON FUNCTION public.is_admin() TO anon;
GRANT EXECUTE ON FUNCTION public.is_admin(uuid) TO anon;
GRANT EXECUTE ON FUNCTION public.is_admin_strict(uuid) TO anon;
GRANT EXECUTE ON FUNCTION public.is_dev(uuid) TO anon;
GRANT EXECUTE ON FUNCTION public.is_kit_collaborator(uuid, uuid) TO anon;
GRANT EXECUTE ON FUNCTION public.is_kit_owner(uuid, uuid) TO anon;
GRANT EXECUTE ON FUNCTION public.is_supervisor_or_above(uuid) TO anon;
GRANT EXECUTE ON FUNCTION public.user_belongs_to_org(uuid) TO anon;
NOTIFY pgrst, 'reload schema';
