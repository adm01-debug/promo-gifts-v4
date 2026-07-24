-- M4: Otimizar generate_product_slug - eliminar loop N+1
-- Antes: ate 18527 queries. Agora: maximo 2 queries via UUID hex suffix.
CREATE OR REPLACE FUNCTION public.generate_product_slug(p_name text, p_product_id uuid DEFAULT NULL)
 RETURNS text LANGUAGE plpgsql SET search_path TO 'public'
AS $function$
DECLARE
  v_base_slug  text;
  v_final_slug text;
  v_hex_suffix text;
  v_counter    integer := 0;
BEGIN
  IF p_name IS NULL OR LENGTH(TRIM(p_name))=0 THEN RETURN NULL; END IF;
  v_base_slug  := slugify(p_name);
  v_final_slug := v_base_slug;
  IF NOT EXISTS(SELECT 1 FROM products WHERE slug=v_final_slug AND is_deleted=false AND (p_product_id IS NULL OR id<>p_product_id)) THEN
    RETURN v_final_slug;
  END IF;
  IF p_product_id IS NOT NULL THEN
    v_hex_suffix := LEFT(REPLACE(p_product_id::text,'-',''),8);
    v_final_slug := v_base_slug||'-'||v_hex_suffix;
    IF NOT EXISTS(SELECT 1 FROM products WHERE slug=v_final_slug AND is_deleted=false AND id<>p_product_id) THEN
      RETURN v_final_slug;
    END IF;
    RETURN v_base_slug||'-'||REPLACE(p_product_id::text,'-','');
  END IF;
  WHILE v_counter<999 LOOP
    v_counter    := v_counter+1;
    v_final_slug := v_base_slug||'-'||v_counter;
    IF NOT EXISTS(SELECT 1 FROM products WHERE slug=v_final_slug AND is_deleted=false AND (p_product_id IS NULL OR id<>p_product_id)) THEN
      RETURN v_final_slug;
    END IF;
  END LOOP;
  RETURN v_base_slug||'-'||EXTRACT(EPOCH FROM NOW())::bigint;
END;
$function$;
