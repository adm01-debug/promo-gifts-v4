-- Wave 3.5.3 - ai_usage_quotas.role text -> app_role
ALTER TABLE public.ai_usage_quotas ALTER COLUMN role TYPE public.app_role USING role::public.app_role;
