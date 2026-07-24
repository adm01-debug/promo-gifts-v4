
-- ════════════════════════════════════════════════════════════════
-- EQUIVALÊNCIA DE COR: resolve a linha de supplier_colors a partir
-- do que vem no raw. Chave de casamento por fornecedor (provado nos dados):
--   Spot → code (= ColorCode)
--   XBZ  → api_color_id (= CorWebPrincipalId); fallback name (= CorWebPrincipal)
--   Asia → name (= var_cor_nome); fallback hex
--   geral→ tenta code, depois api_color_id, depois name, depois hex
-- Retorna (color_id, color_name canônico, color_code, color_hex).
-- ════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.fn_match_supplier_color(
  p_supplier_id uuid,
  p_code text,        -- código de cor cru (ColorCode, sufixo do CodigoComposto…)
  p_api_id text,      -- id de cor da API (CorWebPrincipalId…)
  p_name text,        -- nome de cor cru (ColorName, CorWebPrincipal, var_cor_nome…)
  p_hex text          -- hex cru, se houver
) RETURNS TABLE(color_id uuid, color_name text, color_code text, color_hex text)
LANGUAGE plpgsql STABLE AS $$
BEGIN
  RETURN QUERY
  SELECT sc.id, sc.name, sc.code, sc.hex_code
  FROM public.supplier_colors sc
  WHERE sc.supplier_id = p_supplier_id AND sc.is_active = TRUE
    AND (
         (p_api_id IS NOT NULL AND sc.api_color_id = p_api_id)
      OR (p_code   IS NOT NULL AND UPPER(TRIM(sc.code)) = UPPER(TRIM(p_code)))
      OR (p_name   IS NOT NULL AND UPPER(TRIM(sc.name)) = UPPER(TRIM(p_name)))
      OR (p_hex    IS NOT NULL AND UPPER(TRIM(sc.hex_code)) = UPPER(TRIM(p_hex)))
    )
  ORDER BY
    -- prioridade: api_id > code > name > hex (casamento mais específico primeiro)
    (CASE WHEN p_api_id IS NOT NULL AND sc.api_color_id = p_api_id THEN 0
          WHEN p_code   IS NOT NULL AND UPPER(TRIM(sc.code)) = UPPER(TRIM(p_code)) THEN 1
          WHEN p_name   IS NOT NULL AND UPPER(TRIM(sc.name)) = UPPER(TRIM(p_name)) THEN 2
          ELSE 3 END)
  LIMIT 1;
END;
$$;

COMMENT ON FUNCTION public.fn_match_supplier_color IS
  'Resolve supplier_colors.id por fornecedor com fallback api_id>code>name>hex. Base da equivalência de cor na silver.';
