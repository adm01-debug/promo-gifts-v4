
-- ════════════════════════════════════════════════════════════════
-- EXTRATOR de cor a partir do título (Só Marcas e fornecedores sem
-- campo de cor). Acha o 1º token de cor do vocabulário e normaliza
-- para a forma canônica (gênero masculino) que casa color_variations.
-- Retorna NULL quando o título não contém cor (kits/peças) — correto.
-- ════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.fn_extract_color_from_title(p_titulo text)
RETURNS text LANGUAGE plpgsql IMMUTABLE AS $$
DECLARE
  v_tok text;
  v_up  text;
BEGIN
  IF p_titulo IS NULL OR TRIM(p_titulo)='' THEN RETURN NULL; END IF;
  v_up := UPPER(p_titulo);

  SELECT m[1] INTO v_tok FROM regexp_matches(v_up,
    '\y(PRET[AO]|BRANC[AO]|AZUL|VERMELH[AO]|VERDE|CINZA|AMAREL[AO]|ROSA|ROX[AO]|LARANJA|BEGE|MARROM|DOURAD[AO]|PRATEAD[AO]|PRATA|NATURAL|BAMBU|MADEIRA|INOX|VINHO|CAQUI|NUDE|TURQUESA|LIL[AÁ]S|FUM[EÊ]|TRANSPARENTE|GRAFITE|CHUMBO|CORAL|MOSTARDA)\y'
  ) m LIMIT 1;

  IF v_tok IS NULL THEN RETURN NULL; END IF;

  -- normaliza gênero/variação → nome canônico (Title Case) de color_variations
  RETURN CASE
    WHEN v_tok LIKE 'PRET%'   THEN 'Preto'
    WHEN v_tok LIKE 'BRANC%'  THEN 'Branco'
    WHEN v_tok LIKE 'VERMELH%' THEN 'Vermelho'
    WHEN v_tok LIKE 'AMAREL%' THEN 'Amarelo'
    WHEN v_tok LIKE 'ROX%'    THEN 'Roxo'
    WHEN v_tok LIKE 'DOURAD%' THEN 'Dourado'
    WHEN v_tok LIKE 'PRATEAD%' THEN 'Prata'
    WHEN v_tok='AZUL'       THEN 'Azul'
    WHEN v_tok='VERDE'      THEN 'Verde'
    WHEN v_tok='CINZA'      THEN 'Cinza'
    WHEN v_tok='ROSA'       THEN 'Rosa'
    WHEN v_tok='LARANJA'    THEN 'Laranja'
    WHEN v_tok='BEGE'       THEN 'Bege'
    WHEN v_tok='MARROM'     THEN 'Marrom'
    WHEN v_tok='PRATA'      THEN 'Prata'
    WHEN v_tok='NATURAL'    THEN 'Natural'
    WHEN v_tok='BAMBU'      THEN 'Bambu'
    WHEN v_tok='MADEIRA'    THEN 'Madeira'
    WHEN v_tok='INOX'       THEN 'Inox'
    WHEN v_tok='VINHO'      THEN 'Vinho'
    WHEN v_tok='CAQUI'      THEN 'Caqui'
    WHEN v_tok='NUDE'       THEN 'Nude'
    WHEN v_tok='TURQUESA'   THEN 'Turquesa'
    WHEN v_tok LIKE 'LIL%'  THEN 'Lilás'
    WHEN v_tok LIKE 'FUM%'  THEN 'Fumê'
    WHEN v_tok='TRANSPARENTE' THEN 'Transparente'
    WHEN v_tok='GRAFITE'    THEN 'Grafite'
    WHEN v_tok='CHUMBO'     THEN 'Chumbo'
    WHEN v_tok='CORAL'      THEN 'Coral'
    WHEN v_tok='MOSTARDA'   THEN 'Mostarda'
    ELSE initcap(v_tok)
  END;
END;
$$;

COMMENT ON FUNCTION public.fn_extract_color_from_title IS
  'Extrai cor do título (vocabulário + normalização de gênero) p/ fornecedores sem campo de cor (Só Marcas). NULL quando não há cor.';
