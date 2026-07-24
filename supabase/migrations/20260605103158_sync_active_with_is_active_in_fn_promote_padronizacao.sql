CREATE OR REPLACE FUNCTION public.fn_promote_padronizacao(p_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO 'public', 'extensions'
AS $function$
DECLARE
  s         public.produtos_padronizacao%ROWTYPE;
  v_pid     uuid;
  v_org     uuid;
  v_locked  text[];
  v_is_new  boolean := false;
BEGIN
  SELECT * INTO s FROM public.produtos_padronizacao WHERE id = p_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'padronizacao_nao_encontrada', 'id', p_id);
  END IF;
  IF s.status <> 'standardized' THEN
    RETURN jsonb_build_object('success', false, 'error', 'status_invalido', 'status', s.status);
  END IF;

  PERFORM set_config('app.write_source', 'pipeline', true);

  SELECT id, locked_fields INTO v_pid, v_locked
  FROM public.products
  WHERE supplier_id = s.supplier_id AND supplier_reference = s.supplier_reference;

  IF v_pid IS NULL THEN
    v_is_new := true;
    SELECT organization_id INTO v_org FROM public.suppliers WHERE id = s.supplier_id;
    INSERT INTO public.products (organization_id, supplier_id, supplier_reference, sku, name, active, is_active, product_type)
    VALUES (v_org, s.supplier_id, s.supplier_reference,
            COALESCE(s.supplier_reference, s.name), COALESCE(s.name,'Produto '||s.supplier_reference),
            COALESCE(s.is_active, true), COALESCE(s.is_active, true), 'product')
    RETURNING id, locked_fields INTO v_pid, v_locked;
  END IF;

  v_locked := COALESCE(v_locked, '{}');

  UPDATE public.products p SET
    name               = CASE WHEN 'name'               = ANY(v_locked) THEN p.name               ELSE COALESCE(s.name, p.name) END,
    description        = CASE WHEN 'description'        = ANY(v_locked) THEN p.description        ELSE COALESCE(s.description, p.description) END,
    short_description  = CASE WHEN 'short_description'  = ANY(v_locked) THEN p.short_description  ELSE COALESCE(s.short_description, p.short_description) END,
    cost_price         = CASE WHEN 'cost_price'         = ANY(v_locked) THEN p.cost_price         ELSE COALESCE(s.cost_price, p.cost_price) END,
    suggested_price    = CASE WHEN 'suggested_price'    = ANY(v_locked) THEN p.suggested_price    ELSE COALESCE(s.suggested_price, p.suggested_price) END,
    stock_quantity     = CASE WHEN 'stock_quantity'     = ANY(v_locked) THEN p.stock_quantity     ELSE COALESCE(s.stock_quantity, p.stock_quantity) END,
    primary_image_url  = CASE WHEN 'primary_image_url'  = ANY(v_locked) THEN p.primary_image_url  ELSE COALESCE(s.primary_image_url, p.primary_image_url) END,
    images             = CASE WHEN 'images'             = ANY(v_locked) THEN p.images             ELSE COALESCE(s.images, p.images) END,
    ncm_code           = CASE WHEN 'ncm_code'           = ANY(v_locked) THEN p.ncm_code           ELSE COALESCE(s.ncm_code, p.ncm_code) END,
    weight_g           = CASE WHEN 'weight_g'           = ANY(v_locked) THEN p.weight_g           ELSE COALESCE(s.weight_g, p.weight_g) END,
    height_cm          = CASE WHEN 'height_cm'          = ANY(v_locked) THEN p.height_cm          ELSE COALESCE(s.height_cm, p.height_cm) END,
    width_cm           = CASE WHEN 'width_cm'           = ANY(v_locked) THEN p.width_cm           ELSE COALESCE(s.width_cm, p.width_cm) END,
    length_cm          = CASE WHEN 'length_cm'          = ANY(v_locked) THEN p.length_cm          ELSE COALESCE(s.length_cm, p.length_cm) END,
    dimensions_display = CASE WHEN 'dimensions_display' = ANY(v_locked) THEN p.dimensions_display ELSE COALESCE(s.dimensions_display, p.dimensions_display) END,
    box_length_cm      = CASE WHEN 'box_length_cm'      = ANY(v_locked) THEN p.box_length_cm      ELSE COALESCE(s.box_length_cm, p.box_length_cm) END,
    box_width_cm       = CASE WHEN 'box_width_cm'       = ANY(v_locked) THEN p.box_width_cm       ELSE COALESCE(s.box_width_cm, p.box_width_cm) END,
    box_height_cm      = CASE WHEN 'box_height_cm'      = ANY(v_locked) THEN p.box_height_cm      ELSE COALESCE(s.box_height_cm, p.box_height_cm) END,
    box_weight_kg      = CASE WHEN 'box_weight_kg'      = ANY(v_locked) THEN p.box_weight_kg      ELSE COALESCE(s.box_weight_kg, p.box_weight_kg) END,
    box_volume_cm3     = CASE WHEN 'box_volume_cm3'     = ANY(v_locked) THEN p.box_volume_cm3     ELSE COALESCE(s.box_volume_cm3, p.box_volume_cm3) END,
    box_quantity       = CASE WHEN 'box_quantity'       = ANY(v_locked) THEN p.box_quantity       ELSE COALESCE(s.box_quantity, p.box_quantity) END,
    box_inner_quantity = CASE WHEN 'box_inner_quantity' = ANY(v_locked) THEN p.box_inner_quantity ELSE COALESCE(s.box_inner_quantity, p.box_inner_quantity) END,
    brand              = CASE WHEN 'brand'              = ANY(v_locked) THEN p.brand              ELSE COALESCE(s.brand, p.brand) END,
    packing_type       = CASE WHEN 'packing_type'       = ANY(v_locked) THEN p.packing_type       ELSE COALESCE(s.packing_type, p.packing_type) END,
    repacking_type     = CASE WHEN 'repacking_type'     = ANY(v_locked) THEN p.repacking_type     ELSE COALESCE(s.repacking_type, p.repacking_type) END,
    capacities         = CASE WHEN 'capacities'         = ANY(v_locked) THEN p.capacities         ELSE COALESCE(s.capacities, p.capacities) END,
    capacity_ml        = CASE WHEN 'capacity_ml'        = ANY(v_locked) THEN p.capacity_ml        ELSE COALESCE(s.capacity_ml, p.capacity_ml) END,
    min_quantity       = CASE WHEN 'min_quantity'       = ANY(v_locked) THEN p.min_quantity       ELSE COALESCE(s.min_quantity, p.min_quantity) END,
    warranty_months    = CASE WHEN 'warranty_months'    = ANY(v_locked) THEN p.warranty_months    ELSE COALESCE(s.warranty_months, p.warranty_months) END,
    ipi_rate           = CASE WHEN 'ipi_rate'           = ANY(v_locked) THEN p.ipi_rate           ELSE COALESCE(s.ipi_rate, p.ipi_rate) END,
    engraving_type     = CASE WHEN 'engraving_type'     = ANY(v_locked) THEN p.engraving_type     ELSE COALESCE(s.engraving_type, p.engraving_type) END,
    colors             = CASE WHEN 'colors'             = ANY(v_locked) THEN p.colors             ELSE COALESCE(s.colors, p.colors) END,
    is_active          = CASE WHEN 'is_active'          = ANY(v_locked) THEN p.is_active          ELSE COALESCE(s.is_active, p.is_active) END,
    active             = CASE WHEN 'is_active'          = ANY(v_locked) THEN p.active             ELSE COALESCE(s.is_active, p.active) END,
    last_sync_at          = now(),
    last_sync_supplier_id = s.supplier_id,
    supplier_updated_at   = now()
  WHERE p.id = v_pid;

  UPDATE public.produtos_padronizacao
     SET status='promoted', promoted_at=now(), product_id=v_pid
   WHERE id = p_id;

  IF s.raw_id IS NOT NULL THEN
    UPDATE public.supplier_products_raw
       SET status='processed', processed_at=now(), product_id=v_pid
     WHERE id = s.raw_id;
  END IF;

  RETURN jsonb_build_object('success', true, 'product_id', v_pid, 'created', v_is_new,
                            'locked_preserved', v_locked);
END;
$function$;
