-- M6: v_products_name_audit - view de auditoria de qualidade de products.name
CREATE OR REPLACE VIEW public.v_products_name_audit AS
WITH quality AS (
  SELECT p.id AS product_id, p.sku, p.name, s.name AS supplier_name, p.is_active, p.slug,
    length(p.name) AS name_len, 'name'=ANY(COALESCE(p.locked_fields,'{}')) AS name_is_locked,
    fn_product_name_quality_score(p.name) AS quality_json
  FROM products p LEFT JOIN suppliers s ON s.id=p.supplier_id
)
SELECT product_id, sku, name, supplier_name, is_active, slug, name_len, name_is_locked,
  (quality_json->>'score')::integer AS quality_score, quality_json->>'grade' AS quality_grade,
  quality_json->'issues' AS issues,
  (quality_json->'issues')?'double_spaces' AS has_double_spaces,
  (quality_json->'issues')?'leading_trailing_spaces' AS has_leading_trailing_spaces,
  (quality_json->'issues')?'contains_tabs_newlines' AS has_tabs_newlines,
  (quality_json->'issues')?'too_long_over_150' AS is_too_long,
  (quality_json->'issues')?'long_100_to_150' AS is_moderately_long,
  (quality_json->'issues')?'too_short_under_8' AS is_too_short,
  (quality_json->'issues')?'all_uppercase_variant_style' AS is_all_uppercase,
  (quality_json->'issues')?'no_alphanumeric' AS has_no_alphanumeric,
  (quality_json->'issues')?'curly_quotes' AS has_curly_quotes,
  (SELECT COUNT(*) FROM products p2 WHERE p2.name=quality.name AND p2.id<>quality.product_id) AS duplicate_name_count
FROM quality WHERE (quality_json->'issues')<>'[]'::jsonb
ORDER BY (quality_json->>'score')::integer ASC, is_active DESC, name_len DESC;
COMMENT ON VIEW public.v_products_name_audit IS 'Auditoria qualidade products.name. Criado M6 2026-06-23.';
