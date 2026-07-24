
CREATE OR REPLACE FUNCTION public.fn_match_supplier_color(
  p_supplier_id uuid, p_code text, p_api_id text, p_name text, p_hex text
) RETURNS TABLE(color_id uuid, color_name text, color_code text, color_hex text)
LANGUAGE plpgsql STABLE AS $$
BEGIN
  RETURN QUERY
  SELECT sc.id, sc.name::text, sc.code::text, sc.hex_code::text
  FROM public.supplier_colors sc
  WHERE sc.supplier_id = p_supplier_id AND sc.is_active = TRUE
    AND (
         (p_api_id IS NOT NULL AND sc.api_color_id = p_api_id)
      OR (p_code   IS NOT NULL AND UPPER(TRIM(sc.code)) = UPPER(TRIM(p_code)))
      OR (p_name   IS NOT NULL AND UPPER(TRIM(sc.name)) = UPPER(TRIM(p_name)))
      OR (p_hex    IS NOT NULL AND UPPER(TRIM(sc.hex_code)) = UPPER(TRIM(p_hex)))
    )
  ORDER BY
    (CASE WHEN p_api_id IS NOT NULL AND sc.api_color_id = p_api_id THEN 0
          WHEN p_code   IS NOT NULL AND UPPER(TRIM(sc.code)) = UPPER(TRIM(p_code)) THEN 1
          WHEN p_name   IS NOT NULL AND UPPER(TRIM(sc.name)) = UPPER(TRIM(p_name)) THEN 2
          ELSE 3 END)
  LIMIT 1;
END;
$$;
