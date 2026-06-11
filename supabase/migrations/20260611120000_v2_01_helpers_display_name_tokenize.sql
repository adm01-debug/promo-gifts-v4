-- V2-01 — Funções base do programa "Rumo ao 10/10" V2
-- fn_display_product_name: sentence-case por segmento ('. ') com preservação de
--   siglas/unidades minerada dos 7.5k nomes reais (USB, LED, ABS, PU, 600D, 16L, A5...)
-- fn_tokenize_product_tags: tokenização PT (>=3 chars, stopwords, dedup, máx 12)
-- fn_safe_jsonb_arr / fn_safe_text_arr: parsers tolerantes (array/objeto/pipe/csv)
-- Validação: full-corpus 7.491 nomes — 0 vazios, 0 não-idempotentes, 0 siglas mutiladas.

CREATE OR REPLACE FUNCTION public.fn_display_product_name(p_name text)
RETURNS text
LANGUAGE plpgsql IMMUTABLE PARALLEL SAFE
SET search_path TO 'public'
AS $function$
DECLARE
  s text;
  seg text;
  parts text[];
  i int;
  pairs text[][] := ARRAY[
    ARRAY['(\d)l\M','\1L'], ARRAY['(\d)d\M','\1D'], ARRAY['(\d)t\M','\1T'],
    ARRAY['(\d)w\M','\1W'], ARRAY['(\d)v\M','\1V'], ARRAY['(\d)gb\M','\1GB'],
    ARRAY['(\d)mah\M','\1mAh'],
    ARRAY['\ma([3-6])\M','A\1'], ARRAY['\mb([5-6])\M','B\1'],
    ARRAY['\musb\M','USB'], ARRAY['\mled\M','LED'], ARRAY['\mabs\M','ABS'],
    ARRAY['\mpvc\M','PVC'], ARRAY['\mpu\M','PU'],   ARRAY['\mpp\M','PP'],
    ARRAY['\mrpet\M','RPET'], ARRAY['\mpet\M','PET'], ARRAY['\meva\M','EVA'],
    ARRAY['\mmdf\M','MDF'], ARRAY['\mtnt\M','TNT'], ARRAY['\muv\M','UV'],
    ARRAY['\mgps\M','GPS'], ARRAY['\mnfc\M','NFC'], ARRAY['\mlcd\M','LCD'],
    ARRAY['\mrgb\M','RGB'], ARRAY['\mcob\M','COB'], ARRAY['\mtv\M','TV'],
    ARRAY['\mfm\M','FM'], ARRAY['\mgg\M','GG'], ARRAY['\mxg\M','XG']
  ];
  pr text[];
BEGIN
  IF p_name IS NULL THEN RETURN NULL; END IF;
  s := btrim(regexp_replace(
         translate(
           replace(replace(replace(replace(p_name, chr(8203),''), chr(8204),''), chr(8205),''), chr(65279),''),
           chr(160)||chr(5760)||chr(8192)||chr(8193)||chr(8194)||chr(8195)||chr(8196)||chr(8197)||chr(8198)||chr(8199)||chr(8200)||chr(8201)||chr(8202)||chr(8232)||chr(8233)||chr(8239)||chr(8287)||chr(12288),
           repeat(' ', 18)),
         '\s+', ' ', 'g'));
  IF s = '' THEN RETURN NULL; END IF;
  s := lower(s);
  parts := string_to_array(s, '. ');
  FOR i IN 1..COALESCE(array_length(parts,1),0) LOOP
    seg := parts[i];
    IF seg <> '' THEN
      parts[i] := upper(left(seg,1)) || substr(seg,2);
    END IF;
  END LOOP;
  s := array_to_string(parts, '. ');
  FOREACH pr SLICE 1 IN ARRAY pairs LOOP
    s := regexp_replace(s, pr[1], pr[2], 'gi');
  END LOOP;
  s := upper(left(s,1)) || substr(s,2);
  RETURN s;
END;
$function$;

CREATE OR REPLACE FUNCTION public.fn_tokenize_product_tags(p_name text)
RETURNS jsonb
LANGUAGE sql IMMUTABLE PARALLEL SAFE
SET search_path TO 'public'
AS $function$
  SELECT COALESCE(jsonb_agg(tok ORDER BY first_ord), '[]'::jsonb)
  FROM (
    SELECT tok, MIN(ord) AS first_ord
    FROM (
      SELECT t.tok, t.ord
      FROM regexp_split_to_table(lower(COALESCE(p_name,'')), '[^a-z0-9áàâãäéèêëíìîïóòôõöúùûüçñ]+')
           WITH ORDINALITY AS t(tok, ord)
    ) x
    WHERE length(tok) >= 3
      AND tok !~ '^[0-9]+$'
      AND tok NOT IN ('para','pelo','pela','pelos','pelas','sobre','entre','cada','como','mais','menos',
                      'este','esta','isso','aquele','aquela','seus','suas','com','por','dos','das','uma',
                      'uns','umas','até','ate','the','and','pçs','pcs','und','unid','tipo','modelo',
                      'unidade','unidades','aprox','aproximadamente')
    GROUP BY tok
    ORDER BY MIN(ord)
    LIMIT 12
  ) y;
$function$;

CREATE OR REPLACE FUNCTION public.fn_safe_jsonb_arr(p_value text)
RETURNS jsonb
LANGUAGE plpgsql IMMUTABLE PARALLEL SAFE
SET search_path TO 'public'
AS $function$
DECLARE
  j jsonb;
BEGIN
  IF p_value IS NULL OR btrim(p_value) = '' THEN RETURN NULL; END IF;
  BEGIN
    j := p_value::jsonb;
    IF jsonb_typeof(j) = 'array' THEN
      RETURN CASE WHEN jsonb_array_length(j) > 0 THEN j ELSE NULL END;
    ELSIF jsonb_typeof(j) = 'object' THEN
      SELECT NULLIF(jsonb_agg(v), '[]'::jsonb) INTO j FROM jsonb_each_text(j) e(k, v) WHERE NULLIF(btrim(v),'') IS NOT NULL;
      RETURN j;
    ELSIF jsonb_typeof(j) = 'string' THEN
      RETURN jsonb_build_array(j #>> '{}');
    END IF;
    RETURN NULL;
  EXCEPTION WHEN OTHERS THEN
    RETURN (
      SELECT NULLIF(COALESCE(jsonb_agg(btrim(e)), '[]'::jsonb), '[]'::jsonb)
      FROM unnest(string_to_array(p_value, CASE WHEN position('|' in p_value) > 0 THEN '|' ELSE ',' END)) e
      WHERE btrim(e) <> ''
    );
  END;
END;
$function$;

CREATE OR REPLACE FUNCTION public.fn_safe_text_arr(p_value text)
RETURNS text[]
LANGUAGE sql IMMUTABLE PARALLEL SAFE
SET search_path TO 'public'
AS $function$
  SELECT CASE
    WHEN public.fn_safe_jsonb_arr(p_value) IS NULL THEN NULL
    ELSE (SELECT array_agg(e #>> '{}') FROM jsonb_array_elements(public.fn_safe_jsonb_arr(p_value)) e)
  END;
$function$;
