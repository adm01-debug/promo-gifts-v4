-- V2-02 — fn_enrich_padronizacao: enriquecimento canônico da Silver.
-- Semântica: SÓ preenche o que está NULL/vazio. Nunca sobrescreve dado do fornecedor.
-- Cadeias: description←raw · materials←raw|extração · tags←raw∪tokenização ·
--          ipi←ncm_codes|moda-irmãos · ncm←prefixo-nome inequívoco · meta←tags.
-- Chamada ao final de fn_standardize_raw e pelos retroativos.
-- Validação: 25 produtos (5/fornecedor) — 0 sobrescritas, 32 preenchimentos.

CREATE OR REPLACE FUNCTION public.fn_enrich_padronizacao(p_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SET search_path TO 'public', 'extensions'
AS $function$
DECLARE
  pp     public.produtos_padronizacao%ROWTYPE;
  v_raw  jsonb;
  v_filled jsonb := '{}'::jsonb;
  v_tags jsonb;
  v_raw_tags jsonb;
  v_mats jsonb;
  v_mat_txt text;
  v_ipi  numeric;
  v_ncm  text;
  v_desc text;
  v_prefix text;
BEGIN
  SELECT * INTO pp FROM public.produtos_padronizacao WHERE id = p_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'pad_nao_encontrado');
  END IF;

  SELECT raw_data INTO v_raw FROM public.supplier_products_raw WHERE id = pp.raw_id;

  IF NULLIF(TRIM(COALESCE(pp.description,'')),'') IS NULL AND v_raw IS NOT NULL THEN
    v_desc := NULLIF(TRIM(COALESCE(
      v_raw->>'descricao', v_raw->>'Descricao', v_raw->>'Description', v_raw->>'DESCRICAO')), '');
    IF v_desc IS NOT NULL THEN
      v_filled := v_filled || jsonb_build_object('description', true);
    END IF;
  END IF;

  IF jsonb_array_length(COALESCE(pp.materials, '[]'::jsonb)) = 0 THEN
    v_mats := public.fn_safe_jsonb_arr(COALESCE(
      v_raw->>'material', v_raw->>'materiais', v_raw->>'Materials', v_raw->>'MATERIAL'));
    IF v_mats IS NULL THEN
      v_mat_txt := public.extract_xbz_material_primary(pp.name, pp.description);
      IF v_mat_txt IS NOT NULL THEN
        v_mats := jsonb_build_array(v_mat_txt);
      END IF;
    END IF;
    IF v_mats IS NOT NULL THEN
      v_filled := v_filled || jsonb_build_object('materials', true);
    END IF;
  END IF;

  IF jsonb_array_length(COALESCE(pp.tags, '[]'::jsonb)) = 0 THEN
    v_raw_tags := public.fn_safe_jsonb_arr(v_raw->>'tags');
    SELECT COALESCE(jsonb_agg(tok ORDER BY first_ord), '[]'::jsonb) INTO v_tags
    FROM (
      SELECT tok, MIN(ord) AS first_ord FROM (
        SELECT e.value #>> '{}' AS tok, e.ordinality AS ord
        FROM jsonb_array_elements(COALESCE(v_raw_tags,'[]'::jsonb)) WITH ORDINALITY e
        UNION ALL
        SELECT e2.value #>> '{}', 100 + e2.ordinality
        FROM jsonb_array_elements(public.fn_tokenize_product_tags(pp.name)) WITH ORDINALITY e2
      ) u
      WHERE NULLIF(TRIM(tok),'') IS NOT NULL
      GROUP BY tok ORDER BY MIN(ord) LIMIT 16
    ) t;
    IF jsonb_array_length(v_tags) > 0 THEN
      v_filled := v_filled || jsonb_build_object('tags', true);
    ELSE
      v_tags := NULL;
    END IF;
  END IF;

  IF pp.ipi_rate IS NULL AND NULLIF(TRIM(COALESCE(pp.ncm_code,'')),'') IS NOT NULL THEN
    v_ipi := public.fn_get_ncm_ipi_rate(pp.ncm_code);
    IF v_ipi IS NULL THEN
      SELECT MIN(x.ipi_rate) INTO v_ipi
      FROM public.produtos_padronizacao x
      WHERE x.ncm_code = pp.ncm_code AND x.ipi_rate IS NOT NULL
      HAVING COUNT(DISTINCT x.ipi_rate) = 1;
    END IF;
    IF v_ipi IS NOT NULL THEN
      v_filled := v_filled || jsonb_build_object('ipi_rate', v_ipi);
    END IF;
  END IF;

  IF NULLIF(TRIM(COALESCE(pp.ncm_code,'')),'') IS NULL AND pp.name IS NOT NULL THEN
    v_prefix := (SELECT string_agg(w, ' ') FROM (
      SELECT w FROM regexp_split_to_table(UPPER(pp.name), '\s+') WITH ORDINALITY t(w, o)
      WHERE o <= 2 ORDER BY o) z);
    IF v_prefix IS NOT NULL AND LENGTH(v_prefix) >= 5 THEN
      SELECT MIN(x.ncm_code) INTO v_ncm
      FROM public.produtos_padronizacao x
      WHERE x.supplier_id = pp.supplier_id
        AND x.id <> pp.id
        AND x.ncm_code IS NOT NULL
        AND UPPER(x.name) LIKE v_prefix || '%'
      HAVING COUNT(DISTINCT x.ncm_code) = 1;
      IF v_ncm IS NOT NULL THEN
        v_filled := v_filled || jsonb_build_object('ncm_code', v_ncm);
      END IF;
    END IF;
  END IF;

  UPDATE public.produtos_padronizacao SET
    description   = CASE WHEN v_desc IS NOT NULL THEN v_desc ELSE description END,
    materials     = CASE WHEN v_mats IS NOT NULL THEN v_mats ELSE materials END,
    tags          = CASE WHEN v_tags IS NOT NULL THEN v_tags ELSE tags END,
    ipi_rate      = COALESCE(ipi_rate, v_ipi),
    ncm_code      = COALESCE(ncm_code, v_ncm),
    meta_keywords = CASE
                      WHEN COALESCE(array_length(meta_keywords,1),0) = 0 THEN
                        COALESCE(
                          (SELECT array_agg(e #>> '{}') FROM jsonb_array_elements(
                             COALESCE(v_tags, NULLIF(tags,'[]'::jsonb))) e),
                          meta_keywords)
                      ELSE meta_keywords
                    END,
    updated_at    = now()
  WHERE id = p_id
    AND (v_desc IS NOT NULL OR v_mats IS NOT NULL OR v_tags IS NOT NULL
         OR v_ipi IS NOT NULL OR v_ncm IS NOT NULL
         OR COALESCE(array_length(meta_keywords,1),0) = 0);

  RETURN jsonb_build_object('success', true, 'pad_id', p_id, 'filled', v_filled);
END;
$function$;
