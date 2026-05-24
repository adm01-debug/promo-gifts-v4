-- Fase 4 v2 - Drift check SQL nativo via pg_net
INSERT INTO public.system_settings (key,value,description) VALUES
  ('lovable_url','"https://pqpdolkaeqlyzpdpbizo.supabase.co"','Fase 4: URL do Supabase interno do Lovable Cloud.'),
  ('lovable_anon_key','null','Fase 4: ANON KEY do Lovable Cloud. Preencher manualmente.')
ON CONFLICT (key) DO NOTHING;

CREATE OR REPLACE FUNCTION public.fn_trigger_schema_drift_fetch()
RETURNS bigint LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v_lovable_url text; v_lovable_key text; v_request_id bigint;
BEGIN
  SELECT value#>>'{}' INTO v_lovable_url FROM public.system_settings WHERE key='lovable_url';
  SELECT value#>>'{}' INTO v_lovable_key FROM public.system_settings WHERE key='lovable_anon_key';
  IF v_lovable_url IS NULL OR v_lovable_url='null' THEN RAISE EXCEPTION 'lovable_url nao configurado'; END IF;
  IF v_lovable_key IS NULL OR v_lovable_key='null' THEN RAISE EXCEPTION 'lovable_anon_key nao configurado'; END IF;
  SELECT net.http_post(url:=v_lovable_url||'/rest/v1/rpc/get_public_schema_signatures',headers:=jsonb_build_object('apikey',v_lovable_key,'Authorization','Bearer '||v_lovable_key,'Content-Type','application/json'),body:='{}'::jsonb) INTO v_request_id;
  RETURN v_request_id;
END; $$;
REVOKE EXECUTE ON FUNCTION public.fn_trigger_schema_drift_fetch() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.fn_trigger_schema_drift_fetch() TO service_role;

CREATE OR REPLACE FUNCTION public.fn_compute_and_record_drift(p_lovable_signatures jsonb)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public AS $$
DECLARE v_oficial_sigs jsonb; v_only_oficial text[]; v_only_lovable text[]; v_diff jsonb:='{}'; v_has_drift boolean; v_tab_oficial int; v_tab_lovable int; v_log_payload jsonb; v_allowed text[];
BEGIN
  SELECT array_agg(table_name) INTO v_allowed FROM public.schema_drift_allowlist;
  v_allowed := COALESCE(v_allowed,ARRAY[]::text[]);
  v_oficial_sigs := public.get_public_schema_signatures();
  SELECT array_agg(k ORDER BY k) INTO v_only_oficial FROM jsonb_object_keys(v_oficial_sigs) k WHERE NOT (p_lovable_signatures?k) AND k!=ALL(v_allowed);
  SELECT array_agg(k ORDER BY k) INTO v_only_lovable FROM jsonb_object_keys(p_lovable_signatures) k WHERE NOT (v_oficial_sigs?k) AND k!=ALL(v_allowed);
  SELECT jsonb_object_agg(k,jsonb_build_object('oficial',v_oficial_sigs->k,'lovable',p_lovable_signatures->k)) INTO v_diff FROM jsonb_object_keys(v_oficial_sigs) k WHERE p_lovable_signatures?k AND (v_oficial_sigs->k)<>(p_lovable_signatures->k) AND k!=ALL(v_allowed);
  v_diff := COALESCE(v_diff,'{}');
  v_tab_oficial := (SELECT COUNT(*) FROM jsonb_object_keys(v_oficial_sigs));
  v_tab_lovable := (SELECT COUNT(*) FROM jsonb_object_keys(p_lovable_signatures));
  v_has_drift := (COALESCE(array_length(v_only_lovable,1),0)>0 OR (SELECT COUNT(*) FROM jsonb_object_keys(v_diff))>0);
  v_log_payload := jsonb_build_object('has_drift',v_has_drift,'tables_oficial',v_tab_oficial,'tables_lovable',v_tab_lovable,'only_oficial',COALESCE(to_jsonb(v_only_oficial),'[]'),'only_lovable',COALESCE(to_jsonb(v_only_lovable),'[]'),'schema_diff',v_diff,'allowlist_applied',to_jsonb(v_allowed));
  RETURN public.record_schema_drift_result(v_log_payload);
END; $$;
REVOKE EXECUTE ON FUNCTION public.fn_compute_and_record_drift(jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.fn_compute_and_record_drift(jsonb) TO service_role;

CREATE OR REPLACE FUNCTION public.fn_run_schema_drift_check()
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v_request_id bigint; v_response jsonb; v_lovable_sigs jsonb; v_log_id uuid; v_attempts int:=0; v_max_attempts int:=30; v_status_code int;
BEGIN
  v_request_id := public.fn_trigger_schema_drift_fetch();
  LOOP
    v_attempts := v_attempts+1;
    PERFORM pg_sleep(1);
    SELECT status_code, content::jsonb INTO v_status_code, v_response FROM net._http_response WHERE id=v_request_id;
    EXIT WHEN v_status_code IS NOT NULL;
    IF v_attempts >= v_max_attempts THEN
      v_log_id := public.record_schema_drift_result(jsonb_build_object('has_drift',false,'tables_oficial',0,'tables_lovable',0,'only_oficial','[]','only_lovable','[]','schema_diff','{}','error_message',format('Timeout (request_id=%s)',v_request_id)));
      RETURN jsonb_build_object('ok',false,'error','timeout','log_id',v_log_id);
    END IF;
  END LOOP;
  IF v_status_code!=200 THEN
    v_log_id := public.record_schema_drift_result(jsonb_build_object('has_drift',false,'tables_oficial',0,'tables_lovable',0,'only_oficial','[]','only_lovable','[]','schema_diff','{}','error_message',format('HTTP %s',v_status_code)));
    RETURN jsonb_build_object('ok',false,'error','http_'||v_status_code,'log_id',v_log_id);
  END IF;
  v_lovable_sigs := v_response;
  v_log_id := public.fn_compute_and_record_drift(v_lovable_sigs);
  RETURN jsonb_build_object('ok',true,'log_id',v_log_id,'request_id',v_request_id);
END; $$;
REVOKE EXECUTE ON FUNCTION public.fn_run_schema_drift_check() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.fn_run_schema_drift_check() TO service_role;
