-- Migration 041: Security fixes
--   1. fn_super_filtro was leaking products.cost_price to anon callers.
--      v_products_public correctly returns NULL::numeric AS cost_price but this
--      SECURITY DEFINER RPC bypassed that, exposing real cost data.
--      Fix: null out cost_price in base CTE and final SELECT.
--   2. fn_get_category_breadcrumb can be SECURITY INVOKER because anon already
--      has SELECT on the categories table → removes one anon_security_definer finding.

DO $migration$
BEGIN
  RAISE NOTICE '[041] Applying: fn_super_filtro cost_price redaction + fn_get_category_breadcrumb SECURITY INVOKER';
END;
$migration$;

-- ============================================================
-- FIX 1: fn_super_filtro — redact cost_price for anon callers
-- ============================================================
CREATE OR REPLACE FUNCTION public.fn_super_filtro(
  p_search_term      text        DEFAULT NULL::text,
  p_category_slug    text        DEFAULT NULL::text,
  p_category_id      uuid        DEFAULT NULL::uuid,
  p_brands           text[]      DEFAULT NULL::text[],
  p_only_in_stock    boolean     DEFAULT false,
  p_min_price        numeric     DEFAULT NULL::numeric,
  p_max_price        numeric     DEFAULT NULL::numeric,
  p_target_audiences text[]      DEFAULT NULL::text[],
  p_is_kit           boolean     DEFAULT NULL::boolean,
  p_is_textil        boolean     DEFAULT NULL::boolean,
  p_is_thermal       boolean     DEFAULT NULL::boolean,
  p_has_gift_box     boolean     DEFAULT NULL::boolean,
  p_material_groups  text[]      DEFAULT NULL::text[],
  p_technique_groups text[]      DEFAULT NULL::text[],
  p_color_groups     text[]      DEFAULT NULL::text[],
  p_date_slugs       text[]      DEFAULT NULL::text[],
  p_endomarketing    boolean     DEFAULT NULL::boolean,
  p_limit            integer     DEFAULT 50,
  p_offset           integer     DEFAULT 0,
  p_sort             text        DEFAULT 'name_asc'::text
)
RETURNS TABLE(
  id                 uuid,
  name               text,
  sku                text,
  slug               text,
  short_description  text,
  brand              character varying,
  sale_price         numeric,
  cost_price         numeric,   -- always NULL — intentional security redaction
  min_quantity       integer,
  stock_quantity     integer,
  is_stockout        boolean,
  is_kit             boolean,
  is_textil          boolean,
  is_thermal         boolean,
  is_featured        boolean,
  is_bestseller      boolean,
  is_new             boolean,
  has_gift_box       boolean,
  target_audience    text[],
  primary_image_url  text,
  og_image_url       text,
  set_image_url      text,
  category_id        uuid,
  category_name      text,
  category_slug      text,
  total_count        bigint
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'extensions'
AS $fn_super_filtro$
DECLARE
  v_search_normalized  text;
  v_tsquery            tsquery;
  v_category_uuid      uuid;
  v_category_provided  boolean := false;
  v_limit              integer := GREATEST(0, LEAST(COALESCE(p_limit, 50), 1000));
  v_offset             integer := GREATEST(0, COALESCE(p_offset, 0));
BEGIN
  IF p_search_term IS NOT NULL AND length(trim(p_search_term)) > 0 THEN
    v_search_normalized := left(lower(unaccent(trim(p_search_term))), 200);
    BEGIN
      v_tsquery := websearch_to_tsquery('portuguese', v_search_normalized);
    EXCEPTION WHEN OTHERS THEN v_tsquery := NULL; END;
    PERFORM set_config('pg_trgm.similarity_threshold', '0.2', true);
  END IF;

  IF p_category_id IS NOT NULL THEN
    v_category_uuid     := p_category_id;
    v_category_provided := true;
  ELSIF p_category_slug IS NOT NULL THEN
    v_category_provided := true;
    SELECT c.id INTO v_category_uuid FROM categories c WHERE c.slug = p_category_slug LIMIT 1;
  END IF;

  RETURN QUERY
  WITH
  mat_filter AS (
    SELECT DISTINCT pm.product_id FROM product_materials pm
    JOIN material_types mt ON mt.id=pm.material_id JOIN material_groups mg ON mg.id=mt.group_id
    WHERE p_material_groups IS NOT NULL AND array_length(p_material_groups,1) > 0
      AND mg.name = ANY(p_material_groups) AND pm.is_active=true
  ),
  tech_filter AS (
    SELECT DISTINCT pat.product_id FROM print_area_techniques pat
    JOIN tabela_preco_gravacao_oficial tpgo ON tpgo.id=pat.tabela_preco_id
    WHERE p_technique_groups IS NOT NULL AND array_length(p_technique_groups,1) > 0
      AND tpgo.grupo_tecnica = ANY(p_technique_groups) AND pat.is_active=true
  ),
  color_filter AS (
    SELECT DISTINCT pv.product_id FROM product_variants pv
    JOIN color_variations cv ON cv.id=pv.color_id JOIN color_groups cg ON cg.id=cv.group_id
    WHERE p_color_groups IS NOT NULL AND array_length(p_color_groups,1) > 0
      AND cg.name = ANY(p_color_groups) AND pv.is_active=true
  ),
  date_filter AS (
    SELECT DISTINCT pcd.product_id FROM product_commemorative_dates pcd
    JOIN commemorative_dates cd ON cd.id=pcd.commemorative_date_id
    WHERE p_date_slugs IS NOT NULL AND array_length(p_date_slugs,1) > 0
      AND cd.slug = ANY(p_date_slugs) AND pcd.is_active=true
  ),
  endo_filter AS (
    SELECT DISTINCT pt.product_id FROM product_tags pt JOIN tags t ON t.id=pt.tag_id
    WHERE p_endomarketing=true AND t.slug='endomarketing' AND t.is_active=true
  ),
  cat_filter AS (
    SELECT DISTINCT pca.product_id FROM product_category_assignments pca
    WHERE v_category_uuid IS NOT NULL AND pca.category_id = v_category_uuid
  ),
  base AS (
    SELECT
      p.id, p.name, p.sku, p.slug, p.short_description, p.brand,
      p.sale_price,
      NULL::numeric AS cost_price,  -- SECURITY/041: never expose cost_price to callers
      p.min_quantity, p.stock_quantity,
      p.is_stockout, p.is_kit, p.is_textil, p.is_thermal, p.is_featured,
      p.is_bestseller, p.is_new, p.has_gift_box, p.target_audience,
      p.primary_image_url, p.og_image_url, p.set_image_url,
      p.main_category_id AS category_id,
      c.name AS category_name, c.slug AS category_slug,
      CASE
        WHEN v_tsquery IS NOT NULL AND p.search_vector @@ v_tsquery
          THEN ts_rank_cd(p.search_vector, v_tsquery, 32)*2.0 + word_similarity(v_search_normalized, lower(unaccent(p.name)))
        WHEN v_search_normalized IS NOT NULL
          THEN word_similarity(v_search_normalized, lower(unaccent(p.name)))
        ELSE 0
      END AS relevance_score,
      COUNT(*) OVER() AS _total_count
    FROM products p
    LEFT JOIN categories c ON c.id = p.main_category_id
    WHERE
      p.is_active=true AND p.is_deleted IS NOT TRUE
      AND (v_search_normalized IS NULL
           OR (v_tsquery IS NOT NULL AND p.search_vector @@ v_tsquery)
           OR p.name % v_search_normalized
           OR lower(p.sku) LIKE '%'||v_search_normalized||'%')
      AND (
        NOT v_category_provided
        OR (v_category_uuid IS NOT NULL AND EXISTS (SELECT 1 FROM cat_filter cf WHERE cf.product_id=p.id))
      )
      AND (p_brands IS NULL OR array_length(p_brands,1) IS NULL OR p.brand = ANY(p_brands))
      AND (NOT p_only_in_stock OR p.is_stockout=false)
      AND (p_min_price IS NULL OR p.sale_price >= p_min_price)
      AND (p_max_price IS NULL OR p.sale_price <= p_max_price)
      AND (p_target_audiences IS NULL OR array_length(p_target_audiences,1) IS NULL OR p.target_audience && p_target_audiences)
      AND (p_is_kit IS NULL OR p.is_kit=p_is_kit)
      AND (p_is_textil IS NULL OR p.is_textil=p_is_textil)
      AND (p_is_thermal IS NULL OR p.is_thermal=p_is_thermal)
      AND (p_has_gift_box IS NULL OR p.has_gift_box=p_has_gift_box)
      AND (p_material_groups IS NULL  OR array_length(p_material_groups,1) IS NULL  OR EXISTS(SELECT 1 FROM mat_filter   mf WHERE mf.product_id=p.id))
      AND (p_technique_groups IS NULL OR array_length(p_technique_groups,1) IS NULL OR EXISTS(SELECT 1 FROM tech_filter  tf WHERE tf.product_id=p.id))
      AND (p_color_groups IS NULL     OR array_length(p_color_groups,1) IS NULL     OR EXISTS(SELECT 1 FROM color_filter cf WHERE cf.product_id=p.id))
      AND (p_date_slugs IS NULL       OR array_length(p_date_slugs,1) IS NULL       OR EXISTS(SELECT 1 FROM date_filter  df WHERE df.product_id=p.id))
      AND (p_endomarketing IS NULL OR p_endomarketing=false OR EXISTS(SELECT 1 FROM endo_filter ef WHERE ef.product_id=p.id))
  )
  SELECT
    b.id, b.name::text, b.sku::text, b.slug::text, b.short_description::text,
    b.brand, b.sale_price, b.cost_price, b.min_quantity, b.stock_quantity,
    b.is_stockout, b.is_kit, b.is_textil, b.is_thermal, b.is_featured,
    b.is_bestseller, b.is_new, b.has_gift_box, b.target_audience,
    b.primary_image_url, b.og_image_url, b.set_image_url,
    b.category_id, b.category_name::text, b.category_slug::text, b._total_count
  FROM base b
  ORDER BY
    CASE p_sort WHEN 'name_asc'   THEN b.name END ASC  NULLS LAST,
    CASE p_sort WHEN 'name_desc'  THEN b.name END DESC NULLS LAST,
    CASE p_sort WHEN 'price_asc'  THEN b.sale_price END ASC  NULLS LAST,
    CASE p_sort WHEN 'price_desc' THEN b.sale_price END DESC NULLS LAST,
    CASE p_sort WHEN 'relevance'  THEN b.relevance_score
                WHEN 'bestseller' THEN CASE WHEN b.is_bestseller THEN 1 ELSE 0 END::numeric
    END DESC NULLS LAST,
    b.is_featured DESC, b.is_bestseller DESC, b.name ASC
  LIMIT v_limit OFFSET v_offset;
END;
$fn_super_filtro$;

-- ============================================================
-- FIX 2: fn_get_category_breadcrumb → SECURITY INVOKER
-- anon already has SELECT on categories, so SECURITY DEFINER is unnecessary
-- ============================================================
CREATE OR REPLACE FUNCTION public.fn_get_category_breadcrumb(
  p_category_id uuid,
  p_separator   text DEFAULT ' > '::text
)
RETURNS text
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path TO 'public'
AS $fn_category_breadcrumb$
  WITH RECURSIVE breadcrumb AS (
    SELECT id, name, parent_id, 1 AS depth
    FROM categories WHERE id = p_category_id
    UNION ALL
    SELECT c.id, c.name, c.parent_id, b.depth + 1
    FROM categories c
    JOIN breadcrumb b ON b.parent_id = c.id
  )
  SELECT string_agg(name, p_separator ORDER BY depth DESC)
  FROM breadcrumb;
$fn_category_breadcrumb$;

-- ============================================================
-- VALIDATION
-- ============================================================
DO $validate$
DECLARE
  v_super_filtro_secdef boolean;
  v_breadcrumb_secdef   boolean;
BEGIN
  SELECT prosecdef INTO v_super_filtro_secdef
  FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public' AND p.proname = 'fn_super_filtro';

  IF NOT v_super_filtro_secdef THEN
    RAISE EXCEPTION '[041] FAIL: fn_super_filtro should still be SECURITY DEFINER';
  END IF;
  RAISE NOTICE '[041] OK: fn_super_filtro is SECURITY DEFINER (correct)';

  SELECT prosecdef INTO v_breadcrumb_secdef
  FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public' AND p.proname = 'fn_get_category_breadcrumb';

  IF v_breadcrumb_secdef THEN
    RAISE EXCEPTION '[041] FAIL: fn_get_category_breadcrumb should now be SECURITY INVOKER';
  END IF;
  RAISE NOTICE '[041] OK: fn_get_category_breadcrumb is SECURITY INVOKER (correct)';

  RAISE NOTICE '[041] Migration 041 applied successfully';
END;
$validate$;
