REVOKE EXECUTE ON FUNCTION public.get_unread_count() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.mark_all_notifications_read() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.mark_notification_read(uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.revoke_all_user_tokens(uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.mcp_audit_actor(uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.fn_check_geo_access(text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public._can_act_on_behalf_of_others() FROM PUBLIC, anon, authenticated;