-- ============================================================
-- MIGRAÇÃO: 20260605001000_harden_fn_clean_spot_name_unicode_spaces.sql
-- DATA:     2026-06-05
-- MOTIVO:   🟢 MELHORIA preventiva. A versão anterior de fn_clean_spot_name
--           colapsava apenas espaços ASCII (`\s` = espaço/tab/quebra), deixando
--           passar espaços unicode (notadamente NBSP U+00A0, espaço ideográfico
--           U+3000, NNBSP U+202F, en/em spaces U+2000–U+200A) e caracteres de
--           largura zero (U+200B/200C/200D/FEFF). Isso gerou nomes com NBSP
--           invisível (ex.: 'esmalte para') que nem o pipeline normalizava.
-- SOLUÇÃO:  Torna a limpeza robusta a unicode:
--             1) remove caracteres de largura zero (ZWSP/ZWNJ/ZWJ/BOM);
--             2) converte (via translate) todos os espaços unicode conhecidos em
--                espaço ASCII normal;
--             3) colapsa `\s+` -> ' ', faz btrim e sentence-case (1ª maiúscula).
--           Comportamento para texto ASCII é idêntico ao anterior (idempotente
--           sobre o acervo já normalizado). NULL/'' -> NULL.
-- ============================================================

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
        -- 1) remove caracteres de largura zero: U+200B, U+200C, U+200D, U+FEFF
        replace(replace(replace(replace(p_name, chr(8203), ''), chr(8204), ''), chr(8205), ''), chr(65279), ''),
        -- 2) espaços unicode -> espaço ASCII (18 code points, mesma contagem do destino)
        --    U+00A0 U+1680 U+2000..U+200A U+2028 U+2029 U+202F U+205F U+3000
        chr(160)||chr(5760)||chr(8192)||chr(8193)||chr(8194)||chr(8195)||chr(8196)||chr(8197)||chr(8198)||chr(8199)||chr(8200)||chr(8201)||chr(8202)||chr(8232)||chr(8233)||chr(8239)||chr(8287)||chr(12288),
        repeat(' ', 18)
      ),
      '\s+', ' ', 'g')) AS s
  ) t;
$function$;

COMMENT ON FUNCTION public.fn_clean_spot_name(text) IS
'v2.1 2026-06-05: limpeza de nome robusta a unicode (remove zero-width; normaliza NBSP/U+3000/U+202F/en-em spaces para espaço ASCII) + colapso/btrim + sentence-case. ASCII inalterado.';
