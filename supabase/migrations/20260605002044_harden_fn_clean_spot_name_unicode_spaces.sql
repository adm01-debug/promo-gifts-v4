
CREATE OR REPLACE FUNCTION public.fn_clean_spot_name(p_name text)
 RETURNS text
 LANGUAGE sql
 IMMUTABLE
 SET search_path TO 'public'
AS $function$
  SELECT CASE
    WHEN s IS NULL OR s = '' THEN NULLIF(s, '')
    ELSE upper(left(s, 1)) || lower(substr(s, 2))
  END
  FROM (
    SELECT btrim(regexp_replace(
      translate(
        replace(replace(replace(replace(p_name, chr(8203), ''), chr(8204), ''), chr(8205), ''), chr(65279), ''),
        chr(160)||chr(5760)||chr(8192)||chr(8193)||chr(8194)||chr(8195)||chr(8196)||chr(8197)||chr(8198)||chr(8199)||chr(8200)||chr(8201)||chr(8202)||chr(8232)||chr(8233)||chr(8239)||chr(8287)||chr(12288),
        repeat(' ', 18)
      ),
      '\s+', ' ', 'g')) AS s
  ) t;
$function$;

COMMENT ON FUNCTION public.fn_clean_spot_name(text) IS
'v2.1 2026-06-05: limpeza de nome robusta a unicode (remove zero-width; normaliza NBSP/U+3000/U+202F/en-em spaces para espaco ASCII) + colapso/btrim + sentence-case. ASCII inalterado.';
