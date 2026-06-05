
-- Helper de coerção segura texto→integer (aceita "0.0", "510.0000", vírgula, vazio)
CREATE OR REPLACE FUNCTION public.fn_safe_int(p text)
RETURNS integer LANGUAGE plpgsql IMMUTABLE AS $$
DECLARE v numeric;
BEGIN
  IF p IS NULL OR TRIM(p)='' THEN RETURN NULL; END IF;
  v := replace(TRIM(p), ',', '.')::numeric;
  RETURN trunc(v)::integer;
EXCEPTION WHEN OTHERS THEN RETURN NULL;
END; $$;

CREATE OR REPLACE FUNCTION public.fn_safe_num(p text)
RETURNS numeric LANGUAGE plpgsql IMMUTABLE AS $$
BEGIN
  IF p IS NULL OR TRIM(p)='' THEN RETURN NULL; END IF;
  RETURN replace(TRIM(p), ',', '.')::numeric;
EXCEPTION WHEN OTHERS THEN RETURN NULL;
END; $$;
