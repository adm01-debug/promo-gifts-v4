-- Fase 4 fix - substituir jsonb_object_length pela alternativa portavel
CREATE OR REPLACE FUNCTION public.fn_compute_and_record_drift(p_lovable_signatures jsonb)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public AS $$
DECLARE v_oficial_sigs jsonb; v_only_oficial text[]; v_only_lovable text[]; v_diff jsonb:='{}'; v_diff_count integer:=0; v_table text; v_has_drift boolean; v_tab_oficial int; v_tab_lovable int; v_log_payload jsonb; v_allowed text[];
BEGIN
  SELECT array_agg(table_name) INTO v_allowed FROM public.schema_drift_allowlist;
  v_allowed := COALESCE(v_allowed,ARRAY[]::text[]);
  v_oficial_sigs := public.get_public_schema_signatures();
  v_only_oficial := ARRAY(SELECT k FROM unnest(ARRAY(SELECT jsonb_object_keys(v_oficial_sigs) ORDER BY 1)) k WHERE NOT (p_lovable_signatures?k) AND k!=ALL(v_allowed) ORDER BY k);
  v_only_lovable := ARRAY(SELECT k FROM unnest(ARRAY(SELECT jsonb_object_keys(p_lovable_signatures) ORDER BY 1)) k WHERE NOT (v_oficial_sigs?k) AND k!=ALL(v_allowed) ORDER BY k);
  FOREACH v_table IN ARRAY ARRAY(SELECT jsonb_object_keys(v_oficial_sigs) ORDER BY 1) LOOP
    IF (p_lovable_signatures?v_table) AND (v_oficial_sigs->>v_table) IS DISTINCT FROM (p_lovable_signatures->>v_table) AND v_table!=ALL(v_allowed) THEN
      v_diff := v_diff||jsonb_build_object(v_table,jsonb_build_object('oficial',v_oficial_sigs->>v_table,'lovable',p_lovable_signatures->>v_table));
      v_diff_count := v_diff_count+1;
    END IF;
  END LOOP;
  v_has_drift := (COALESCE(array_length(v_only_lovable,1),0)>0 OR v_diff_count>0);
  v_log_payload := jsonb_build_object('has_drift',v_has_drift,'tables_oficial',COALESCE(array_length(ARRAY(SELECT jsonb_object_keys(v_oficial_sigs)),1),0),'tables_lovable',COALESCE(array_length(ARRAY(SELECT jsonb_object_keys(p_lovable_signatures)),1),0),'only_oficial',COALESCE(to_jsonb(v_only_oficial),'[]'),'only_lovable',COALESCE(to_jsonb(v_only_lovable),'[]'),'schema_diff',v_diff);
  RETURN public.record_schema_drift_result(v_log_payload);
END; $$;
