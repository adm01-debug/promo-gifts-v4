-- ════════════════════════════════════════════════════════════════
-- SILVER DE-PARA — Fase 2/6: helper de hex de Só Marcas
-- A cor de Só Marcas não vem em campo próprio: o nome é derivado do título
-- (fn_extract_color_from_title) e o hex é resolvido na rede `produtos_similares`
-- (string "REF|#HEX;REF2|#HEX2;..."). Este helper é GENÉRICO e supplier-agnostic
-- — recebe a string e a referência, devolve o hex casado (ou NULL). Assim o de-para
-- de Só Marcas pode apontar color_hex para um campo sintético `_sm_hex` calculado
-- por esta função, sem nenhum branch por fornecedor em fn_standardize_variant.
-- Replica exatamente a lógica que estava embutida na função (silver_08g).
-- ════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.fn_sm_hex_from_similares(p_similares text, p_ref text)
RETURNS text LANGUAGE sql IMMUTABLE
SET search_path TO 'public'
AS $function$
  SELECT split_part(item, '|', 2)
  FROM unnest(string_to_array(COALESCE(p_similares, ''), ';')) AS item
  WHERE split_part(item, '|', 1) = p_ref
    AND split_part(item, '|', 2) ~* '^#[0-9a-f]{6}$'
  LIMIT 1;
$function$;

COMMENT ON FUNCTION public.fn_sm_hex_from_similares(text, text) IS
  'Resolve o hex (#RRGGBB) de uma referência dentro da rede produtos_similares de Só Marcas (formato REF|#HEX;...). '
  'Genérico/supplier-agnostic; base do campo sintético _sm_hex no de-para de variante.';
