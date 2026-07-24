-- M2: FIX vw_medallion_coverage.display_name_pct
-- BUG: comparava name com fn_normalize_product_name()=UPPER() => 100% falso positivo
-- FIX: predicado de qualidade real
-- NAO altera fn_normalize_product_name (UPPERCASE intencional para product_variants)
CREATE OR REPLACE VIEW public.vw_medallion_coverage AS
 SELECT s.name AS fornecedor, 'silver'::text AS camada, count(*) AS produtos,
    round(((100.0*(sum(CASE WHEN (NULLIF(TRIM(BOTH FROM pp.ncm_code),''::text) IS NOT NULL) THEN 1 ELSE 0 END))::numeric)/(count(*))::numeric),1) AS ncm_pct,
    round(((100.0*(sum(CASE WHEN (jsonb_array_length(COALESCE(pp.materials,'[]'::jsonb))>0) THEN 1 ELSE 0 END))::numeric)/(count(*))::numeric),1) AS materials_pct,
    round(((100.0*(sum(CASE WHEN (jsonb_array_length(COALESCE(pp.tags,'[]'::jsonb))>0) THEN 1 ELSE 0 END))::numeric)/(count(*))::numeric),1) AS tags_pct,
    round(((100.0*(sum(CASE WHEN (COALESCE(array_length(pp.meta_keywords,1),0)>0) THEN 1 ELSE 0 END))::numeric)/(count(*))::numeric),1) AS meta_pct,
    round(((100.0*(sum(CASE WHEN (pp.ipi_rate IS NOT NULL) THEN 1 ELSE 0 END))::numeric)/(count(*))::numeric),1) AS ipi_pct,
    round(((100.0*(sum(CASE WHEN (NULLIF(TRIM(BOTH FROM pp.description),''::text) IS NOT NULL) THEN 1 ELSE 0 END))::numeric)/(count(*))::numeric),1) AS description_pct,
    NULL::numeric AS category_pct, NULL::numeric AS display_name_pct
   FROM (produtos_padronizacao pp JOIN suppliers s ON ((s.id=pp.supplier_id))) GROUP BY s.name
UNION ALL
 SELECT s.name AS fornecedor, 'gold'::text AS camada, count(*) AS produtos,
    round(((100.0*(sum(CASE WHEN (NULLIF(TRIM(BOTH FROM p.ncm_code),''::text) IS NOT NULL) THEN 1 ELSE 0 END))::numeric)/(count(*))::numeric),1) AS ncm_pct,
    round(((100.0*(sum(CASE WHEN ((jsonb_array_length(COALESCE(p.materials,'[]'::jsonb))>0) OR (EXISTS (SELECT 1 FROM product_materials pm WHERE (pm.product_id=p.id)))) THEN 1 ELSE 0 END))::numeric)/(count(*))::numeric),1) AS materials_pct,
    round(((100.0*(sum(CASE WHEN (jsonb_array_length(COALESCE(p.tags,'[]'::jsonb))>0) THEN 1 ELSE 0 END))::numeric)/(count(*))::numeric),1) AS tags_pct,
    round(((100.0*(sum(CASE WHEN (COALESCE(array_length(p.meta_keywords,1),0)>0) THEN 1 ELSE 0 END))::numeric)/(count(*))::numeric),1) AS meta_pct,
    round(((100.0*(sum(CASE WHEN (p.ipi_rate IS NOT NULL) THEN 1 ELSE 0 END))::numeric)/(count(*))::numeric),1) AS ipi_pct,
    round(((100.0*(sum(CASE WHEN (NULLIF(TRIM(BOTH FROM p.description),''::text) IS NOT NULL) THEN 1 ELSE 0 END))::numeric)/(count(*))::numeric),1) AS description_pct,
    round(((100.0*(sum(CASE WHEN (p.category_id IS NOT NULL) THEN 1 ELSE 0 END))::numeric)/(count(*))::numeric),1) AS category_pct,
    round(((100.0*(sum(CASE WHEN (p.name IS NULL OR length(TRIM(p.name))=0 OR p.name LIKE '%  %' OR p.name ~ E'[\\t\\n\\r]' OR length(p.name)>200 OR p.name!~'[A-Za-z0-9]') THEN 1 ELSE 0 END))::numeric)/(NULLIF(count(*),0))::numeric),1) AS display_name_pct
   FROM (products p JOIN suppliers s ON ((s.id=p.supplier_id))) GROUP BY s.name;
