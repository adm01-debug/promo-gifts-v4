
-- ════════════════════════════════════════════════════════════════
-- MATCHER de cor CANÔNICA: resolve color_variations.id a partir de
-- nome (case-insensitive) com hex de fallback — como o legado faz
-- (96,4% das variantes legadas casam por nome). Retorna NULL se não casar.
-- color_variations é a tabela canônica REFERENCIADA por product_variants.color_id.
-- ════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.fn_match_canonical_color(p_name text, p_hex text)
RETURNS uuid LANGUAGE plpgsql STABLE AS $$
DECLARE v_id uuid;
BEGIN
  IF (p_name IS NULL OR TRIM(p_name)='') AND (p_hex IS NULL OR TRIM(p_hex)='') THEN
    RETURN NULL;
  END IF;
  SELECT cv.id INTO v_id
  FROM public.color_variations cv
  WHERE cv.is_active = TRUE
    AND (
         (p_name IS NOT NULL AND UPPER(TRIM(cv.name)) = UPPER(TRIM(p_name)))
      OR (p_hex  IS NOT NULL AND UPPER(TRIM(cv.hex_code)) = UPPER(TRIM(p_hex)))
    )
  ORDER BY (CASE WHEN p_name IS NOT NULL AND UPPER(TRIM(cv.name))=UPPER(TRIM(p_name)) THEN 0 ELSE 1 END),
           cv.sort_order NULLS LAST
  LIMIT 1;
  RETURN v_id;
END;
$$;

COMMENT ON FUNCTION public.fn_match_canonical_color IS
  'Resolve color_variations.id (cor canônica global) por nome>hex. NULL se não casar. Espelha a lógica de resolução de cor do pipeline legado.';
