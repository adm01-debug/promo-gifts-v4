-- ════════════════════════════════════════════════════════════════
-- SILVER DE-PARA — Fase 4/6: derivação do PAI via de-para
-- fn_derive_parent_ref deixa de ter regras hardcoded por UUID e passa a LER a
-- regra do de-para (supplier_field_mappings, target_table='product_variants',
-- target_field='parent_reference'), semeada na Fase 3:
--   • source_field  = chave autoritativa do pai no raw (ProdReference,
--                     CodigoAmigavel) ou o sentinela '_none' quando o
--                     fornecedor não tem (a coluna é NOT NULL);
--   • transform_config.fallback = estratégia quando a chave está ausente/vazia:
--       'identity'                 → o próprio variant_ref é o pai (Spot, Só Marcas)
--       'strip_hyphen_suffix'      → corta após o ÚLTIMO hífen; sem hífen = pai (XBZ, default)
--       'asia_hyphen_or_suffix_P'  → com hífen corta; sem hífen acrescenta 'P' (Asia)
--
-- Comportamento IDÊNTICO ao da versão hardcoded (20260605161000) por construção.
-- Passa de IMMUTABLE → STABLE (lê tabela). Sem uso em índice/coluna gerada
-- (verificado). Mantém search_path e o guard de variant_ref nulo/vazio.
-- ════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.fn_derive_parent_ref(
  p_supplier_id uuid, p_variant_ref text, p_raw jsonb
)
RETURNS text LANGUAGE plpgsql STABLE
SET search_path TO 'public'
AS $function$
DECLARE
  v_src      text;
  v_cfg      jsonb;
  v_fallback text;
  v_explicit text;
BEGIN
  IF p_variant_ref IS NULL OR TRIM(p_variant_ref) = '' THEN
    RETURN NULL;
  END IF;

  SELECT source_field, transform_config
    INTO v_src, v_cfg
  FROM public.supplier_field_mappings
  WHERE supplier_id = p_supplier_id
    AND target_table = 'product_variants'
    AND target_field = 'parent_reference'
    AND is_active = TRUE
  ORDER BY priority
  LIMIT 1;

  v_fallback := COALESCE(v_cfg->>'fallback', 'strip_hyphen_suffix');

  -- 1) chave autoritativa do pai no raw, se configurada e preenchida
  -- ('_none' = sentinela "sem chave"; campos sintéticos '_*' não vêm do raw)
  IF v_src IS NOT NULL AND v_src NOT LIKE '\_%' THEN
    v_explicit := NULLIF(TRIM(p_raw->>v_src), '');
    IF v_explicit IS NOT NULL THEN
      RETURN v_explicit;
    END IF;
  END IF;

  -- 2) fallback por estratégia
  IF v_fallback = 'identity' THEN
    RETURN p_variant_ref;

  ELSIF v_fallback = 'asia_hyphen_or_suffix_P' THEN
    IF position('-' IN p_variant_ref) > 0 THEN
      RETURN regexp_replace(p_variant_ref, '-[^-]*$', '');
    ELSE
      RETURN p_variant_ref || 'P';
    END IF;

  ELSE  -- 'strip_hyphen_suffix' (default)
    IF position('-' IN p_variant_ref) > 0 THEN
      RETURN regexp_replace(p_variant_ref, '-[^-]*$', '');
    END IF;
    RETURN p_variant_ref;
  END IF;
END;
$function$;

COMMENT ON FUNCTION public.fn_derive_parent_ref(uuid, text, jsonb) IS
  'Deriva a referência do produto-pai a partir do de-para (parent_reference): chave autoritativa no raw + estratégia de fallback. Config-driven; substitui as regras hardcoded por fornecedor.';
