-- Corrige fn_asia_site_promote_to_gold para propagar circumference_cm
-- tanto para product_physical quanto para products.circumference_cm.
CREATE OR REPLACE FUNCTION public.fn_asia_site_promote_to_gold(
  p_limit    integer DEFAULT NULL::integer,
  p_only_new boolean DEFAULT true
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_ASIA     uuid := 'd2734e23-d633-4819-bb15-e51aa44e2118';
  v_linked   int  := 0;
  v_phys     int  := 0;
  v_scalars  int  := 0;
  v_promoted int  := 0;
  v_zombies  int  := 0;
BEGIN

  -- ── STEP -1: Limpar produtos-zombie com supplier_reference IS NULL
  WITH zombie_candidates AS (
    SELECT p.id AS zombie_id
    FROM products p
    WHERE p.supplier_id = v_ASIA
      AND (p.supplier_reference IS NULL OR p.supplier_reference = '')
      AND p.is_active = false
      AND NOT EXISTS (SELECT 1 FROM product_images pi WHERE pi.product_id=p.id AND pi.is_active=true)
      AND NOT EXISTS (SELECT 1 FROM product_videos pv WHERE pv.product_id=p.id AND pv.is_active=true)
      AND EXISTS (
        SELECT 1 FROM products p2
        WHERE p2.supplier_id = v_ASIA
          AND p2.is_active = true
          AND p2.supplier_reference IS NOT NULL
          AND lower(trim(p2.name)) = lower(trim(p.name))
      )
  )
  DELETE FROM product_variants pv2
  USING zombie_candidates zc
  WHERE pv2.product_id = zc.zombie_id;

  WITH zombie_products AS (
    SELECT p.id AS zombie_id
    FROM products p
    WHERE p.supplier_id = v_ASIA
      AND (p.supplier_reference IS NULL OR p.supplier_reference = '')
      AND p.is_active = false
      AND NOT EXISTS (SELECT 1 FROM product_images pi WHERE pi.product_id=p.id AND pi.is_active=true)
      AND NOT EXISTS (SELECT 1 FROM product_videos pv WHERE pv.product_id=p.id AND pv.is_active=true)
      AND EXISTS (
        SELECT 1 FROM products p2
        WHERE p2.supplier_id = v_ASIA AND p2.is_active = true
          AND p2.supplier_reference IS NOT NULL
          AND lower(trim(p2.name)) = lower(trim(p.name))
      )
  )
  DELETE FROM products p3 USING zombie_products zp WHERE p3.id = zp.zombie_id;
  GET DIAGNOSTICS v_zombies = ROW_COUNT;

  -- ── STEP 0: Vincular product_id via Silver principal
  WITH lnk AS (
    SELECT s.id, p.product_id
    FROM public.produtos_site_padronizacao s
    JOIN public.produtos_padronizacao p
      ON p.supplier_id = s.supplier_id
     AND p.supplier_reference = s.supplier_reference
    WHERE s.supplier_id = v_ASIA
      AND p.product_id IS NOT NULL
      AND s.product_id IS NULL
      AND s.status <> 'rejected'
  )
  UPDATE public.produtos_site_padronizacao t
     SET product_id = lnk.product_id, updated_at = now()
    FROM lnk WHERE t.id = lnk.id;
  GET DIAGNOSTICS v_linked = ROW_COUNT;

  CREATE TEMP TABLE _asia_site_scope ON COMMIT DROP AS
    SELECT s.* FROM public.produtos_site_padronizacao s
    WHERE s.supplier_id = v_ASIA
      AND s.product_id IS NOT NULL
      AND s.status = CASE WHEN p_only_new
                          THEN 'standardized'::public.produtos_padronizacao_status
                          ELSE s.status END
      AND s.status <> 'rejected'
    LIMIT COALESCE(p_limit, 1000000000);

  IF NOT EXISTS (SELECT 1 FROM _asia_site_scope) THEN
    RETURN jsonb_build_object(
      'linked', v_linked, 'note', 'nada_novo', 'zombies_removidos', v_zombies
    );
  END IF;

  -- (e) product_physical: peso + dimensoes (incluindo circumference_cm)
  INSERT INTO public.product_physical (
    product_id, weight_g, height_cm, width_cm, length_cm, circumference_cm
  )
  SELECT
    product_id,
    weight_g::numeric,
    height_cm,
    width_cm,
    depth_cm,
    circumference_cm
  FROM _asia_site_scope
  WHERE weight_g IS NOT NULL OR height_cm IS NOT NULL
     OR width_cm IS NOT NULL  OR depth_cm IS NOT NULL
     OR circumference_cm IS NOT NULL
  ON CONFLICT (product_id) DO UPDATE SET
    weight_g         = COALESCE(public.product_physical.weight_g,         EXCLUDED.weight_g),
    height_cm        = COALESCE(public.product_physical.height_cm,        EXCLUDED.height_cm),
    width_cm         = COALESCE(public.product_physical.width_cm,         EXCLUDED.width_cm),
    length_cm        = COALESCE(public.product_physical.length_cm,        EXCLUDED.length_cm),
    circumference_cm = COALESCE(public.product_physical.circumference_cm, EXCLUDED.circumference_cm),
    updated_at = now();
  GET DIAGNOSTICS v_phys = ROW_COUNT;

  -- (f) products: propagar circumference_cm diretamente na tabela Gold
  -- (fill-only — não sobrescreve valor já preenchido manualmente)
  UPDATE public.products p SET
    circumference_cm = COALESCE(p.circumference_cm, s.circumference_cm),
    updated_at       = now()
  FROM _asia_site_scope s
  WHERE p.id = s.product_id
    AND s.circumference_cm IS NOT NULL
    AND p.circumference_cm IS NULL;

  -- (h) products: fill-only escalares WP-exclusive
  UPDATE public.products p SET
    brand                  = COALESCE(p.brand,                  s.brand),
    min_order_quantity     = COALESCE(p.min_order_quantity,     s.moq),
    min_quantity           = COALESCE(p.min_quantity,           s.min_quantity),
    requires_minimum_order = COALESCE(p.requires_minimum_order,
                               CASE WHEN s.moq IS NOT NULL THEN (s.moq > 1) ELSE NULL END),
    sale_price             = COALESCE(p.sale_price,             s.sale_price),
    is_on_sale             = COALESCE(p.is_on_sale,             s.is_on_sale),
    suggested_price        = COALESCE(p.suggested_price,        s.regular_price),
    updated_at             = now()
  FROM _asia_site_scope s
  WHERE p.id = s.product_id
    AND (s.brand IS NOT NULL OR s.moq IS NOT NULL
      OR s.sale_price IS NOT NULL OR s.regular_price IS NOT NULL
      OR s.is_on_sale IS NOT NULL);
  GET DIAGNOSTICS v_scalars = ROW_COUNT;

  -- Marcar promovidas
  UPDATE public.produtos_site_padronizacao t
     SET status      = 'promoted'::public.produtos_padronizacao_status,
         promoted_at = now(),
         updated_at  = now()
   WHERE t.id IN (SELECT id FROM _asia_site_scope);
  GET DIAGNOSTICS v_promoted = ROW_COUNT;

  RETURN jsonb_build_object(
    'linked',            v_linked,
    'physical',          v_phys,
    'scalars',           v_scalars,
    'promoted',          v_promoted,
    'zombies_removidos', v_zombies
  );
END;
$function$;
