-- LOTE F 3/4 - auto_block_extreme_offenders
CREATE OR REPLACE FUNCTION public.auto_block_extreme_offenders()
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE _row record; _admin record; _blocked_count int:=0; _system_uid uuid; _expires timestamptz:=now()+interval '6 hours';
BEGIN
  SELECT user_id INTO _system_uid
  FROM public.user_roles
  WHERE role IN ('dev','supervisor')
  ORDER BY CASE role
    WHEN 'dev' THEN 1
    WHEN 'supervisor' THEN 2
    ELSE 3
  END, created_at ASC
  LIMIT 1;
  IF _system_uid IS NULL THEN RETURN jsonb_build_object('ok',false,'reason','no_privileged_user_for_system_actor'); END IF;
  FOR _row IN
    WITH offenders AS (
      SELECT ip_address, count(*) AS cnt FROM (
        SELECT ip_address FROM public.login_attempts WHERE success=false AND created_at>now()-interval '1 hour' AND ip_address IS NOT NULL AND ip_address<>'unknown'
        UNION ALL SELECT ip_address FROM public.public_token_failures WHERE created_at>now()-interval '1 hour' AND ip_address IS NOT NULL
        UNION ALL SELECT ip_address FROM public.bot_detection_log WHERE blocked=true AND created_at>now()-interval '1 hour' AND ip_address IS NOT NULL
      ) s GROUP BY ip_address HAVING count(*)>=30
    )
    SELECT o.ip_address, o.cnt FROM offenders o
    WHERE NOT EXISTS (SELECT 1 FROM public.ip_access_control iac WHERE iac.ip_address=o.ip_address AND iac.list_type='block' AND (iac.expires_at IS NULL OR iac.expires_at>now()))
  LOOP
    INSERT INTO public.ip_access_control (ip_address,list_type,reason,expires_at,created_by)
    VALUES (_row.ip_address,'block',format('Auto-bloqueio: %s ofensas em 1h',_row.cnt),_expires,_system_uid);
    INSERT INTO public.admin_audit_log (user_id,action,resource_type,resource_id,ip_address,details)
    VALUES (_system_uid,'auto_ip_block','ip_access_control',_row.ip_address,_row.ip_address,jsonb_build_object('offense_count',_row.cnt,'expires_at',_expires,'window','1h'));
    FOR _admin IN
      SELECT user_id
      FROM public.user_roles
      WHERE role IN ('dev','supervisor')
    LOOP
      IF NOT EXISTS (SELECT 1 FROM public.workspace_notifications WHERE user_id=_admin.user_id AND category='security' AND title='IP auto-bloqueado' AND metadata->>'ip'=_row.ip_address AND created_at>now()-interval '1 hour') THEN
        INSERT INTO public.workspace_notifications (user_id,title,message,type,category,action_url,metadata)
        VALUES (_admin.user_id,'IP auto-bloqueado',format('IP %s bloqueado por 6h apos %s ofensas em 1h.',_row.ip_address,_row.cnt),'warning','security','/admin/seguranca-acesso',jsonb_build_object('ip',_row.ip_address,'offense_count',_row.cnt,'expires_at',_expires));
      END IF;
    END LOOP;
    _blocked_count:=_blocked_count+1;
  END LOOP;
  RETURN jsonb_build_object('ok',true,'blocked',_blocked_count,'ran_at',now());
END; $$;
REVOKE EXECUTE ON FUNCTION public.auto_block_extreme_offenders() FROM PUBLIC, anon, authenticated;
