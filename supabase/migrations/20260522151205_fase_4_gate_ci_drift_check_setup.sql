-- Fase 4 - Setup gate CI: schema_drift_log + RPCs
CREATE TABLE IF NOT EXISTS public.schema_drift_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ran_at timestamptz NOT NULL DEFAULT now(),
  has_drift boolean NOT NULL,
  tables_oficial integer NOT NULL,
  tables_lovable integer NOT NULL,
  only_oficial text[] DEFAULT ARRAY[]::text[],
  only_lovable text[] DEFAULT ARRAY[]::text[],
  schema_diff jsonb DEFAULT '{}'::jsonb,
  notification_sent boolean DEFAULT false,
  error_message text
);
ALTER TABLE public.schema_drift_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins read schema_drift_log" ON public.schema_drift_log FOR SELECT TO authenticated USING (is_admin(auth.uid()));
CREATE INDEX idx_sdl_ran_at ON public.schema_drift_log(ran_at DESC);
CREATE INDEX idx_sdl_drift ON public.schema_drift_log(has_drift,ran_at DESC) WHERE has_drift=true;

CREATE OR REPLACE FUNCTION public.get_public_schema_signatures()
RETURNS jsonb LANGUAGE sql SECURITY DEFINER STABLE SET search_path TO 'public' AS $$
  SELECT COALESCE(jsonb_object_agg(table_name, sig), '{}'::jsonb) FROM
  (SELECT table_name, string_agg(column_name||':'||data_type,',') AS sig
   FROM information_schema.columns WHERE table_schema='public' AND table_name NOT LIKE '_backup_%' AND table_name NOT LIKE 'pg_%'
   GROUP BY table_name) t;
$$;
REVOKE EXECUTE ON FUNCTION public.get_public_schema_signatures() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_public_schema_signatures() TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.record_schema_drift_result(p_result jsonb)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v_log_id uuid; v_has_drift boolean; v_only_oficial text[]; v_only_lovable text[]; v_schema_diff jsonb; v_diff_count integer; v_notify_count integer:=0;
BEGIN
  v_has_drift := COALESCE((p_result->>'has_drift')::boolean,false);
  v_only_oficial := COALESCE(ARRAY(SELECT jsonb_array_elements_text(p_result->'only_oficial')),ARRAY[]::text[]);
  v_only_lovable := COALESCE(ARRAY(SELECT jsonb_array_elements_text(p_result->'only_lovable')),ARRAY[]::text[]);
  v_schema_diff := COALESCE(p_result->'schema_diff','{}');
  v_diff_count := (SELECT COUNT(*) FROM jsonb_object_keys(v_schema_diff));
  INSERT INTO public.schema_drift_log (has_drift,tables_oficial,tables_lovable,only_oficial,only_lovable,schema_diff,error_message)
  VALUES (v_has_drift,COALESCE((p_result->>'tables_oficial')::integer,0),COALESCE((p_result->>'tables_lovable')::integer,0),v_only_oficial,v_only_lovable,v_schema_diff,NULLIF(p_result->>'error_message',''))
  RETURNING id INTO v_log_id;
  IF v_has_drift THEN
    INSERT INTO public.workspace_notifications (user_id,title,message,type,category,metadata)
    SELECT ur.user_id,'Schema drift detectado',format('Schema divergem. only_oficial: %s; only_lovable: %s; tables diff: %s',COALESCE(array_length(v_only_oficial,1),0),COALESCE(array_length(v_only_lovable,1),0),v_diff_count),'warning','system',jsonb_build_object('log_id',v_log_id,'source','schema-drift-check','only_oficial',v_only_oficial,'only_lovable',v_only_lovable)
    FROM public.user_roles ur WHERE ur.role='admin';
    GET DIAGNOSTICS v_notify_count=ROW_COUNT;
    UPDATE public.schema_drift_log SET notification_sent=(v_notify_count>0) WHERE id=v_log_id;
  END IF;
  RETURN v_log_id;
END; $$;
REVOKE EXECUTE ON FUNCTION public.record_schema_drift_result(jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.record_schema_drift_result(jsonb) TO service_role;
