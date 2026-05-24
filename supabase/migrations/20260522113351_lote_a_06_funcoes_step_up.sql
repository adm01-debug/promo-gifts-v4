-- LOTE A 6/6 - step-up auth functions
CREATE OR REPLACE FUNCTION public.start_step_up_challenge(_action text, _target_ref text DEFAULT NULL)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE
  v_id uuid;
  v_uid uuid := auth.uid();
  v_otp_hash text;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Nao autenticado'; END IF;

  v_otp_hash := encode(digest(gen_random_uuid()::text || clock_timestamp()::text || v_uid::text, 'sha256'), 'hex');

  INSERT INTO public.step_up_challenges (user_id, action, target_ref, otp_hash)
  VALUES (v_uid, _action, _target_ref, v_otp_hash)
  RETURNING id INTO v_id;
  RETURN v_id;
END; $$;
REVOKE EXECUTE ON FUNCTION public.start_step_up_challenge(text,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.start_step_up_challenge(text,text) TO authenticated;

CREATE OR REPLACE FUNCTION public.verify_step_up_password(_challenge_id uuid, _password_attempt text)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_password_ok boolean;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Nao autenticado';
  END IF;

  SELECT EXISTS (
    SELECT 1
    FROM auth.users
    WHERE id = v_uid
      AND encrypted_password = crypt(_password_attempt, encrypted_password)
  ) INTO v_password_ok;

  IF NOT v_password_ok THEN
    RETURN false;
  END IF;

  UPDATE public.step_up_challenges SET password_verified=true
  WHERE id=_challenge_id AND user_id=v_uid AND consumed=false AND expires_at > now();
  RETURN FOUND;
END; $$;
REVOKE EXECUTE ON FUNCTION public.verify_step_up_password(uuid,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.verify_step_up_password(uuid,text) TO authenticated;
