-- ════════════════════════════════════════════════════════════════
-- UNIFICAÇÃO MEDALLION — Fase 5 (correção de integridade 3-fases)
-- fn_promote_variants_of_parent passa a marcar a RAW como 'processed'
-- quando a variante chega ao Gold.
-- ════════════════════════════════════════════════════════════════
-- PORQUÊ: no modelo de 3 fases, cada raw (1 SKU = 1 raw nos fornecedores
-- atuais) só está "concluída" quando sua variante é promovida ao Gold.
-- fn_promote_padronizacao só marca a raw REPRESENTANTE do grupo-pai; as
-- demais raws (uma por variante) ficavam 'pending' e seriam reprocessadas
-- indefinidamente pelo cron (a fila nunca drenava). O motor antigo
-- (fn_process_raw_v2) marcava cada raw individualmente — esta função
-- restaura essa garantia dentro do pipeline Silver.
--
-- Mudança cirúrgica: + UPDATE supplier_products_raw no laço de promoção.
-- ════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.fn_promote_variants_of_parent(
    p_supplier_id uuid,
    p_parent_reference text
)
RETURNS jsonb
LANGUAGE plpgsql
SET search_path TO 'public', 'extensions'
AS $function$
DECLARE
  v_pid uuid; v_org uuid; pv RECORD; v_vid uuid; v_count int := 0; v_attrs jsonb;
  v_existing_pid uuid;
BEGIN
  PERFORM set_config('app.write_source','pipeline',true);
  SELECT id, organization_id INTO v_pid, v_org FROM public.products
  WHERE supplier_id=p_supplier_id AND supplier_reference=p_parent_reference;
  IF v_pid IS NULL THEN RETURN jsonb_build_object('success',false,'error','produto_pai_nao_promovido','parent',p_parent_reference); END IF;

  FOR pv IN
    SELECT * FROM public.produtos_padronizacao_variantes
    WHERE supplier_id=p_supplier_id AND parent_reference=p_parent_reference AND status='standardized'
  LOOP
    v_attrs := jsonb_strip_nulls(jsonb_build_object('cor', pv.color_name, 'codigo_cor', pv.color_code, 'hex', pv.color_hex));

    -- idempotência por sku GLOBAL (sku é UNIQUE em product_variants); fallback (product_id, supplier_sku)
    SELECT id, product_id INTO v_vid, v_existing_pid FROM public.product_variants WHERE sku = pv.sku;
    IF v_vid IS NULL THEN
      SELECT id, product_id INTO v_vid, v_existing_pid FROM public.product_variants
      WHERE product_id=v_pid AND supplier_sku=pv.supplier_sku;
    END IF;

    IF v_vid IS NULL THEN
      INSERT INTO public.product_variants (product_id, sku, supplier_sku, name, attributes, color_name, color_code, color_hex, color_id, stock_quantity, is_active, last_sync_at, last_sync_supplier_id)
      VALUES (v_pid, pv.sku, pv.supplier_sku, COALESCE(pv.color_name, pv.sku), v_attrs,
              pv.color_name, pv.color_code, pv.color_hex, pv.color_id,
              COALESCE(pv.stock_quantity,0), COALESCE(pv.is_active,true), now(), p_supplier_id)
      ON CONFLICT (sku) DO UPDATE SET
        supplier_sku = EXCLUDED.supplier_sku,
        attributes   = COALESCE(public.product_variants.attributes,'{}'::jsonb) || EXCLUDED.attributes,
        color_name   = COALESCE(EXCLUDED.color_name, public.product_variants.color_name),
        color_code   = COALESCE(EXCLUDED.color_code, public.product_variants.color_code),
        color_hex    = COALESCE(EXCLUDED.color_hex, public.product_variants.color_hex),
        color_id     = COALESCE(EXCLUDED.color_id, public.product_variants.color_id),
        stock_quantity = COALESCE(EXCLUDED.stock_quantity, public.product_variants.stock_quantity),
        last_sync_at = now(), last_sync_supplier_id = EXCLUDED.last_sync_supplier_id
      RETURNING id INTO v_vid;
    ELSE
      UPDATE public.product_variants SET
        attributes = COALESCE(attributes,'{}'::jsonb) || v_attrs,
        color_name=COALESCE(pv.color_name,color_name), color_code=COALESCE(pv.color_code,color_code),
        color_hex=COALESCE(pv.color_hex,color_hex), color_id=COALESCE(pv.color_id,color_id),
        stock_quantity=COALESCE(pv.stock_quantity,stock_quantity), last_sync_at=now(), last_sync_supplier_id=p_supplier_id
      WHERE id=v_vid;
    END IF;

    IF pv.cost_price IS NOT NULL THEN
      INSERT INTO public.variant_supplier_sources (organization_id, variant_id, supplier_id, cost_price, supplier_sku, supplier_color_code, supplier_color_name, is_active, source, last_synced_at)
      VALUES (v_org, v_vid, p_supplier_id, pv.cost_price, pv.supplier_sku, pv.color_code, pv.color_name, true, 'silver', now())
      ON CONFLICT (variant_id, supplier_id) DO UPDATE SET
        cost_price          = EXCLUDED.cost_price,
        supplier_sku        = EXCLUDED.supplier_sku,
        supplier_color_code = EXCLUDED.supplier_color_code,
        supplier_color_name = EXCLUDED.supplier_color_name,
        is_active           = EXCLUDED.is_active,
        source              = EXCLUDED.source,
        last_synced_at      = EXCLUDED.last_synced_at;
    END IF;

    UPDATE public.produtos_padronizacao_variantes SET status='promoted', variant_id=v_vid, updated_at=now() WHERE id=pv.id;

    -- 3-fases: a raw desta variante está concluída ao chegar no Gold.
    IF pv.raw_id IS NOT NULL THEN
      UPDATE public.supplier_products_raw
         SET status='processed', processed_at=now(), product_id=v_pid, variant_id=v_vid
       WHERE id=pv.raw_id AND status <> 'processed';
    END IF;

    v_count := v_count + 1;
  END LOOP;
  RETURN jsonb_build_object('success',true,'product_id',v_pid,'variantes_promovidas',v_count);
END;
$function$;
