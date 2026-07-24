
-- ════════════════════════════════════════════════════════════════
-- PROMOÇÃO de variantes silver → product_variants (+ VSS p/ custo)
-- Vincula ao produto-pai já promovido (por supplier_id + parent_reference).
-- Idempotente por (product_id, supplier_sku). Seta write_source=pipeline.
-- ════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.fn_promote_variants_of_parent(p_supplier_id uuid, p_parent_reference text)
RETURNS jsonb LANGUAGE plpgsql AS $$
DECLARE
  v_pid    uuid;
  v_org    uuid;
  pv       RECORD;
  v_vid    uuid;
  v_count  int := 0;
BEGIN
  PERFORM set_config('app.write_source','pipeline',true);

  SELECT id, organization_id INTO v_pid, v_org
  FROM public.products
  WHERE supplier_id = p_supplier_id AND supplier_reference = p_parent_reference;

  IF v_pid IS NULL THEN
    RETURN jsonb_build_object('success',false,'error','produto_pai_nao_promovido','parent',p_parent_reference);
  END IF;

  FOR pv IN
    SELECT * FROM public.produtos_padronizacao_variantes
    WHERE supplier_id = p_supplier_id AND parent_reference = p_parent_reference AND status='standardized'
  LOOP
    -- upsert da variante por (product_id, supplier_sku)
    SELECT id INTO v_vid FROM public.product_variants
    WHERE product_id = v_pid AND supplier_sku = pv.supplier_sku;

    IF v_vid IS NULL THEN
      INSERT INTO public.product_variants (product_id, sku, supplier_sku, name, color_name, color_code, color_hex, color_id, stock_quantity, is_active, last_sync_at, last_sync_supplier_id)
      VALUES (v_pid, pv.sku, pv.supplier_sku,
              COALESCE(pv.color_name, pv.sku),
              pv.color_name, pv.color_code, pv.color_hex, pv.color_id,
              COALESCE(pv.stock_quantity,0), COALESCE(pv.is_active,true), now(), p_supplier_id)
      RETURNING id INTO v_vid;
    ELSE
      UPDATE public.product_variants SET
        color_name=COALESCE(pv.color_name,color_name), color_code=COALESCE(pv.color_code,color_code),
        color_hex=COALESCE(pv.color_hex,color_hex), color_id=COALESCE(pv.color_id,color_id),
        stock_quantity=COALESCE(pv.stock_quantity,stock_quantity),
        last_sync_at=now(), last_sync_supplier_id=p_supplier_id
      WHERE id=v_vid;
    END IF;

    -- custo/fonte na VSS (idempotente por variant_id+supplier_id)
    IF pv.cost_price IS NOT NULL THEN
      INSERT INTO public.variant_supplier_sources (organization_id, variant_id, supplier_id, cost_price, supplier_sku, supplier_color_code, supplier_color_name, is_active, source, last_synced_at)
      VALUES (v_org, v_vid, p_supplier_id, pv.cost_price, pv.supplier_sku, pv.color_code, pv.color_name, true, 'silver', now())
      ON CONFLICT DO NOTHING;
    END IF;

    UPDATE public.produtos_padronizacao_variantes
      SET status='promoted', variant_id=v_vid, updated_at=now() WHERE id=pv.id;
    v_count := v_count + 1;
  END LOOP;

  RETURN jsonb_build_object('success',true,'product_id',v_pid,'variantes_promovidas',v_count);
END;
$$;
