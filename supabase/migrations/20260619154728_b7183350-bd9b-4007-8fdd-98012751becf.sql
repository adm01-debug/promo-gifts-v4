CREATE OR REPLACE FUNCTION public.is_dnd_active(p_user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  dnd_enabled boolean;
  dnd_start time;
  dnd_end time;
  current_t time;
BEGIN
  SELECT
    COALESCE((preferences->>'dnd_enabled')::boolean, false),
    (preferences->>'dnd_start')::time,
    (preferences->>'dnd_end')::time
  INTO dnd_enabled, dnd_start, dnd_end
  FROM public.profiles
  WHERE user_id = p_user_id;

  IF NOT dnd_enabled OR dnd_start IS NULL OR dnd_end IS NULL THEN
    RETURN false;
  END IF;

  current_t := localtime;

  IF dnd_start <= dnd_end THEN
    RETURN current_t BETWEEN dnd_start AND dnd_end;
  END IF;

  RETURN current_t >= dnd_start OR current_t <= dnd_end;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.is_dnd_active() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.is_dnd_active(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.is_dnd_active(uuid) TO service_role;