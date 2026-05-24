-- LOTE A 5/6 - funcoes quote_approval_tokens
CREATE OR REPLACE FUNCTION public.get_quote_token_by_value(_token text)
RETURNS SETOF public.quote_approval_tokens LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS
$$ SELECT * FROM public.quote_approval_tokens WHERE token = _token LIMIT 1; $$;
REVOKE EXECUTE ON FUNCTION public.get_quote_token_by_value(text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_quote_token_by_value(text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.get_quote_token_by_value(text) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.get_quote_token_by_value(text) TO anon;

CREATE OR REPLACE FUNCTION public.submit_quote_response(_token text, _response text, _response_notes text DEFAULT NULL)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF _response NOT IN ('approved','rejected') THEN RAISE EXCEPTION 'Invalid response value'; END IF;
  UPDATE public.quote_approval_tokens SET response=_response, response_notes=_response_notes, responded_at=now(), status='responded', updated_at=now()
  WHERE token=_token AND status='active' AND (expires_at IS NULL OR expires_at > now()) AND responded_at IS NULL;
  RETURN FOUND;
END; $$;
REVOKE EXECUTE ON FUNCTION public.submit_quote_response(text,text,text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.submit_quote_response(text,text,text) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.submit_quote_response(text,text,text) TO anon;
