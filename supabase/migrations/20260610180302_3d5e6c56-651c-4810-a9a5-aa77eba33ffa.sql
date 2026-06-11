GRANT EXECUTE ON FUNCTION public.is_supervisor_or_above(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.is_admin(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.is_dev(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.is_admin_strict(uuid) TO authenticated, service_role;
