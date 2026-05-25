-- LOTE F 1/4
ALTER TABLE public.bot_detection_log ADD COLUMN IF NOT EXISTS blocked boolean NOT NULL DEFAULT false;

CREATE OR REPLACE FUNCTION public.record_public_token_failure(_resource_type text, _resource_id text, _attempted_token text, _ip text, _ua text, _reason text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE _recent_failures int;
BEGIN
  INSERT INTO public.public_token_failures (resource_type,resource_id,attempted_token,ip_address,user_agent,reason)
  VALUES (_resource_type,_resource_id,_attempted_token,_ip,_ua,_reason);
  IF _resource_id IS NULL THEN RETURN; END IF;
  SELECT count(*) INTO _recent_failures FROM public.public_token_failures
  WHERE resource_type=_resource_type AND resource_id=_resource_id AND created_at > now()-interval '1 hour';
  IF _recent_failures >= 5 THEN
    IF _resource_type='quote' THEN
      UPDATE public.quote_approval_tokens SET status='expired',updated_at=now() WHERE quote_id=_resource_id AND status='active';
    ELSIF _resource_type='kit' THEN
      UPDATE public.kit_share_tokens SET status='expired',updated_at=now() WHERE kit_id::text=_resource_id AND status='active';
    END IF;
  END IF;
END; $$;
REVOKE EXECUTE ON FUNCTION public.record_public_token_failure(text,text,text,text,text,text) FROM PUBLIC, anon, authenticated;
