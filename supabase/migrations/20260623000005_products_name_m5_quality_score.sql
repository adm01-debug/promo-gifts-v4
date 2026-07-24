-- M5: fn_product_name_quality_score - score 0-100 de qualidade de products.name
CREATE OR REPLACE FUNCTION public.fn_product_name_quality_score(p_name text)
 RETURNS jsonb LANGUAGE plpgsql IMMUTABLE SET search_path TO 'public'
AS $function$
DECLARE v_score integer:=100; v_issues text[]:='{}';
BEGIN
  IF p_name IS NULL OR length(TRIM(p_name))=0 THEN
    RETURN jsonb_build_object('score',0,'issues',ARRAY['name_null_or_empty'],'grade','F'); END IF;
  IF p_name LIKE '%  %' THEN v_score:=v_score-25; v_issues:=array_append(v_issues,'double_spaces'); END IF;
  IF p_name<>TRIM(p_name) THEN v_score:=v_score-15; v_issues:=array_append(v_issues,'leading_trailing_spaces'); END IF;
  IF p_name~E'[\\t\\n\\r]' THEN v_score:=v_score-25; v_issues:=array_append(v_issues,'contains_tabs_newlines'); END IF;
  IF length(p_name)>150 THEN v_score:=v_score-20; v_issues:=array_append(v_issues,'too_long_over_150');
  ELSIF length(p_name)>100 THEN v_score:=v_score-10; v_issues:=array_append(v_issues,'long_100_to_150'); END IF;
  IF length(TRIM(p_name))<8 THEN v_score:=v_score-15; v_issues:=array_append(v_issues,'too_short_under_8'); END IF;
  IF p_name=UPPER(p_name) AND p_name~'[A-Za-z]{3,}' THEN v_score:=v_score-15; v_issues:=array_append(v_issues,'all_uppercase_variant_style'); END IF;
  IF p_name!~'[A-Za-z0-9]' THEN v_score:=v_score-10; v_issues:=array_append(v_issues,'no_alphanumeric'); END IF;
  IF p_name~U&'[\\2018\\2019]' THEN v_score:=v_score-5; v_issues:=array_append(v_issues,'curly_quotes'); END IF;
  v_score:=GREATEST(0,LEAST(100,v_score));
  RETURN jsonb_build_object('score',v_score,'issues',v_issues,'length',length(p_name),'grade',
    CASE WHEN v_score>=90 THEN 'A' WHEN v_score>=75 THEN 'B' WHEN v_score>=60 THEN 'C' WHEN v_score>=40 THEN 'D' ELSE 'F' END);
END;
$function$;
COMMENT ON FUNCTION public.fn_product_name_quality_score(text) IS 'Score 0-100 de qualidade de products.name. IMMUTABLE. NAO usar para product_variants.name.';
