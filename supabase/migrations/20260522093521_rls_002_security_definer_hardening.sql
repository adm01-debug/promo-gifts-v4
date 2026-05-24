CREATE OR REPLACE FUNCTION public.is_admin_or_above(_user_id uuid DEFAULT auth.uid())
RETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF _user_id IS DISTINCT FROM auth.uid() AND NOT public.has_role(auth.uid(), 'dev'::app_role) THEN
    RAISE EXCEPTION 'forbidden: cannot query role of another user' USING ERRCODE = '42501';
  END IF;
  RETURN public.is_supervisor_or_above(_user_id);
END; $$;

CREATE OR REPLACE FUNCTION public.is_coord_or_above(_user_id uuid DEFAULT auth.uid())
RETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF _user_id IS DISTINCT FROM auth.uid() AND NOT public.has_role(auth.uid(), 'dev'::app_role) THEN
    RAISE EXCEPTION 'forbidden: cannot query role of another user' USING ERRCODE = '42501';
  END IF;
  RETURN public.is_supervisor_or_above(_user_id);
END; $$;

COMMENT ON FUNCTION public.is_admin_or_above(uuid) IS 'RLS-002 hardening (2026-05-22): exige _user_id = auth.uid() para usuarios comuns.';
COMMENT ON FUNCTION public.is_coord_or_above(uuid) IS 'RLS-002 hardening (2026-05-22): exige _user_id = auth.uid() para usuarios comuns.';
