-- Event trigger: revoga automaticamente write grants em novas views public
DROP EVENT TRIGGER IF EXISTS evt_revoke_view_write_grants;
CREATE EVENT TRIGGER evt_revoke_view_write_grants
  ON ddl_command_end
  WHEN TAG IN ('CREATE VIEW')
  EXECUTE FUNCTION public.fn_revoke_view_write_grants_on_create();
