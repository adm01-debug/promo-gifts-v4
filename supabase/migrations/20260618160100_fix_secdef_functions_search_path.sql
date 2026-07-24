-- ================================================================
-- SET search_path = public em todas as funções SECURITY DEFINER
-- ================================================================
-- Funções SECURITY DEFINER sem SET search_path são vulneráveis a
-- schema injection. Fix aplicado a:
--   fn_revoke_view_write_grants_on_create, fn_quotes_validate_discount,
--   fn_remove_product_on_sale, fn_set_product_on_sale, fn_sync_derived_product_flags
-- ================================================================

CREATE OR REPLACE FUNCTION public.fn_revoke_view_write_grants_on_create()
RETURNS event_trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  obj record;
  view_name text;
BEGIN
  FOR obj IN
    SELECT object_type, schema_name, object_identity
    FROM pg_event_trigger_ddl_commands()
    WHERE object_type = 'view' AND schema_name = 'public'
  LOOP
    view_name := obj.object_identity;
    BEGIN
      EXECUTE format(
        'REVOKE INSERT, UPDATE, DELETE, REFERENCES, TRIGGER ON %s FROM anon, authenticated',
        view_name
      );
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'fn_revoke_view_write_grants_on_create: could not revoke on %: %',
        view_name, SQLERRM;
    END;
  END LOOP;
END;
$$;

CREATE OR REPLACE FUNCTION public.fn_remove_product_on_sale(p_product_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $function$
DECLARE v_sku text;
BEGIN
  SELECT sku INTO v_sku FROM products WHERE id=p_product_id;
  UPDATE products SET is_on_sale=FALSE, is_on_sale_expires_at=NULL, updated_at=NOW() WHERE id=p_product_id;
  RETURN jsonb_build_object('status','on_sale_removido','sku',v_sku);
END; $function$;

CREATE OR REPLACE FUNCTION public.fn_set_product_on_sale(
  p_product_id uuid, p_expires_at timestamp with time zone,
  p_discount_pct numeric DEFAULT NULL::numeric)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $function$
DECLARE v_sku text; v_name text;
BEGIN
  IF p_expires_at IS NULL THEN RAISE EXCEPTION 'p_expires_at é obrigatório'; END IF;
  IF p_expires_at <= NOW() THEN RAISE EXCEPTION 'p_expires_at deve ser futuro'; END IF;
  IF p_discount_pct IS NOT NULL AND (p_discount_pct <= 0 OR p_discount_pct >= 100) THEN
    RAISE EXCEPTION 'p_discount_pct deve estar entre 0 e 100'; END IF;
  SELECT sku, name INTO v_sku, v_name FROM products WHERE id=p_product_id;
  IF v_sku IS NULL THEN RAISE EXCEPTION 'Produto % não encontrado', p_product_id; END IF;
  UPDATE products SET is_on_sale=TRUE, is_on_sale_expires_at=p_expires_at, updated_at=NOW()
  WHERE id=p_product_id;
  RETURN jsonb_build_object('status','on_sale_ativado','product_id',p_product_id,
    'sku',v_sku,'name',v_name,'expires_at',p_expires_at,'discount_pct',p_discount_pct,
    'dias_restantes',EXTRACT(DAY FROM p_expires_at - NOW())::integer);
END; $function$;

CREATE OR REPLACE FUNCTION public.fn_sync_derived_product_flags()
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $function$
DECLARE
  v_on_sale_cleared integer:=0; v_on_sale_expired integer:=0; v_new_expired integer:=0;
  v_featured_exp integer:=0; v_bestseller_exp integer:=0;
BEGIN
  UPDATE products SET is_on_sale=false, updated_at=now() WHERE is_on_sale=true AND is_on_sale_expires_at IS NULL;
  GET DIAGNOSTICS v_on_sale_cleared=ROW_COUNT;
  UPDATE products SET is_on_sale=false, updated_at=now() WHERE is_on_sale=true AND is_on_sale_expires_at IS NOT NULL AND is_on_sale_expires_at<now();
  GET DIAGNOSTICS v_on_sale_expired=ROW_COUNT;
  UPDATE products SET is_new=false, updated_at=now() WHERE is_new=true AND is_new_expires_at IS NOT NULL AND is_new_expires_at<now();
  GET DIAGNOSTICS v_new_expired=ROW_COUNT;
  UPDATE products SET is_featured=false, updated_at=now() WHERE is_featured=true AND is_featured_expires_at IS NOT NULL AND is_featured_expires_at<now();
  GET DIAGNOSTICS v_featured_exp=ROW_COUNT;
  UPDATE products SET is_bestseller=false, updated_at=now() WHERE is_bestseller=true AND is_bestseller_expires_at IS NOT NULL AND is_bestseller_expires_at<now();
  GET DIAGNOSTICS v_bestseller_exp=ROW_COUNT;
  RETURN jsonb_build_object('version','v3_2026-06-14_remove_stockout_onsale',
    'is_on_sale_cleared',v_on_sale_cleared,'is_on_sale_expired',v_on_sale_expired,
    'is_new_expired',v_new_expired,'is_featured_expired',v_featured_exp,
    'is_bestseller_expired',v_bestseller_exp);
END; $function$;
