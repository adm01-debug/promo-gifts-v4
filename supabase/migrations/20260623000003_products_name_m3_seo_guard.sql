-- M3: Guard performance trg_products_seo_autofill
-- Early return quando name nao mudou e slug/meta ja existem
-- Elimina generate_product_slug em UPDATEs sem mudanca de name
CREATE OR REPLACE FUNCTION public.trg_products_seo_autofill()
 RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public'
AS $function$
DECLARE v_category_name TEXT;
BEGIN
  -- GUARD DE PERFORMANCE (M3 2026-06-23)
  IF TG_OP='UPDATE' AND OLD.name IS NOT DISTINCT FROM NEW.name
     AND NEW.slug IS NOT NULL AND NEW.meta_title IS NOT NULL AND NEW.meta_description IS NOT NULL
  THEN
    IF NEW.og_image_url IS NULL AND NEW.primary_image_url IS NOT NULL THEN
      NEW.og_image_url := NEW.primary_image_url;
    END IF;
    NEW.updated_at := now();
    RETURN NEW;
  END IF;
  IF NEW.main_category_id IS NOT NULL THEN SELECT name INTO v_category_name FROM categories WHERE id=NEW.main_category_id;
  ELSIF NEW.category_id IS NOT NULL THEN SELECT name INTO v_category_name FROM categories WHERE id=NEW.category_id;
  END IF;
  IF (NEW.slug IS NULL OR LENGTH(TRIM(COALESCE(NEW.slug,'')))=0) AND NEW.name IS NOT NULL THEN
    NEW.slug := generate_product_slug(NEW.name, NEW.id);
  END IF;
  IF (NEW.meta_title IS NULL OR LENGTH(TRIM(COALESCE(NEW.meta_title,'')))=0) AND NEW.name IS NOT NULL THEN
    NEW.meta_title := generate_product_meta_title(NEW.name, v_category_name);
  END IF;
  IF (NEW.meta_description IS NULL OR LENGTH(TRIM(COALESCE(NEW.meta_description,'')))=0) AND NEW.name IS NOT NULL THEN
    NEW.meta_description := generate_product_meta_description(NEW.name,NEW.short_description,NEW.description,COALESCE(NEW.allows_personalization,false));
  END IF;
  IF (NEW.meta_keywords IS NULL OR COALESCE(array_length(NEW.meta_keywords,1),0)=0) AND NEW.name IS NOT NULL THEN
    NEW.meta_keywords := extract_keywords(COALESCE(NEW.name,'')||' '||COALESCE(NEW.short_description,'')||' '||COALESCE(v_category_name,'')||' '||COALESCE(NEW.brand,'')||' brinde promocional brinde corporativo brinde personalizado',15);
  END IF;
  IF NEW.og_title IS NULL AND NEW.meta_title IS NOT NULL THEN NEW.og_title := NEW.meta_title; END IF;
  IF NEW.og_description IS NULL AND NEW.meta_description IS NOT NULL THEN NEW.og_description := NEW.meta_description; END IF;
  IF NEW.og_image_url IS NULL AND NEW.primary_image_url IS NOT NULL THEN NEW.og_image_url := NEW.primary_image_url; END IF;
  IF NEW.canonical_url IS NULL AND NEW.slug IS NOT NULL THEN NEW.canonical_url := '/produto/' || NEW.slug; END IF;
  IF TG_OP='UPDATE' THEN NEW.updated_at := now(); END IF;
  RETURN NEW;
END;
$function$;
