
-- coercor booleano robusto: trata sim/não/true/false/1/0/s/n
CREATE OR REPLACE FUNCTION public.fn_safe_bool(p text)
RETURNS boolean LANGUAGE plpgsql IMMUTABLE AS $$
DECLARE v text;
BEGIN
  IF p IS NULL OR TRIM(p)='' THEN RETURN NULL; END IF;
  v := lower(unaccent(TRIM(p)));
  IF v IN ('sim','s','true','t','1','yes','y','ativo','active') THEN RETURN TRUE; END IF;
  IF v IN ('nao','n','false','f','0','no','inativo','inactive') THEN RETURN FALSE; END IF;
  RETURN NULL;
EXCEPTION WHEN OTHERS THEN
  -- unaccent pode não existir; fallback sem acento
  v := lower(TRIM(p));
  IF v IN ('sim','s','true','t','1','yes','y','ativo') THEN RETURN TRUE; END IF;
  IF v IN ('nao','não','n','false','f','0','no','inativo') THEN RETURN FALSE; END IF;
  RETURN NULL;
END; $$;
