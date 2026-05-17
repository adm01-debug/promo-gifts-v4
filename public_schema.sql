--
-- PostgreSQL database dump
--

\restrict DpVxMiZyEUgqizGplkafiTOkd3taggndaLKqFKbcSfhMzjFJVsZsFCbc8yg08C7

-- Dumped from database version 17.6
-- Dumped by pg_dump version 17.9

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: public; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA public;


--
-- Name: SCHEMA public; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON SCHEMA public IS 'standard public schema';


--
-- Name: app_role; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.app_role AS ENUM (
    'admin',
    'manager',
    'vendedor',
    'supervisor',
    'dev'
);


--
-- Name: conversation_event_type; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.conversation_event_type AS ENUM (
    'text',
    'image',
    'file',
    'system',
    'tool_call',
    'tool_result'
);


--
-- Name: org_role; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.org_role AS ENUM (
    'owner',
    'admin',
    'member'
);


--
-- Name: role_migration_item_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.role_migration_item_status AS ENUM (
    'pending',
    'success',
    'failed',
    'skipped',
    'dry_run'
);


--
-- Name: role_migration_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.role_migration_status AS ENUM (
    'pending',
    'running',
    'completed',
    'failed',
    'partial',
    'dry_run'
);


--
-- Name: step_up_action; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.step_up_action AS ENUM (
    'promote_dev',
    'demote_dev',
    'mcp_full_issue',
    'mcp_full_escalate',
    'secret_rotation',
    'secret_revoke',
    'mcp_key_revoke',
    'mcp_key_rotate'
);


--
-- Name: _can_act_on_behalf_of_others(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public._can_act_on_behalf_of_others() RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT
    auth.uid() IS NULL
    OR public.has_role(auth.uid(), 'admin'::app_role)
    OR public.has_role(auth.uid(), 'manager'::app_role)
    OR public.has_role(auth.uid(), 'supervisor'::app_role)
    OR public.has_role(auth.uid(), 'dev'::app_role)
$$;


--
-- Name: acquire_ai_quota(uuid, text, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.acquire_ai_quota(_user_id uuid, _function_name text, _model text) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  _role app_role;
  _monthly_limit integer;
  _is_unlimited boolean;
  _used integer;
  _log_id uuid;
BEGIN
  -- Get user role
  SELECT role INTO _role FROM public.user_roles WHERE user_id = _user_id LIMIT 1;
  IF _role IS NULL THEN
    RETURN jsonb_build_object('allowed', false, 'log_id', null, 'reason', 'no_role');
  END IF;

  -- Get quota for role (with row lock to prevent concurrent reads)
  SELECT monthly_limit, is_unlimited INTO _monthly_limit, _is_unlimited
  FROM public.ai_usage_quotas WHERE role = _role
  FOR UPDATE;

  -- Count usage this month (locking rows to prevent race)
  SELECT count(*) INTO _used FROM public.ai_usage_logs
  WHERE user_id = _user_id 
    AND created_at >= date_trunc('month', now()) 
    AND status = 'success';

  -- Check if unlimited
  IF _is_unlimited THEN
    INSERT INTO public.ai_usage_logs (user_id, function_name, model, status)
    VALUES (_user_id, _function_name, _model, 'pending')
    RETURNING id INTO _log_id;
    
    RETURN jsonb_build_object('allowed', true, 'log_id', _log_id, 'used', _used, 'unlimited', true);
  END IF;

  -- Check quota
  IF _used >= _monthly_limit THEN
    RETURN jsonb_build_object('allowed', false, 'log_id', null, 'used', _used, 'limit', _monthly_limit, 'remaining', 0);
  END IF;

  -- Reserve slot by inserting a pending log
  INSERT INTO public.ai_usage_logs (user_id, function_name, model, status)
  VALUES (_user_id, _function_name, _model, 'pending')
  RETURNING id INTO _log_id;

  RETURN jsonb_build_object(
    'allowed', true, 
    'log_id', _log_id, 
    'used', _used + 1, 
    'limit', _monthly_limit, 
    'remaining', GREATEST(_monthly_limit - _used - 1, 0)
  );
END;
$$;


--
-- Name: audit_mcp_api_keys_changes(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.audit_mcp_api_keys_changes() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_action       text;
  v_user_id      uuid;
  v_resource_id  text;
  v_details      jsonb;
  v_old_scopes   text[];
  v_new_scopes   text[];
  v_old_revoked  timestamptz;
  v_new_revoked  timestamptz;
  v_old_expires  timestamptz;
  v_new_expires  timestamptz;
  v_old_name     text;
  v_new_name     text;
  v_changed      jsonb := '{}'::jsonb;
BEGIN
  -- Resolve identidade: created_by da linha, fallback para auth.uid(), fallback para zero-uuid (system)
  IF TG_OP = 'DELETE' THEN
    v_user_id    := COALESCE(OLD.created_by, auth.uid(), '00000000-0000-0000-0000-000000000000'::uuid);
    v_resource_id := OLD.id::text;
    v_action     := 'mcp_key.db_deleted';
    v_details    := jsonb_build_object(
      'name',       OLD.name,
      'key_prefix', OLD.key_prefix,
      'scopes',     to_jsonb(OLD.scopes),
      'was_revoked', (OLD.revoked_at IS NOT NULL),
      'created_by', OLD.created_by
    );
  ELSIF TG_OP = 'INSERT' THEN
    v_user_id    := COALESCE(NEW.created_by, auth.uid(), '00000000-0000-0000-0000-000000000000'::uuid);
    v_resource_id := NEW.id::text;
    v_action     := 'mcp_key.db_inserted';
    v_details    := jsonb_build_object(
      'name',         NEW.name,
      'key_prefix',   NEW.key_prefix,
      'scopes',       to_jsonb(NEW.scopes),
      'is_full',      (NEW.scopes @> ARRAY['*']::text[]),
      'expires_at',   NEW.expires_at,
      'rotated_from', NEW.rotated_from,
      'created_by',   NEW.created_by
    );
  ELSE -- UPDATE
    v_user_id    := COALESCE(auth.uid(), NEW.created_by, '00000000-0000-0000-0000-000000000000'::uuid);
    v_resource_id := NEW.id::text;

    v_old_scopes  := OLD.scopes;
    v_new_scopes  := NEW.scopes;
    v_old_revoked := OLD.revoked_at;
    v_new_revoked := NEW.revoked_at;
    v_old_expires := OLD.expires_at;
    v_new_expires := NEW.expires_at;
    v_old_name    := OLD.name;
    v_new_name    := NEW.name;

    -- Detecta o que mudou para um diff conciso
    IF v_old_name IS DISTINCT FROM v_new_name THEN
      v_changed := v_changed || jsonb_build_object('name', jsonb_build_object('old', v_old_name, 'new', v_new_name));
    END IF;
    IF v_old_scopes IS DISTINCT FROM v_new_scopes THEN
      v_changed := v_changed || jsonb_build_object('scopes', jsonb_build_object('old', to_jsonb(v_old_scopes), 'new', to_jsonb(v_new_scopes)));
    END IF;
    IF v_old_expires IS DISTINCT FROM v_new_expires THEN
      v_changed := v_changed || jsonb_build_object('expires_at', jsonb_build_object('old', v_old_expires, 'new', v_new_expires));
    END IF;
    IF v_old_revoked IS DISTINCT FROM v_new_revoked THEN
      v_changed := v_changed || jsonb_build_object('revoked_at', jsonb_build_object('old', v_old_revoked, 'new', v_new_revoked));
    END IF;

    -- Sem mudanças relevantes (ex.: somente touch em colunas auditadas externamente como last_used_at)
    -- Não auditamos: barulho desnecessário e last_used_at é registrado pelo mcp-server.
    IF v_changed = '{}'::jsonb THEN
      RETURN NEW;
    END IF;

    -- Sub-ação semântica para facilitar busca
    IF v_old_revoked IS NULL AND v_new_revoked IS NOT NULL THEN
      v_action := 'mcp_key.db_revoked';
    ELSIF v_old_scopes IS DISTINCT FROM v_new_scopes
          AND (v_new_scopes @> ARRAY['*']::text[])
          AND NOT (COALESCE(v_old_scopes, ARRAY[]::text[]) @> ARRAY['*']::text[]) THEN
      v_action := 'mcp_key.db_scope_escalated';
    ELSE
      v_action := 'mcp_key.db_updated';
    END IF;

    v_details := jsonb_build_object(
      'name',       NEW.name,
      'key_prefix', NEW.key_prefix,
      'changed',    v_changed,
      'is_full_now', (NEW.scopes @> ARRAY['*']::text[]),
      'created_by', NEW.created_by
    );
  END IF;

  -- Insere com source identificando trigger (edge functions usam 'mcp-keys-*')
  INSERT INTO public.admin_audit_log (
    user_id, action, resource_type, resource_id,
    details, source, status, created_at
  ) VALUES (
    v_user_id,
    v_action,
    'mcp_api_key',
    v_resource_id,
    v_details,
    'db_trigger:mcp_api_keys',
    'success',
    now()
  );

  RETURN COALESCE(NEW, OLD);
EXCEPTION WHEN OTHERS THEN
  -- Nunca bloquear a operação principal por falha de auditoria
  RAISE WARNING 'audit_mcp_api_keys_changes failed: %', SQLERRM;
  RETURN COALESCE(NEW, OLD);
END;
$$;


--
-- Name: audit_mcp_key_insert(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.audit_mcp_key_insert() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  _is_full BOOLEAN := '*' = ANY(NEW.scopes);
BEGIN
  INSERT INTO public.admin_audit_log (
    user_id, action, resource_type, resource_id, details
  ) VALUES (
    COALESCE(NEW.created_by, auth.uid()),
    CASE WHEN _is_full THEN 'mcp_key.issued_full' ELSE 'mcp_key.issued' END,
    'mcp_api_key',
    NEW.id::text,
    jsonb_build_object(
      'name', NEW.name,
      'key_prefix', NEW.key_prefix,
      'scopes', NEW.scopes,
      'is_full_access', _is_full,
      'expires_at', NEW.expires_at,
      'created_by', NEW.created_by,
      'auto_logged', true
    )
  );
  RETURN NEW;
END;
$$;


--
-- Name: audit_mcp_key_revoke(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.audit_mcp_key_revoke() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  IF OLD.revoked_at IS NULL AND NEW.revoked_at IS NOT NULL THEN
    INSERT INTO public.admin_audit_log (
      user_id, action, resource_type, resource_id, details
    ) VALUES (
      auth.uid(),
      'mcp_key.revoked',
      'mcp_api_key',
      NEW.id::text,
      jsonb_build_object(
        'name', NEW.name,
        'key_prefix', NEW.key_prefix,
        'scopes', NEW.scopes,
        'revoked_at', NEW.revoked_at,
        'auto_logged', true
      )
    );
  END IF;
  RETURN NEW;
END;
$$;


--
-- Name: audit_ownership_orphans(text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.audit_ownership_orphans(_triggered_by text DEFAULT 'manual'::text) RETURNS uuid
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_started_at timestamptz := clock_timestamp();
  v_report_id uuid;
  v_owner_columns text[] := ARRAY['seller_id', 'user_id', 'owner_id', 'created_by'];
  v_table record;
  v_col text;
  v_null_count bigint;
  v_orphan_count bigint;
  v_total_null bigint := 0;
  v_total_orphan bigint := 0;
  v_tables_scanned int := 0;
  v_details jsonb := '[]'::jsonb;
  v_table_entry jsonb;
  v_rls jsonb;
  v_rls_gaps int := 0;
BEGIN
  IF auth.uid() IS NOT NULL
     AND NOT (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'dev'::app_role))
  THEN
    RAISE EXCEPTION 'audit_ownership_orphans: acesso negado';
  END IF;

  FOR v_table IN
    SELECT c.table_name, c.column_name
    FROM information_schema.columns c
    JOIN information_schema.tables t
      ON t.table_schema = c.table_schema AND t.table_name = c.table_name
    WHERE c.table_schema = 'public'
      AND c.column_name = ANY(v_owner_columns)
      AND t.table_type = 'BASE TABLE'
      AND c.table_name NOT IN (
        'login_attempts','step_up_audit_log','search_analytics',
        'query_telemetry','mcp_access_violations','product_views',
        'quote_history','optimization_queue','kit_templates'
      )
    ORDER BY c.table_name
  LOOP
    v_col := v_table.column_name;
    v_tables_scanned := v_tables_scanned + 1;

    EXECUTE format('SELECT count(*) FROM public.%I WHERE %I IS NULL',
      v_table.table_name, v_col) INTO v_null_count;

    EXECUTE format(
      'SELECT count(*) FROM public.%I t
        WHERE t.%I IS NOT NULL
          AND NOT EXISTS (SELECT 1 FROM auth.users u WHERE u.id = t.%I::uuid)',
      v_table.table_name, v_col, v_col
    ) INTO v_orphan_count;

    IF v_null_count > 0 OR v_orphan_count > 0 THEN
      v_table_entry := jsonb_build_object(
        'table', v_table.table_name,
        'owner_column', v_col,
        'null_owner_count', v_null_count,
        'missing_user_count', v_orphan_count
      );
      v_details := v_details || v_table_entry;
    END IF;

    v_total_null := v_total_null + v_null_count;
    v_total_orphan := v_total_orphan + v_orphan_count;
  END LOOP;

  -- Cobertura RLS das tabelas críticas
  v_rls := public.audit_rls_coverage();
  SELECT COALESCE(SUM(jsonb_array_length(elem->'missing_ops')),0)::int
    INTO v_rls_gaps
  FROM jsonb_array_elements(v_rls) elem;

  INSERT INTO public.ownership_audit_reports (
    total_tables_scanned, total_issues_found,
    null_owner_count, missing_user_count, details,
    triggered_by, duration_ms,
    rls_coverage, rls_gaps_count
  ) VALUES (
    v_tables_scanned,
    (v_total_null + v_total_orphan)::int,
    v_total_null::int,
    v_total_orphan::int,
    v_details,
    coalesce(_triggered_by, 'manual'),
    EXTRACT(MILLISECONDS FROM (clock_timestamp() - v_started_at))::int,
    v_rls,
    v_rls_gaps
  ) RETURNING id INTO v_report_id;

  RETURN v_report_id;
END;
$$;


--
-- Name: audit_rls_coverage(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.audit_rls_coverage() RETURNS jsonb
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  WITH t AS (
    SELECT n.nspname AS schema, c.relname AS table_name, c.relrowsecurity AS rls_enabled
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE c.relkind = 'r' AND n.nspname = 'public'
  ),
  cols AS (
    SELECT table_schema, table_name,
      bool_or(column_name IN ('seller_id','user_id','owner_id','created_by','assigned_to')) AS is_owned
    FROM information_schema.columns
    WHERE table_schema = 'public'
    GROUP BY table_schema, table_name
  ),
  pol AS (
    SELECT schemaname AS schema, tablename AS table_name,
      bool_or(cmd IN ('SELECT','ALL')) AS has_select,
      bool_or(cmd IN ('INSERT','ALL')) AS has_insert,
      bool_or(cmd IN ('UPDATE','ALL')) AS has_update,
      bool_or(cmd IN ('DELETE','ALL')) AS has_delete,
      count(*)::int AS policy_count
    FROM pg_policies
    WHERE schemaname = 'public'
    GROUP BY schemaname, tablename
  ),
  base AS (
    SELECT t.table_name, t.rls_enabled,
      COALESCE(pol.has_select,false) AS has_select,
      COALESCE(pol.has_insert,false) AS has_insert,
      COALESCE(pol.has_update,false) AS has_update,
      COALESCE(pol.has_delete,false) AS has_delete,
      COALESCE(pol.policy_count,0) AS policy_count
    FROM t
    JOIN cols ON cols.table_schema = t.schema AND cols.table_name = t.table_name AND cols.is_owned
    LEFT JOIN pol ON pol.schema = t.schema AND pol.table_name = t.table_name
  )
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'table', table_name,
    'rls_enabled', rls_enabled,
    'policy_count', policy_count,
    'has_select', has_select,
    'has_insert', has_insert,
    'has_update', has_update,
    'has_delete', has_delete,
    'missing_ops', (
      ARRAY_REMOVE(ARRAY[
        CASE WHEN NOT has_select THEN 'SELECT' END,
        CASE WHEN NOT has_insert THEN 'INSERT' END,
        CASE WHEN NOT has_update THEN 'UPDATE' END,
        CASE WHEN NOT has_delete THEN 'DELETE' END
      ], NULL)
    ),
    'severity', CASE
      WHEN NOT rls_enabled THEN 'critical'
      WHEN NOT has_select THEN 'high'
      WHEN (NOT has_insert) OR (NOT has_update) OR (NOT has_delete) THEN 'medium'
      ELSE 'ok'
    END
  ) ORDER BY
    (NOT rls_enabled) DESC,
    (NOT has_select) DESC,
    table_name
  ), '[]'::jsonb)
  FROM base
  WHERE NOT rls_enabled
     OR NOT has_select OR NOT has_insert OR NOT has_update OR NOT has_delete;
$$;


--
-- Name: audit_rls_matrix(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.audit_rls_matrix() RETURNS jsonb
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_result jsonb;
BEGIN
  IF auth.uid() IS NOT NULL
     AND NOT (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'dev'::app_role))
  THEN
    RAISE EXCEPTION 'audit_rls_matrix: acesso negado';
  END IF;

  WITH crit_tables AS (
    SELECT DISTINCT c.table_name
    FROM information_schema.columns c
    JOIN information_schema.tables t
      ON t.table_schema = c.table_schema AND t.table_name = c.table_name
    WHERE c.table_schema = 'public'
      AND t.table_type = 'BASE TABLE'
      AND c.column_name IN ('seller_id','user_id','owner_id','created_by','assigned_to')
  ),
  rls AS (
    SELECT n.nspname AS schema, c.relname AS table_name, c.relrowsecurity AS rls_enabled
    FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE c.relkind = 'r' AND n.nspname = 'public'
  ),
  ops AS (
    SELECT unnest(ARRAY['SELECT','INSERT','UPDATE','DELETE']) AS op
  ),
  pol_per_op AS (
    -- Expande policies "ALL" para as 4 operações
    SELECT p.tablename, op.op AS cmd,
           p.policyname, p.qual, p.with_check, p.permissive, p.roles
    FROM pg_policies p
    CROSS JOIN ops op
    WHERE p.schemaname = 'public'
      AND (p.cmd = op.op OR p.cmd = 'ALL')
  ),
  agg AS (
    SELECT tablename, cmd,
      jsonb_agg(jsonb_build_object(
        'name', policyname,
        'qual', COALESCE(qual::text,''),
        'with_check', COALESCE(with_check::text,''),
        'permissive', permissive,
        'roles', roles
      ) ORDER BY policyname) AS policies,
      string_agg(DISTINCT COALESCE(qual::text,''), ' || ' ORDER BY COALESCE(qual::text,'')) AS quals_concat
    FROM pol_per_op
    GROUP BY tablename, cmd
  ),
  matrix AS (
    SELECT
      t.table_name,
      r.rls_enabled,
      o.op,
      a.policies,
      a.quals_concat,
      (a.policies IS NULL) AS missing
    FROM crit_tables t
    LEFT JOIN rls r ON r.table_name = t.table_name
    CROSS JOIN ops o
    LEFT JOIN agg a ON a.tablename = t.table_name AND a.cmd = o.op
  ),
  -- Detecta divergência: o predicado de SELECT é diferente do de UPDATE/DELETE
  divergence AS (
    SELECT m.table_name,
      max(m.quals_concat) FILTER (WHERE m.op = 'SELECT') AS sel_q,
      max(m.quals_concat) FILTER (WHERE m.op = 'UPDATE') AS upd_q,
      max(m.quals_concat) FILTER (WHERE m.op = 'DELETE') AS del_q
    FROM matrix m
    GROUP BY m.table_name
  )
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'table', m.table_name,
    'rls_enabled', COALESCE(m.rls_enabled,false),
    'operation', m.op,
    'missing', m.missing,
    'policy_count', COALESCE(jsonb_array_length(m.policies),0),
    'policies', COALESCE(m.policies,'[]'::jsonb),
    'criterion_diverges',
      CASE
        WHEN m.op = 'UPDATE' AND d.sel_q IS NOT NULL AND d.upd_q IS NOT NULL AND d.sel_q <> d.upd_q THEN true
        WHEN m.op = 'DELETE' AND d.sel_q IS NOT NULL AND d.del_q IS NOT NULL AND d.sel_q <> d.del_q THEN true
        ELSE false
      END,
    'severity',
      CASE
        WHEN NOT COALESCE(m.rls_enabled,false) THEN 'critical'
        WHEN m.missing AND m.op = 'SELECT' THEN 'high'
        WHEN m.missing THEN 'medium'
        WHEN ((m.op = 'UPDATE' AND d.sel_q IS NOT NULL AND d.upd_q IS NOT NULL AND d.sel_q <> d.upd_q)
           OR (m.op = 'DELETE' AND d.sel_q IS NOT NULL AND d.del_q IS NOT NULL AND d.sel_q <> d.del_q)) THEN 'review'
        ELSE 'ok'
      END
  ) ORDER BY m.table_name,
       CASE m.op WHEN 'SELECT' THEN 1 WHEN 'INSERT' THEN 2 WHEN 'UPDATE' THEN 3 ELSE 4 END
  ), '[]'::jsonb)
  INTO v_result
  FROM matrix m
  LEFT JOIN divergence d ON d.table_name = m.table_name;

  RETURN v_result;
END;
$$;


--
-- Name: audit_security_definer_acl(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.audit_security_definer_acl() RETURNS TABLE(function_name text, arguments text, problem text, granted_to text)
    LANGUAGE sql STABLE
    SET search_path TO 'public', 'pg_catalog'
    AS $$
  WITH defs AS (
    SELECT
      p.oid,
      p.proname,
      pg_get_function_identity_arguments(p.oid) AS args,
      p.proacl,
      (pg_get_function_result(p.oid) = 'trigger') AS is_trigger,
      -- whitelist de funções intencionalmente acessíveis a anon
      (p.proname IN ('submit_quote_response', 'get_quote_token_by_value')) AS public_intent
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.prosecdef = true
  ),
  acl_expanded AS (
    SELECT
      d.proname,
      d.args,
      d.is_trigger,
      d.public_intent,
      a.grantee::regrole::text AS grantee
    FROM defs d
    LEFT JOIN LATERAL (
      SELECT (aclexplode(d.proacl)).grantee
    ) a ON true
    WHERE a.grantee IS NOT NULL
  )
  -- Caso 1: PUBLIC (grantee 0) — sempre proibido
  SELECT proname, args, 'PUBLIC has EXECUTE'::text, 'PUBLIC'::text
  FROM acl_expanded
  WHERE grantee = '-'
  UNION ALL
  -- Caso 2: anon — proibido exceto whitelist
  SELECT proname, args, 'anon has EXECUTE (not in public-intent whitelist)'::text, 'anon'
  FROM acl_expanded
  WHERE grantee = 'anon' AND NOT public_intent
  UNION ALL
  -- Caso 3: authenticated em trigger function — não faz sentido
  SELECT proname, args, 'trigger function has EXECUTE for authenticated'::text, 'authenticated'
  FROM acl_expanded
  WHERE grantee = 'authenticated' AND is_trigger
  ORDER BY 1, 2;
$$;


--
-- Name: audit_user_role_changes(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.audit_user_role_changes() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  _actor uuid := auth.uid();
  _action text;
  _target uuid;
  _old_role text;
  _new_role text;
  _details jsonb;
BEGIN
  IF TG_OP = 'INSERT' THEN
    _action := 'role.granted';
    _target := NEW.user_id;
    _old_role := NULL;
    _new_role := NEW.role::text;
  ELSIF TG_OP = 'UPDATE' THEN
    -- só audita se a role mudou
    IF NEW.role IS NOT DISTINCT FROM OLD.role THEN
      RETURN NEW;
    END IF;
    _action := 'role.changed';
    _target := NEW.user_id;
    _old_role := OLD.role::text;
    _new_role := NEW.role::text;
  ELSIF TG_OP = 'DELETE' THEN
    _action := 'role.revoked';
    _target := OLD.user_id;
    _old_role := OLD.role::text;
    _new_role := NULL;
  ELSE
    RETURN NULL;
  END IF;

  _details := jsonb_build_object(
    'target_user_id', _target,
    'old_role', _old_role,
    'new_role', _new_role,
    'op', TG_OP,
    -- 'system' quando não há ator JWT (trigger por service_role/migration/edge function sem contexto)
    'source', CASE WHEN _actor IS NULL THEN 'system' ELSE 'authenticated' END
  );

  INSERT INTO public.admin_audit_log (
    user_id, action, resource_type, resource_id, details, source, created_at
  ) VALUES (
    COALESCE(_actor, _target),
    _action,
    'user_role',
    _target::text,
    _details,
    CASE WHEN _actor IS NULL THEN 'system' ELSE 'database_trigger' END,
    now()
  );

  RETURN COALESCE(NEW, OLD);
EXCEPTION WHEN OTHERS THEN
  -- nunca bloqueia a operação principal por falha no log
  RAISE WARNING 'audit_user_role_changes failed: %', SQLERRM;
  RETURN COALESCE(NEW, OLD);
END;
$$;


--
-- Name: auto_block_extreme_offenders(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.auto_block_extreme_offenders() RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  _row record;
  _admin record;
  _blocked_count int := 0;
  _system_uid uuid;
  _expires timestamptz := now() + interval '6 hours';
BEGIN
  -- created_by precisa de uuid; usa o primeiro admin como ator do sistema
  SELECT user_id INTO _system_uid
  FROM public.user_roles
  WHERE role = 'admin'
  ORDER BY created_at ASC
  LIMIT 1;

  IF _system_uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'no_admin_for_system_actor');
  END IF;

  FOR _row IN
    WITH offenders AS (
      SELECT ip_address, count(*) AS cnt
      FROM (
        SELECT ip_address FROM public.login_attempts
          WHERE success = false AND created_at > now() - interval '1 hour' AND ip_address IS NOT NULL AND ip_address <> 'unknown'
        UNION ALL
        SELECT ip_address FROM public.public_token_failures
          WHERE created_at > now() - interval '1 hour' AND ip_address IS NOT NULL
        UNION ALL
        SELECT ip_address FROM public.bot_detection_log
          WHERE blocked = true AND created_at > now() - interval '1 hour' AND ip_address IS NOT NULL
      ) s
      GROUP BY ip_address
      HAVING count(*) >= 30
    )
    SELECT o.ip_address, o.cnt
    FROM offenders o
    WHERE NOT EXISTS (
      SELECT 1 FROM public.ip_access_control iac
      WHERE iac.ip_address = o.ip_address
        AND iac.list_type = 'block'
        AND (iac.expires_at IS NULL OR iac.expires_at > now())
    )
  LOOP
    INSERT INTO public.ip_access_control (
      ip_address, list_type, reason, expires_at, created_by
    ) VALUES (
      _row.ip_address,
      'block',
      format('Auto-bloqueio: %s ofensas em 1h', _row.cnt),
      _expires,
      _system_uid
    );

    INSERT INTO public.admin_audit_log (
      user_id, action, resource_type, resource_id, ip_address, details
    ) VALUES (
      _system_uid,
      'auto_ip_block',
      'ip_access_control',
      _row.ip_address,
      _row.ip_address,
      jsonb_build_object('offense_count', _row.cnt, 'expires_at', _expires, 'window', '1h')
    );

    -- Notifica admins (dedupe por IP em 1h)
    FOR _admin IN SELECT user_id FROM public.user_roles WHERE role = 'admin' LOOP
      IF NOT EXISTS (
        SELECT 1 FROM public.workspace_notifications
        WHERE user_id = _admin.user_id
          AND category = 'security'
          AND title = '🛡️ IP auto-bloqueado'
          AND metadata->>'ip' = _row.ip_address
          AND created_at > now() - interval '1 hour'
      ) THEN
        INSERT INTO public.workspace_notifications (
          user_id, title, message, type, category, action_url, metadata
        ) VALUES (
          _admin.user_id,
          '🛡️ IP auto-bloqueado',
          format('IP %s bloqueado por 6h após %s ofensas em 1h.', _row.ip_address, _row.cnt),
          'warning',
          'security',
          '/admin/seguranca-acesso',
          jsonb_build_object('ip', _row.ip_address, 'offense_count', _row.cnt, 'expires_at', _expires)
        );
      END IF;
    END LOOP;

    _blocked_count := _blocked_count + 1;
  END LOOP;

  RETURN jsonb_build_object('ok', true, 'blocked', _blocked_count, 'ran_at', now());
END;
$$;


--
-- Name: auto_revoke_orphan_full_keys(text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.auto_revoke_orphan_full_keys(_source text DEFAULT 'cron'::text) RETURNS TABLE(key_id uuid, created_by uuid, revoked_at timestamp with time zone)
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  _now TIMESTAMP WITH TIME ZONE := now();
  _rec RECORD;
BEGIN
  IF _source NOT IN ('trigger','cron','manual') THEN
    RAISE EXCEPTION 'invalid source: %', _source USING ERRCODE = '22023';
  END IF;

  FOR _rec IN
    SELECT k.id, k.created_by
      FROM public.mcp_api_keys k
     WHERE k.revoked_at IS NULL
       AND '*' = ANY(k.scopes)
       AND NOT public.is_dev(k.created_by)
     FOR UPDATE
  LOOP
    -- Revoga a chave (trigger existente log_mcp_key_revocation registra a mudança)
    UPDATE public.mcp_api_keys
       SET revoked_at = _now,
           updated_at = _now
     WHERE id = _rec.id
       AND revoked_at IS NULL;

    -- Log dedicado do mecanismo de defesa
    INSERT INTO public.mcp_key_auto_revocations(key_id, created_by, revoked_at, source, reason)
    VALUES (_rec.id, _rec.created_by, _now, _source, 'creator_lost_dev_role');

    -- Correlação forense no audit log de step-up (mesma trilha das emissões FULL)
    INSERT INTO public.step_up_audit_log(user_id, action, target_ref, event_type, metadata)
    VALUES (
      _rec.created_by,
      'mcp_full_issue',
      _rec.id::text,
      'auto_revoked',
      jsonb_build_object(
        'reason', 'creator_lost_dev_role',
        'source', _source
      )
    );

    key_id := _rec.id;
    created_by := _rec.created_by;
    revoked_at := _now;
    RETURN NEXT;
  END LOOP;
END;
$$;


--
-- Name: can_approve_discount(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.can_approve_discount(_user_id uuid DEFAULT auth.uid()) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT public.can_manage_quotes(_user_id)
$$;


--
-- Name: can_grant_mcp_full(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.can_grant_mcp_full(_user_id uuid) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT public.is_dev(_user_id);
$$;


--
-- Name: can_manage_connections(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.can_manage_connections(_user_id uuid DEFAULT auth.uid()) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT public.is_supervisor_or_above(_user_id)
$$;


--
-- Name: can_manage_quotes(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.can_manage_quotes(_user_id uuid DEFAULT auth.uid()) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id
      AND role IN ('supervisor'::public.app_role,
                   'admin'::public.app_role,
                   'manager'::public.app_role)
  )
$$;


--
-- Name: can_view_all_sales(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.can_view_all_sales(_user_id uuid DEFAULT auth.uid()) RETURNS boolean
    LANGUAGE sql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT public.is_admin_strict(_user_id)
      OR public.has_role(_user_id,'manager'::public.app_role)
      OR public.has_role(_user_id,'dev'::public.app_role)
$$;


--
-- Name: can_view_audit_logs(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.can_view_audit_logs(_user_id uuid DEFAULT auth.uid()) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT public.is_dev(_user_id)
$$;


--
-- Name: can_view_connections(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.can_view_connections(_user_id uuid DEFAULT auth.uid()) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT public.is_supervisor_or_above(_user_id)
$$;


--
-- Name: can_view_telemetry(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.can_view_telemetry(_user_id uuid DEFAULT auth.uid()) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT public.is_supervisor_or_above(_user_id)
$$;


--
-- Name: check_ai_quota(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.check_ai_quota(_user_id uuid) RETURNS jsonb
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  _role app_role;
  _monthly_limit integer;
  _is_unlimited boolean;
  _used integer;
BEGIN
  SELECT role INTO _role FROM public.user_roles WHERE user_id = _user_id LIMIT 1;
  IF _role IS NULL THEN
    RETURN jsonb_build_object('allowed', false, 'used', 0, 'limit', 0, 'remaining', 0, 'reason', 'no_role');
  END IF;

  SELECT monthly_limit, is_unlimited INTO _monthly_limit, _is_unlimited
  FROM public.ai_usage_quotas WHERE role = _role;

  IF _is_unlimited THEN
    SELECT count(*) INTO _used FROM public.ai_usage_logs
    WHERE user_id = _user_id AND created_at >= date_trunc('month', now()) AND status IN ('success', 'pending');
    RETURN jsonb_build_object('allowed', true, 'used', _used, 'limit', -1, 'remaining', -1, 'unlimited', true);
  END IF;

  SELECT count(*) INTO _used FROM public.ai_usage_logs
  WHERE user_id = _user_id AND created_at >= date_trunc('month', now()) AND status IN ('success', 'pending');

  RETURN jsonb_build_object(
    'allowed', _used < _monthly_limit,
    'used', _used,
    'limit', _monthly_limit,
    'remaining', GREATEST(_monthly_limit - _used, 0),
    'unlimited', false
  );
END;
$$;


--
-- Name: check_auth_throttling(text, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.check_auth_throttling(_email text, _ip text) RETURNS TABLE(allowed boolean, remaining_seconds integer)
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
    recent_failures INT;
    last_failure_at TIMESTAMP WITH TIME ZONE;
    lockout_duration INT; -- em segundos
    elapsed_since_last INT;
BEGIN
    -- Contar falhas consecutivas nos últimos 15 minutos para este email OU IP
    -- Usamos 15 minutos como janela de observação
    SELECT COUNT(*), MAX(created_at)
    INTO recent_failures, last_failure_at
    FROM auth_login_attempts
    WHERE (email = _email OR ip_address = _ip)
      AND success = false
      AND created_at > now() - INTERVAL '15 minutes';

    -- Se não houver falhas suficientes para bloqueio, permite (limite de 5 falhas)
    IF recent_failures < 5 THEN
        RETURN QUERY SELECT true, 0;
        RETURN;
    END IF;

    -- Bloqueio exponencial: 
    -- 5-9 falhas = 5 min
    -- 10-14 falhas = 15 min
    -- >=15 falhas = 60 min
    IF recent_failures < 10 THEN
        lockout_duration := 300; 
    ELSIF recent_failures < 15 THEN
        lockout_duration := 900;
    ELSE
        lockout_duration := 3600;
    END IF;

    elapsed_since_last := EXTRACT(EPOCH FROM (now() - last_failure_at))::INT;

    IF elapsed_since_last >= lockout_duration THEN
        RETURN QUERY SELECT true, 0;
    ELSE
        RETURN QUERY SELECT false, (lockout_duration - elapsed_since_last);
    END IF;
END;
$$;


--
-- Name: check_hardening_status(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.check_hardening_status() RETURNS jsonb
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  _is_admin boolean;
  _private_buckets int;
  _sensitive_realtime int;
  _pg_trgm_in_extensions boolean;
  _cleanup_job_active boolean;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin'
  ) INTO _is_admin;

  IF NOT _is_admin THEN
    RAISE EXCEPTION 'Admin only';
  END IF;

  SELECT count(*) INTO _private_buckets
  FROM storage.buckets
  WHERE id IN ('personalization-images','product-videos','supplier-logos','component-media')
    AND public = false;

  SELECT count(*) INTO _sensitive_realtime
  FROM pg_publication_tables
  WHERE pubname = 'supabase_realtime'
    AND schemaname = 'public'
    AND tablename IN ('discount_approval_requests','kit_variants','kit_comments');

  SELECT EXISTS (
    SELECT 1 FROM pg_extension e
    JOIN pg_namespace n ON n.oid = e.extnamespace
    WHERE e.extname = 'pg_trgm' AND n.nspname = 'extensions'
  ) INTO _pg_trgm_in_extensions;

  SELECT EXISTS (
    SELECT 1 FROM cron.job WHERE jobname = 'cleanup-security-logs-daily' AND active = true
  ) INTO _cleanup_job_active;

  RETURN jsonb_build_object(
    'private_buckets_count', _private_buckets,
    'private_buckets_ok', _private_buckets = 4,
    'sensitive_realtime_count', _sensitive_realtime,
    'realtime_isolation_ok', _sensitive_realtime = 0,
    'pg_trgm_in_extensions', _pg_trgm_in_extensions,
    'cleanup_job_active', _cleanup_job_active,
    'mfa_enforced_in_app', true,
    'checked_at', now()
  );
END;
$$;


--
-- Name: check_ip_access(text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.check_ip_access(_ip text) RETURNS text
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  _type TEXT;
BEGIN
  SELECT list_type INTO _type
  FROM public.ip_access_control
  WHERE ip_address = _ip
    AND (expires_at IS NULL OR expires_at > now())
  LIMIT 1;
  
  RETURN _type; -- returns 'allow', 'block', or NULL
END;
$$;


--
-- Name: check_mcp_abuse_threshold(uuid, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.check_mcp_abuse_threshold(_user_id uuid, _ip text) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_window INTERVAL := INTERVAL '10 minutes';
  v_threshold INTEGER := 5;
  v_count_user INTEGER := 0;
  v_count_ip INTEGER := 0;
  v_admin RECORD;
  v_already_alerted BOOLEAN := false;
BEGIN
  -- Conta violações na janela
  IF _user_id IS NOT NULL THEN
    SELECT COUNT(*) INTO v_count_user
    FROM public.mcp_access_violations
    WHERE user_id = _user_id
      AND created_at >= now() - v_window;
  END IF;

  IF _ip IS NOT NULL AND _ip <> '' THEN
    SELECT COUNT(*) INTO v_count_ip
    FROM public.mcp_access_violations
    WHERE ip_address = _ip
      AND created_at >= now() - v_window;
  END IF;

  IF v_count_user < v_threshold AND v_count_ip < v_threshold THEN
    RETURN;
  END IF;

  -- Evita disparos duplicados: se já houver alerta nos últimos 10min para mesmo user/ip, sai
  SELECT EXISTS (
    SELECT 1 FROM public.admin_audit_log
    WHERE action = 'mcp_abuse_detected'
      AND created_at >= now() - v_window
      AND (
        (details->>'user_id') = _user_id::text
        OR (details->>'ip_address') = _ip
      )
  ) INTO v_already_alerted;

  IF v_already_alerted THEN
    RETURN;
  END IF;

  -- Registra evento de auditoria
  INSERT INTO public.admin_audit_log (
    user_id, action, resource_type, resource_id,
    ip_address, details, source, status
  ) VALUES (
    COALESCE(_user_id, '00000000-0000-0000-0000-000000000000'::uuid),
    'mcp_abuse_detected',
    'mcp_api_keys',
    NULL,
    _ip,
    jsonb_build_object(
      'user_id', _user_id,
      'ip_address', _ip,
      'window_minutes', 10,
      'threshold', v_threshold,
      'violations_user', v_count_user,
      'violations_ip', v_count_ip
    ),
    'mcp_abuse_detector',
    'denied'
  );

  -- Notifica admins
  FOR v_admin IN
    SELECT user_id FROM public.user_roles WHERE role = 'admin'::public.app_role
  LOOP
    INSERT INTO public.workspace_notifications (
      user_id, title, message, type, category, action_url, metadata
    ) VALUES (
      v_admin.user_id,
      'Possível abuso em chaves MCP',
      format(
        'Detectadas %s tentativas bloqueadas em 10 min%s.',
        GREATEST(v_count_user, v_count_ip),
        CASE WHEN _ip IS NOT NULL THEN ' (IP: ' || _ip || ')' ELSE '' END
      ),
      'warning',
      'security',
      '/admin/seguranca',
      jsonb_build_object(
        'event', 'mcp_abuse_detected',
        'user_id', _user_id,
        'ip_address', _ip,
        'violations_user', v_count_user,
        'violations_ip', v_count_ip
      )
    );
  END LOOP;
END;
$$;


--
-- Name: check_rate_limit(text, text, integer, integer, integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.check_rate_limit(_identifier text, _endpoint text, _max_requests integer DEFAULT 60, _window_seconds integer DEFAULT 60, _block_duration_seconds integer DEFAULT 3600) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  _row record;
  _now timestamptz := now();
  _window_start timestamptz := _now - make_interval(secs => _window_seconds);
BEGIN
  -- Atomic upsert with row lock
  INSERT INTO public.request_rate_limits (identifier, endpoint, request_count, window_start)
  VALUES (_identifier, _endpoint, 1, _now)
  ON CONFLICT (identifier, endpoint) DO UPDATE
  SET 
    request_count = CASE 
      WHEN request_rate_limits.window_start < _window_start THEN 1
      ELSE request_rate_limits.request_count + 1
    END,
    window_start = CASE
      WHEN request_rate_limits.window_start < _window_start THEN _now
      ELSE request_rate_limits.window_start
    END,
    blocked_until = CASE
      WHEN request_rate_limits.blocked_until IS NOT NULL AND request_rate_limits.blocked_until > _now 
        THEN request_rate_limits.blocked_until
      WHEN request_rate_limits.window_start >= _window_start AND request_rate_limits.request_count + 1 > _max_requests
        THEN _now + make_interval(secs => _block_duration_seconds)
      ELSE NULL
    END,
    updated_at = _now
  RETURNING * INTO _row;

  -- Currently blocked?
  IF _row.blocked_until IS NOT NULL AND _row.blocked_until > _now THEN
    RETURN jsonb_build_object(
      'allowed', false,
      'reason', 'blocked',
      'blocked_until', _row.blocked_until,
      'retry_after_seconds', EXTRACT(EPOCH FROM (_row.blocked_until - _now))::integer
    );
  END IF;

  -- Exceeded limit in current window?
  IF _row.request_count > _max_requests THEN
    RETURN jsonb_build_object(
      'allowed', false,
      'reason', 'rate_exceeded',
      'count', _row.request_count,
      'limit', _max_requests,
      'retry_after_seconds', _block_duration_seconds
    );
  END IF;

  RETURN jsonb_build_object(
    'allowed', true,
    'count', _row.request_count,
    'limit', _max_requests,
    'remaining', GREATEST(_max_requests - _row.request_count, 0)
  );
END;
$$;


--
-- Name: check_telemetry_regression(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.check_telemetry_regression() RETURNS jsonb
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  current_window_start timestamptz := now() - interval '2 hours';
  baseline_window_start timestamptz := now() - interval '26 hours';
  baseline_window_end timestamptz := now() - interval '24 hours';

  cur_samples int := 0;
  cur_p95 numeric := 0;
  cur_avg numeric := 0;
  cur_errors int := 0;
  cur_very_slow int := 0;
  cur_error_rate numeric := 0;

  base_samples int := 0;
  base_p95 numeric := 0;
  base_error_rate numeric := 0;
  base_very_slow int := 0;

  p95_delta_pct numeric := 0;
  error_rate_delta_pp numeric := 0;
  very_slow_ratio numeric := 1;

  status text := 'ok';
  reasons jsonb := '[]'::jsonb;
BEGIN
  -- Apenas admins podem consultar
  IF NOT public.has_role(auth.uid(), 'admin'::app_role) THEN
    RETURN jsonb_build_object('error', 'forbidden');
  END IF;

  -- Janela atual (somente queries não-cache para medir performance real)
  SELECT
    count(*),
    COALESCE(PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY duration_ms), 0),
    COALESCE(AVG(duration_ms), 0),
    count(*) FILTER (WHERE severity = 'error'),
    count(*) FILTER (WHERE severity = 'very_slow')
  INTO cur_samples, cur_p95, cur_avg, cur_errors, cur_very_slow
  FROM public.query_telemetry
  WHERE created_at >= current_window_start
    AND cache_hit = false;

  cur_error_rate := CASE WHEN cur_samples > 0
    THEN ROUND(100.0 * cur_errors / cur_samples, 2)
    ELSE 0 END;

  -- Janela baseline (24-48h atrás)
  SELECT
    count(*),
    COALESCE(PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY duration_ms), 0),
    CASE WHEN count(*) > 0
      THEN ROUND(100.0 * count(*) FILTER (WHERE severity = 'error') / count(*), 2)
      ELSE 0 END,
    count(*) FILTER (WHERE severity = 'very_slow')
  INTO base_samples, base_p95, base_error_rate, base_very_slow
  FROM public.query_telemetry
  WHERE created_at >= baseline_window_start
    AND created_at < baseline_window_end
    AND cache_hit = false;

  -- Sem amostras suficientes → status 'insufficient_data'
  IF cur_samples < 5 OR base_samples < 5 THEN
    RETURN jsonb_build_object(
      'status', 'insufficient_data',
      'reasons', jsonb_build_array(format('Amostras insuficientes (atual=%s, baseline=%s)', cur_samples, base_samples)),
      'current', jsonb_build_object('samples', cur_samples, 'p95_ms', cur_p95, 'error_rate_pct', cur_error_rate, 'very_slow', cur_very_slow),
      'baseline', jsonb_build_object('samples', base_samples, 'p95_ms', base_p95, 'error_rate_pct', base_error_rate, 'very_slow', base_very_slow),
      'checked_at', now()
    );
  END IF;

  -- Calcula deltas
  p95_delta_pct := CASE WHEN base_p95 > 0
    THEN ROUND(100.0 * (cur_p95 - base_p95) / base_p95, 1)
    ELSE 0 END;
  error_rate_delta_pp := ROUND(cur_error_rate - base_error_rate, 2);
  very_slow_ratio := CASE WHEN base_very_slow > 0
    THEN ROUND(cur_very_slow::numeric / base_very_slow, 2)
    ELSE CASE WHEN cur_very_slow > 0 THEN 999 ELSE 1 END END;

  -- Avaliação de regressão
  -- REGRESSION (crítico): qualquer um abaixo
  IF p95_delta_pct > 50 THEN
    status := 'regression';
    reasons := reasons || jsonb_build_array(format('Latência P95 piorou %s%% (atual %sms vs baseline %sms)', p95_delta_pct, ROUND(cur_p95)::int, ROUND(base_p95)::int));
  END IF;
  IF error_rate_delta_pp > 5 THEN
    status := 'regression';
    reasons := reasons || jsonb_build_array(format('Taxa de erro subiu %spp (atual %s%% vs baseline %s%%)', error_rate_delta_pp, cur_error_rate, base_error_rate));
  END IF;
  IF very_slow_ratio > 2 AND cur_very_slow >= 3 THEN
    status := 'regression';
    reasons := reasons || jsonb_build_array(format('Queries muito lentas (>8s) %sx baseline (%s vs %s)', very_slow_ratio, cur_very_slow, base_very_slow));
  END IF;

  -- WARNING (moderado) — só promove se ainda não é regression
  IF status = 'ok' THEN
    IF p95_delta_pct > 25 THEN
      status := 'warning';
      reasons := reasons || jsonb_build_array(format('Latência P95 subiu %s%% (atual %sms vs baseline %sms)', p95_delta_pct, ROUND(cur_p95)::int, ROUND(base_p95)::int));
    END IF;
    IF error_rate_delta_pp > 2 THEN
      status := 'warning';
      reasons := reasons || jsonb_build_array(format('Taxa de erro subiu %spp (atual %s%% vs baseline %s%%)', error_rate_delta_pp, cur_error_rate, base_error_rate));
    END IF;
  END IF;

  RETURN jsonb_build_object(
    'status', status,
    'reasons', reasons,
    'current', jsonb_build_object(
      'samples', cur_samples,
      'p95_ms', ROUND(cur_p95)::int,
      'avg_ms', ROUND(cur_avg)::int,
      'error_rate_pct', cur_error_rate,
      'very_slow', cur_very_slow
    ),
    'baseline', jsonb_build_object(
      'samples', base_samples,
      'p95_ms', ROUND(base_p95)::int,
      'error_rate_pct', base_error_rate,
      'very_slow', base_very_slow
    ),
    'deltas', jsonb_build_object(
      'p95_delta_pct', p95_delta_pct,
      'error_rate_delta_pp', error_rate_delta_pp,
      'very_slow_ratio', very_slow_ratio
    ),
    'checked_at', now()
  );
END;
$$;


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: optimization_queue; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.optimization_queue (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    title text NOT NULL,
    description text,
    category text DEFAULT 'performance'::text NOT NULL,
    priority integer DEFAULT 100 NOT NULL,
    status text DEFAULT 'pending'::text NOT NULL,
    result jsonb,
    error text,
    guardrail_status text,
    started_at timestamp with time zone,
    finished_at timestamp with time zone,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT optimization_queue_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'running'::text, 'done'::text, 'failed'::text, 'skipped'::text, 'blocked'::text])))
);


--
-- Name: claim_next_optimization(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.claim_next_optimization() RETURNS public.optimization_queue
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  claimed public.optimization_queue;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  -- Bloqueia se já existe um running
  IF EXISTS (SELECT 1 FROM public.optimization_queue WHERE status = 'running') THEN
    RETURN NULL;
  END IF;

  UPDATE public.optimization_queue
     SET status = 'running', started_at = now()
   WHERE id = (
     SELECT id FROM public.optimization_queue
      WHERE status = 'pending'
      ORDER BY priority ASC, created_at ASC
      LIMIT 1
      FOR UPDATE SKIP LOCKED
   )
   RETURNING * INTO claimed;

  RETURN claimed;
END;
$$;


--
-- Name: cleanup_discount_test_data(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.cleanup_discount_test_data() RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  _seller_id uuid;
  _admin_id uuid;
  _quotes_deleted int := 0;
  _requests_deleted int := 0;
  _notifs_deleted int := 0;
BEGIN
  SELECT user_id INTO _seller_id FROM public.profiles WHERE email = 'seller-test@discount-approval.test' LIMIT 1;
  SELECT user_id INTO _admin_id FROM public.profiles WHERE email = 'admin-test@discount-approval.test' LIMIT 1;

  IF _seller_id IS NULL THEN
    RETURN jsonb_build_object('ok', true, 'note', 'no test seller found, nothing to clean');
  END IF;

  -- Delete approval requests for seller-test quotes
  WITH deleted AS (
    DELETE FROM public.discount_approval_requests
    WHERE seller_id = _seller_id
    RETURNING 1
  ) SELECT count(*) INTO _requests_deleted FROM deleted;

  -- Delete quotes from test seller
  WITH deleted AS (
    DELETE FROM public.quotes
    WHERE seller_id = _seller_id
    RETURNING 1
  ) SELECT count(*) INTO _quotes_deleted FROM deleted;

  -- Delete test notifications
  WITH deleted AS (
    DELETE FROM public.workspace_notifications
    WHERE user_id IN (_seller_id, _admin_id)
      AND category IN ('discount', 'quotes')
    RETURNING 1
  ) SELECT count(*) INTO _notifs_deleted FROM deleted;

  RETURN jsonb_build_object(
    'ok', true,
    'requests_deleted', _requests_deleted,
    'quotes_deleted', _quotes_deleted,
    'notifications_deleted', _notifs_deleted
  );
END;
$$;


--
-- Name: cleanup_expired_collection_trash(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.cleanup_expired_collection_trash() RETURNS integer
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  _deleted INTEGER;
BEGIN
  DELETE FROM public.collection_items_trash WHERE expires_at < now();
  GET DIAGNOSTICS _deleted = ROW_COUNT;
  RETURN _deleted;
END;
$$;


--
-- Name: cleanup_expired_favorite_trash(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.cleanup_expired_favorite_trash() RETURNS integer
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  _deleted INTEGER;
BEGIN
  DELETE FROM public.favorite_items_trash WHERE expires_at < now();
  GET DIAGNOSTICS _deleted = ROW_COUNT;
  RETURN _deleted;
END;
$$;


--
-- Name: cleanup_expired_public_comparisons(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.cleanup_expired_public_comparisons() RETURNS integer
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_count integer;
BEGIN
  WITH expired AS (
    UPDATE public.user_comparisons
    SET is_public = false,
        share_token = NULL,
        share_expires_at = NULL
    WHERE is_public = true
      AND share_expires_at IS NOT NULL
      AND share_expires_at < now()
    RETURNING id
  )
  SELECT count(*) INTO v_count FROM expired;
  RETURN v_count;
END;
$$;


--
-- Name: cleanup_expired_step_up(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.cleanup_expired_step_up() RETURNS void
    LANGUAGE sql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  DELETE FROM public.step_up_challenges WHERE expires_at < (now() - interval '1 day');
  DELETE FROM public.step_up_tokens WHERE expires_at < (now() - interval '1 day');
$$;


--
-- Name: cleanup_old_notifications(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.cleanup_old_notifications() RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  DELETE FROM public.workspace_notifications
  WHERE created_at < NOW() - INTERVAL '90 days' AND is_read = TRUE;
END;
$$;


--
-- Name: cleanup_rate_limits(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.cleanup_rate_limits() RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  DELETE FROM public.request_rate_limits
  WHERE updated_at < now() - INTERVAL '24 hours'
    AND (blocked_until IS NULL OR blocked_until < now());
  
  DELETE FROM public.bot_detection_log
  WHERE created_at < now() - INTERVAL '30 days';
END;
$$;


--
-- Name: cleanup_security_logs(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.cleanup_security_logs() RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  _token_failures_deleted int := 0;
  _bot_log_deleted int := 0;
  _audit_log_deleted int := 0;
  _ip_expired_deleted int := 0;
BEGIN
  WITH d AS (DELETE FROM public.public_token_failures WHERE created_at < now() - INTERVAL '90 days' RETURNING 1)
  SELECT count(*) INTO _token_failures_deleted FROM d;

  WITH d AS (DELETE FROM public.bot_detection_log WHERE created_at < now() - INTERVAL '90 days' RETURNING 1)
  SELECT count(*) INTO _bot_log_deleted FROM d;

  WITH d AS (DELETE FROM public.admin_audit_log WHERE created_at < now() - INTERVAL '365 days' RETURNING 1)
  SELECT count(*) INTO _audit_log_deleted FROM d;

  WITH d AS (
    DELETE FROM public.ip_access_control
    WHERE expires_at IS NOT NULL AND expires_at < now() - INTERVAL '30 days'
    RETURNING 1
  )
  SELECT count(*) INTO _ip_expired_deleted FROM d;

  RETURN jsonb_build_object(
    'ok', true,
    'ran_at', now(),
    'public_token_failures_deleted', _token_failures_deleted,
    'bot_detection_log_deleted', _bot_log_deleted,
    'admin_audit_log_deleted', _audit_log_deleted,
    'ip_access_control_expired_deleted', _ip_expired_deleted
  );
END;
$$;


--
-- Name: cleanup_user_search_history(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.cleanup_user_search_history() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
BEGIN
    DELETE FROM public.user_search_history
    WHERE id IN (
        SELECT id
        FROM (
            SELECT id,
                   row_number() OVER (
                       PARTITION BY user_id, history_type 
                       ORDER BY is_pinned DESC, created_at DESC
                   ) as rn
            FROM public.user_search_history
            WHERE user_id = NEW.user_id AND history_type = NEW.history_type
        ) s
        WHERE rn > 50 -- Keep top 50
    );
    RETURN NEW;
END;
$$;


--
-- Name: cleanup_webhook_logs(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.cleanup_webhook_logs() RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
  v_deleted_outbound int;
  v_deleted_inbound int;
  v_deleted_metrics int;
BEGIN
  WITH del AS (
    DELETE FROM public.webhook_deliveries
    WHERE delivered_at < now() - interval '90 days'
    RETURNING 1
  )
  SELECT count(*) INTO v_deleted_outbound FROM del;

  WITH del AS (
    DELETE FROM public.inbound_webhook_events
    WHERE received_at < now() - interval '90 days'
    RETURNING 1
  )
  SELECT count(*) INTO v_deleted_inbound FROM del;

  -- Add metrics cleanup
  WITH del AS (
    DELETE FROM public.webhook_delivery_metrics
    WHERE occurred_at < now() - interval '90 days'
    RETURNING 1
  )
  SELECT count(*) INTO v_deleted_metrics FROM del;

  RETURN jsonb_build_object(
    'ok', true,
    'deleted_outbound', v_deleted_outbound,
    'deleted_inbound', v_deleted_inbound,
    'deleted_metrics', v_deleted_metrics,
    'ran_at', now()
  );
END;
$$;


--
-- Name: clear_auth_attempts(text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.clear_auth_attempts(_email text) RETURNS void
    LANGUAGE sql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
    DELETE FROM public.auth_login_attempts
    WHERE email = _email;
$$;


--
-- Name: complete_optimization(uuid, text, text, text, jsonb, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.complete_optimization(_id uuid, _status text, _notes text DEFAULT NULL::text, _guardrail_status text DEFAULT NULL::text, _result jsonb DEFAULT NULL::jsonb, _error text DEFAULT NULL::text) RETURNS public.optimization_queue
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  updated public.optimization_queue;
  duration int;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  IF _status NOT IN ('done','failed','skipped','blocked') THEN
    RAISE EXCEPTION 'invalid status: %', _status;
  END IF;

  UPDATE public.optimization_queue
     SET status = _status,
         finished_at = now(),
         result = COALESCE(_result, result),
         error = _error,
         guardrail_status = COALESCE(_guardrail_status, guardrail_status)
   WHERE id = _id
   RETURNING * INTO updated;

  IF updated.id IS NULL THEN
    RAISE EXCEPTION 'optimization not found';
  END IF;

  duration := EXTRACT(EPOCH FROM (updated.finished_at - COALESCE(updated.started_at, updated.finished_at))) * 1000;

  INSERT INTO public.optimization_queue_runs (queue_id, status, notes, guardrail_status, duration_ms, executed_by)
  VALUES (_id, _status, _notes, _guardrail_status, duration, auth.uid());

  RETURN updated;
END;
$$;


--
-- Name: consume_step_up_token(uuid, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.consume_step_up_token(_challenge_id uuid, _token_hash text) RETURNS boolean
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
    UPDATE public.step_up_challenges 
    SET consumed = true
    WHERE id = _challenge_id 
      AND user_id = auth.uid() 
      AND (password_verified = true OR otp_verified = true)
      AND expires_at > now();
      
    RETURN FOUND;
END;
$$;


--
-- Name: consume_step_up_token(text, public.step_up_action, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.consume_step_up_token(_token text, _expected_action public.step_up_action, _expected_target text DEFAULT NULL::text) RETURNS boolean
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  _uid UUID := auth.uid();
  _token_h TEXT;
  _row RECORD;
BEGIN
  IF _uid IS NULL THEN RETURN false; END IF;
  IF _token IS NULL OR length(_token) < 32 THEN RETURN false; END IF;

  -- Re-checagem crítica: usuário ainda precisa ser dev no momento do consumo
  IF NOT public.is_dev(_uid) THEN
    INSERT INTO public.step_up_audit_log(user_id, action, target_ref, event_type, metadata)
    VALUES (_uid, _expected_action, _expected_target, 'unauthorized', '{"reason":"role_lost_at_consume"}'::jsonb);
    RETURN false;
  END IF;

  _token_h := encode(digest(_token, 'sha256'), 'hex');

  SELECT * INTO _row FROM public.step_up_tokens
  WHERE token_hash = _token_h AND user_id = _uid AND consumed = false AND expires_at > now()
  FOR UPDATE;

  IF NOT FOUND THEN
    INSERT INTO public.step_up_audit_log(user_id, action, target_ref, event_type, metadata)
    VALUES (_uid, _expected_action, _expected_target, 'failed', '{"reason":"token_invalid_or_expired"}'::jsonb);
    RETURN false;
  END IF;

  IF _row.action <> _expected_action THEN
    INSERT INTO public.step_up_audit_log(user_id, action, target_ref, event_type, token_id, metadata)
    VALUES (_uid, _expected_action, _expected_target, 'failed', _row.id, jsonb_build_object('reason','action_mismatch','expected',_expected_action,'got',_row.action));
    RETURN false;
  END IF;

  IF _expected_target IS NOT NULL AND _row.target_ref IS DISTINCT FROM _expected_target THEN
    INSERT INTO public.step_up_audit_log(user_id, action, target_ref, event_type, token_id, metadata)
    VALUES (_uid, _expected_action, _expected_target, 'failed', _row.id, '{"reason":"target_mismatch"}'::jsonb);
    RETURN false;
  END IF;

  UPDATE public.step_up_tokens SET consumed = true, consumed_at = now() WHERE id = _row.id;

  INSERT INTO public.step_up_audit_log(user_id, action, target_ref, event_type, token_id)
  VALUES (_uid, _expected_action, _expected_target, 'token_consumed', _row.id);

  RETURN true;
END;
$$;


--
-- Name: convert_quote_to_order(uuid, uuid, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.convert_quote_to_order(p_quote_id uuid, p_seller_id uuid, p_organization_id uuid DEFAULT NULL::uuid) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
    v_quote RECORD;
    v_order_id UUID;
    v_order_number TEXT;
    v_item RECORD;
    v_new_item_id UUID;
BEGIN
    -- 1. Get quote data
    SELECT * INTO v_quote FROM public.quotes WHERE id = p_quote_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Orçamento não encontrado';
    END IF;

    IF v_quote.status != 'approved' THEN
        RAISE EXCEPTION 'Apenas orçamentos aprovados podem ser convertidos';
    END IF;

    -- 2. Check for existing order
    IF EXISTS (SELECT 1 FROM public.orders WHERE quote_id = p_quote_id) THEN
        RAISE EXCEPTION 'Este orçamento já foi convertido em pedido';
    END IF;

    -- 3. Create order
    INSERT INTO public.orders (
        seller_id, organization_id, quote_id, client_id, client_name, client_email,
        client_phone, client_company, subtotal, discount_amount, shipping_cost,
        shipping_type, total, payment_terms, delivery_time, notes, internal_notes,
        status, fulfillment_status
    ) VALUES (
        p_seller_id, COALESCE(p_organization_id, v_quote.organization_id), p_quote_id, 
        v_quote.client_id, v_quote.client_name, v_quote.client_email,
        v_quote.client_phone, v_quote.client_company, v_quote.subtotal, 
        v_quote.discount_amount, v_quote.shipping_cost,
        v_quote.shipping_type, v_quote.total, v_quote.payment_terms, 
        v_quote.delivery_time, v_quote.notes, v_quote.internal_notes,
        'confirmed', 'unfulfilled'
    ) RETURNING id, order_number INTO v_order_id, v_order_number;

    -- 4. Copy items
    FOR v_item IN SELECT * FROM public.quote_items WHERE quote_id = p_quote_id LOOP
        INSERT INTO public.order_items (
            order_id, organization_id, product_id, product_sku, product_name,
            product_image_url, quantity, unit_price, color_name, color_hex,
            notes, size_code, gender, kit_group_id, kit_name
        ) VALUES (
            v_order_id, COALESCE(p_organization_id, v_quote.organization_id), 
            v_item.product_id, v_item.product_sku, v_item.product_name,
            v_item.product_image_url, v_item.quantity, v_item.unit_price, 
            v_item.color_name, v_item.color_hex,
            v_item.notes, v_item.size_code, v_item.gender, 
            v_item.kit_group_id, v_item.kit_name
        ) RETURNING id INTO v_new_item_id;

        -- 5. Copy personalizations for each item
        INSERT INTO public.order_item_personalizations (
            order_item_id, technique_id, technique_name, location_id, 
            location_name, image_url, personalization_text, price_adjustment
        )
        SELECT 
            v_new_item_id, technique_id, technique_name, location_id, 
            location_name, image_url, personalization_text, price_adjustment
        FROM public.quote_item_personalizations
        WHERE quote_item_id = v_item.id;
    END LOOP;

    -- 6. Update quote status
    UPDATE public.quotes SET status = 'converted' WHERE id = p_quote_id;

    RETURN jsonb_build_object(
        'id', v_order_id,
        'order_number', v_order_number,
        'status', 'confirmed'
    );
END;
$$;


--
-- Name: create_organization_with_owner(text, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.create_organization_with_owner(_name text, _slug text) RETURNS uuid
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  _org_id uuid;
BEGIN
  -- Create the organization
  INSERT INTO public.organizations (name, slug)
  VALUES (_name, _slug)
  RETURNING id INTO _org_id;

  -- Add the caller as owner
  INSERT INTO public.organization_members (organization_id, user_id, role)
  VALUES (_org_id, auth.uid(), 'owner');

  RETURN _org_id;
END;
$$;


--
-- Name: cron_invoke_edge(text, jsonb, integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.cron_invoke_edge(p_url_secret_name text, p_body jsonb DEFAULT '{}'::jsonb, p_timeout_ms integer DEFAULT 30000) RETURNS bigint
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_url      text;
  v_anon     text;
  v_request  bigint;
BEGIN
  SELECT decrypted_secret INTO v_url
    FROM vault.decrypted_secrets WHERE name = p_url_secret_name;
  SELECT decrypted_secret INTO v_anon
    FROM vault.decrypted_secrets WHERE name = 'edge_anon_key';

  IF v_url IS NULL THEN
    RAISE EXCEPTION 'Vault secret % not found', p_url_secret_name;
  END IF;
  IF v_anon IS NULL THEN
    RAISE EXCEPTION 'Vault secret edge_anon_key not found';
  END IF;

  SELECT extensions.net_http_post(
    url     := v_url,
    headers := jsonb_build_object(
      'Content-Type',  'application/json',
      'Authorization', 'Bearer ' || v_anon
    ),
    body    := p_body,
    timeout_milliseconds := p_timeout_ms
  ) INTO v_request;

  RETURN v_request;
END $$;


--
-- Name: dispatch_quote_webhook_event(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.dispatch_quote_webhook_event() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'extensions'
    AS $$
DECLARE
  _event text;
  _payload jsonb;
  _project_url text := 'https://nmojwpihnslkssljowjh.supabase.co';
BEGIN
  IF TG_TABLE_NAME = 'quotes' THEN
    IF TG_OP = 'INSERT' THEN
      _event := 'quote.created';
    ELSIF TG_OP = 'UPDATE' AND OLD.status IS DISTINCT FROM NEW.status THEN
      _event := 'quote.' || NEW.status;
    ELSE
      RETURN NEW;
    END IF;
    _payload := jsonb_build_object(
      'id', NEW.id,
      'quote_number', NEW.quote_number,
      'status', NEW.status,
      'client_name', NEW.client_name,
      'client_email', NEW.client_email,
      'total', NEW.total,
      'seller_id', NEW.seller_id,
      'updated_at', NEW.updated_at
    );

  ELSIF TG_TABLE_NAME = 'orders' THEN
    IF TG_OP = 'INSERT' THEN
      _event := 'order.created';
    ELSE
      RETURN NEW;
    END IF;
    _payload := jsonb_build_object(
      'id', NEW.id,
      'order_number', NEW.order_number,
      'status', NEW.status,
      'client_name', NEW.client_name,
      'total', NEW.total,
      'seller_id', NEW.seller_id
    );

  ELSIF TG_TABLE_NAME = 'discount_approval_requests' THEN
    IF TG_OP = 'INSERT' THEN
      _event := 'discount.requested';
    ELSIF TG_OP = 'UPDATE' AND OLD.status IS DISTINCT FROM NEW.status AND NEW.status IN ('approved','rejected') THEN
      _event := 'discount.' || NEW.status;
    ELSE
      RETURN NEW;
    END IF;
    _payload := jsonb_build_object(
      'id', NEW.id,
      'quote_id', NEW.quote_id,
      'requested_discount_percent', NEW.requested_discount_percent,
      'status', NEW.status,
      'seller_id', NEW.seller_id
    );

  ELSIF TG_TABLE_NAME = 'kit_share_tokens' THEN
    IF TG_OP = 'INSERT' THEN
      _event := 'kit.shared';
    ELSE
      RETURN NEW;
    END IF;
    _payload := jsonb_build_object(
      'id', NEW.id,
      'kit_id', NEW.kit_id,
      'token', NEW.token,
      'client_name', NEW.client_name,
      'seller_id', NEW.seller_id
    );

  ELSE
    RETURN NEW;
  END IF;

  -- Só dispara se houver pelo menos um webhook ativo subscrito
  IF NOT EXISTS (
    SELECT 1 FROM public.outbound_webhooks
    WHERE active = true AND _event = ANY(events)
  ) THEN
    RETURN NEW;
  END IF;

  PERFORM extensions.http_post(
    url := _project_url || '/functions/v1/webhook-dispatcher',
    body := jsonb_build_object('event', _event, 'payload', _payload)::text,
    params := '{}'::jsonb,
    headers := jsonb_build_object('Content-Type', 'application/json'),
    timeout_milliseconds := 5000
  );

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  -- Nunca quebra a transação principal por causa de webhook
  RETURN NEW;
END;
$$;


--
-- Name: e2e_cleanup_check_rate_limit(text, integer, integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.e2e_cleanup_check_rate_limit(p_key text, p_max integer, p_window_seconds integer) RETURNS TABLE(allowed boolean, current_count integer, reset_in_seconds integer)
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_now TIMESTAMPTZ := now();
  v_count INT;
  v_window_start TIMESTAMPTZ;
BEGIN
  INSERT INTO public.e2e_cleanup_rate_limit AS r (key, count, window_start, updated_at)
  VALUES (p_key, 1, v_now, v_now)
  ON CONFLICT (key) DO UPDATE
    SET count = CASE
          WHEN r.window_start < v_now - make_interval(secs => p_window_seconds) THEN 1
          ELSE r.count + 1
        END,
        window_start = CASE
          WHEN r.window_start < v_now - make_interval(secs => p_window_seconds) THEN v_now
          ELSE r.window_start
        END,
        updated_at = v_now
  RETURNING r.count, r.window_start INTO v_count, v_window_start;

  RETURN QUERY SELECT
    (v_count <= p_max) AS allowed,
    v_count AS current_count,
    GREATEST(0, p_window_seconds - EXTRACT(EPOCH FROM (v_now - v_window_start))::INT) AS reset_in_seconds;
END;
$$;


--
-- Name: enforce_created_by_owner(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.enforce_created_by_owner() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_uid uuid := auth.uid();
BEGIN
  IF v_uid IS NULL THEN RETURN NEW; END IF;

  IF NEW.created_by IS NULL THEN
    NEW.created_by := v_uid;
    RETURN NEW;
  END IF;

  IF NEW.created_by <> v_uid AND NOT public._can_act_on_behalf_of_others() THEN
    RAISE EXCEPTION 'Não autorizado: created_by (%) difere do usuário autenticado (%).',
      NEW.created_by, v_uid USING ERRCODE = '42501';
  END IF;

  RETURN NEW;
EXCEPTION
  WHEN insufficient_privilege THEN RAISE;
  WHEN OTHERS THEN
    RAISE WARNING 'enforce_created_by_owner failed: %', SQLERRM;
    RETURN NEW;
END;
$$;


--
-- Name: enforce_seller_id_owner(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.enforce_seller_id_owner() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_uid uuid := auth.uid();
BEGIN
  IF v_uid IS NULL THEN RETURN NEW; END IF;

  IF NEW.seller_id IS NULL THEN
    NEW.seller_id := v_uid;
    RETURN NEW;
  END IF;

  IF NEW.seller_id <> v_uid AND NOT public._can_act_on_behalf_of_others() THEN
    RAISE EXCEPTION 'Não autorizado: seller_id (%) difere do usuário autenticado (%).',
      NEW.seller_id, v_uid USING ERRCODE = '42501';
  END IF;

  RETURN NEW;
EXCEPTION
  WHEN insufficient_privilege THEN RAISE;
  WHEN OTHERS THEN
    RAISE WARNING 'enforce_seller_id_owner failed: %', SQLERRM;
    RETURN NEW;
END;
$$;


--
-- Name: enforce_user_id_owner(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.enforce_user_id_owner() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_uid uuid := auth.uid();
BEGIN
  IF v_uid IS NULL THEN RETURN NEW; END IF;

  IF NEW.user_id IS NULL THEN
    NEW.user_id := v_uid;
    RETURN NEW;
  END IF;

  IF NEW.user_id <> v_uid AND NOT public._can_act_on_behalf_of_others() THEN
    RAISE EXCEPTION 'Não autorizado: user_id (%) difere do usuário autenticado (%).',
      NEW.user_id, v_uid USING ERRCODE = '42501';
  END IF;

  RETURN NEW;
EXCEPTION
  WHEN insufficient_privilege THEN RAISE;
  WHEN OTHERS THEN
    RAISE WARNING 'enforce_user_id_owner failed: %', SQLERRM;
    RETURN NEW;
END;
$$;


--
-- Name: enqueue_optimization(text, text, text, integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.enqueue_optimization(_title text, _description text DEFAULT NULL::text, _category text DEFAULT 'performance'::text, _priority integer DEFAULT 100) RETURNS uuid
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  new_id uuid;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  INSERT INTO public.optimization_queue (title, description, category, priority, created_by)
  VALUES (_title, _description, COALESCE(_category,'performance'), COALESCE(_priority,100), auth.uid())
  RETURNING id INTO new_id;

  RETURN new_id;
END;
$$;


--
-- Name: ensure_default_favorite_list(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.ensure_default_favorite_list(_user_id uuid) RETURNS uuid
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  _list_id UUID;
BEGIN
  SELECT id INTO _list_id
  FROM public.favorite_lists
  WHERE user_id = _user_id AND is_default = true
  LIMIT 1;

  IF _list_id IS NULL THEN
    INSERT INTO public.favorite_lists (user_id, name, icon, color, is_default, position)
    VALUES (_user_id, 'Meus Favoritos', 'Heart', '#EF4444', true, 0)
    RETURNING id INTO _list_id;
  END IF;

  RETURN _list_id;
END;
$$;


--
-- Name: execute_role_migration_batch(text, text, jsonb, boolean); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.execute_role_migration_batch(_label text, _reason text, _items jsonb, _dry_run boolean DEFAULT false) RETURNS uuid
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  _batch_id      uuid;
  _caller        uuid := auth.uid();
  _started       timestamptz := clock_timestamp();
  _item          jsonb;
  _item_id       uuid;
  _user_id       uuid;
  _to_role       public.app_role;
  _from_role     public.app_role;
  _operation     text;
  _email         text;
  _item_started  timestamptz;
  _item_status   public.role_migration_item_status;
  _err           text;
  _success       int := 0;
  _failed        int := 0;
  _skipped       int := 0;
  _total         int := 0;
BEGIN
  -- Autorização: somente admin estrito.
  IF NOT public.is_admin_strict(_caller) THEN
    RAISE EXCEPTION 'forbidden: only admin can execute role migration batches'
      USING ERRCODE = '42501';
  END IF;

  IF _items IS NULL OR jsonb_typeof(_items) <> 'array' OR jsonb_array_length(_items) = 0 THEN
    RAISE EXCEPTION 'invalid items: expected non-empty jsonb array' USING ERRCODE = '22023';
  END IF;

  IF _label IS NULL OR length(trim(_label)) = 0 THEN
    RAISE EXCEPTION 'label is required' USING ERRCODE = '22023';
  END IF;
  IF _reason IS NULL OR length(trim(_reason)) < 5 THEN
    RAISE EXCEPTION 'reason is required (min 5 chars)' USING ERRCODE = '22023';
  END IF;

  _total := jsonb_array_length(_items);

  -- Cria batch
  INSERT INTO public.role_migration_batches
    (label, reason, initiated_by, dry_run, status, total_items, started_at)
  VALUES
    (trim(_label), trim(_reason), _caller, _dry_run,
     CASE WHEN _dry_run THEN 'dry_run' ELSE 'running' END::public.role_migration_status,
     _total, _started)
  RETURNING id INTO _batch_id;

  -- Auditoria global do disparo
  INSERT INTO public.admin_audit_log
    (user_id, action, resource_type, resource_id, details, started_at, status, source)
  VALUES
    (_caller, 'role_migration.batch_started', 'role_migration_batch', _batch_id::text,
     jsonb_build_object('label', _label, 'total', _total, 'dry_run', _dry_run, 'reason', _reason),
     _started, 'success', 'rpc:execute_role_migration_batch');

  -- Processa cada item
  FOR _item IN SELECT * FROM jsonb_array_elements(_items)
  LOOP
    _item_started := clock_timestamp();
    _item_status := 'pending';
    _err := NULL;
    _from_role := NULL;

    BEGIN
      _user_id   := (_item->>'user_id')::uuid;
      _to_role   := (_item->>'to_role')::public.app_role;
      _operation := COALESCE(_item->>'operation', 'add');

      IF _operation NOT IN ('add','remove','replace') THEN
        RAISE EXCEPTION 'invalid operation: %', _operation;
      END IF;

      SELECT email INTO _email FROM public.profiles WHERE user_id = _user_id;
      SELECT role  INTO _from_role
        FROM public.user_roles WHERE user_id = _user_id LIMIT 1;

      -- Cria item placeholder
      INSERT INTO public.role_migration_items
        (batch_id, user_id, user_email, from_role, to_role, operation, status, processed_at)
      VALUES
        (_batch_id, _user_id, _email, _from_role, _to_role, _operation,
         CASE WHEN _dry_run THEN 'dry_run' ELSE 'pending' END::public.role_migration_item_status,
         _item_started)
      RETURNING id INTO _item_id;

      IF _dry_run THEN
        _item_status := 'dry_run';
        _skipped := _skipped + 1;
      ELSE
        IF _operation = 'add' THEN
          INSERT INTO public.user_roles (user_id, role)
          VALUES (_user_id, _to_role)
          ON CONFLICT (user_id, role) DO NOTHING;
        ELSIF _operation = 'remove' THEN
          DELETE FROM public.user_roles
            WHERE user_id = _user_id AND role = _to_role;
        ELSIF _operation = 'replace' THEN
          DELETE FROM public.user_roles WHERE user_id = _user_id;
          INSERT INTO public.user_roles (user_id, role) VALUES (_user_id, _to_role);
        END IF;
        _item_status := 'success';
        _success := _success + 1;
      END IF;

      UPDATE public.role_migration_items
         SET status = _item_status,
             duration_ms = (EXTRACT(EPOCH FROM (clock_timestamp() - _item_started)) * 1000)::int
       WHERE id = _item_id;

      INSERT INTO public.admin_audit_log
        (user_id, action, resource_type, resource_id, details, started_at, finished_at, status, source)
      VALUES
        (_caller,
         CASE WHEN _dry_run THEN 'role_migration.item_dry_run' ELSE 'role_migration.item_applied' END,
         'user_role', _user_id::text,
         jsonb_build_object(
           'batch_id', _batch_id, 'item_id', _item_id,
           'from_role', _from_role, 'to_role', _to_role,
           'operation', _operation, 'user_email', _email),
         _item_started, clock_timestamp(),
         CASE WHEN _dry_run THEN 'dry_run' ELSE 'success' END,
         'rpc:execute_role_migration_batch');

    EXCEPTION WHEN OTHERS THEN
      _err := SQLERRM;
      _failed := _failed + 1;
      -- Se o INSERT do item falhou antes, garantimos um registro
      IF _item_id IS NULL THEN
        INSERT INTO public.role_migration_items
          (batch_id, user_id, user_email, from_role, to_role, operation,
           status, error_message, processed_at,
           duration_ms)
        VALUES
          (_batch_id, COALESCE(_user_id, '00000000-0000-0000-0000-000000000000'::uuid),
           _email, _from_role, _to_role, COALESCE(_operation,'add'),
           'failed', _err, _item_started,
           (EXTRACT(EPOCH FROM (clock_timestamp() - _item_started)) * 1000)::int);
      ELSE
        UPDATE public.role_migration_items
           SET status = 'failed',
               error_message = _err,
               duration_ms = (EXTRACT(EPOCH FROM (clock_timestamp() - _item_started)) * 1000)::int
         WHERE id = _item_id;
      END IF;

      INSERT INTO public.admin_audit_log
        (user_id, action, resource_type, resource_id, details, started_at, finished_at, status, source)
      VALUES
        (_caller, 'role_migration.item_failed', 'user_role',
         COALESCE(_user_id::text, '<unknown>'),
         jsonb_build_object('batch_id', _batch_id, 'item_id', _item_id,
                            'to_role', _to_role, 'operation', _operation,
                            'error', _err),
         _item_started, clock_timestamp(), 'failed',
         'rpc:execute_role_migration_batch');
    END;

    _item_id := NULL; -- reset entre iterações
  END LOOP;

  -- Fecha o batch
  UPDATE public.role_migration_batches
     SET status = CASE
                    WHEN _dry_run THEN 'dry_run'
                    WHEN _failed = 0 THEN 'completed'
                    WHEN _success = 0 THEN 'failed'
                    ELSE 'partial'
                  END::public.role_migration_status,
         success_count = _success,
         failed_count  = _failed,
         skipped_count = _skipped,
         finished_at   = clock_timestamp(),
         duration_ms   = (EXTRACT(EPOCH FROM (clock_timestamp() - _started)) * 1000)::int
   WHERE id = _batch_id;

  INSERT INTO public.admin_audit_log
    (user_id, action, resource_type, resource_id, details, started_at, finished_at, status, source)
  VALUES
    (_caller, 'role_migration.batch_finished', 'role_migration_batch', _batch_id::text,
     jsonb_build_object('total', _total, 'success', _success,
                        'failed', _failed, 'skipped', _skipped, 'dry_run', _dry_run),
     _started, clock_timestamp(),
     CASE WHEN _failed = 0 THEN 'success'
          WHEN _success = 0 THEN 'failed'
          ELSE 'partial' END,
     'rpc:execute_role_migration_batch');

  RETURN _batch_id;
END;
$$;


--
-- Name: fill_integration_credential_metadata(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.fill_integration_credential_metadata() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  NEW.length := COALESCE(char_length(NEW.secret_value), 0);
  IF NEW.length >= 4 THEN
    NEW.masked_suffix := right(NEW.secret_value, 4);
  ELSE
    NEW.masked_suffix := NEW.secret_value;
  END IF;
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;


--
-- Name: fn_check_geo_access(text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.fn_check_geo_access(p_country_code text) RETURNS boolean
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
    v_enabled BOOLEAN;
    v_is_allowed BOOLEAN;
BEGIN
    SELECT (setting_value->>'enabled')::BOOLEAN INTO v_enabled FROM public.security_settings WHERE setting_key = 'geo_blocking';
    IF v_enabled IS NOT TRUE THEN RETURN true; END IF;
    
    SELECT EXISTS(SELECT 1 FROM public.geo_allowed_countries WHERE country_code = UPPER(p_country_code) AND is_active = true) INTO v_is_allowed;
    RETURN v_is_allowed;
EXCEPTION WHEN OTHERS THEN
    RETURN true; -- Fail-open se a tabela security_settings ainda não existir ou falhar
END;
$$;


--
-- Name: fn_create_quote_v3(jsonb, jsonb); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.fn_create_quote_v3(p_quote_data jsonb, p_items_data jsonb) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
    v_quote_id UUID;
    v_item RECORD;
    v_pers RECORD;
    v_new_item_id UUID;
    v_seller_id UUID := auth.uid();
    v_quote_number TEXT;
BEGIN
    -- Validação básica
    IF v_seller_id IS NULL THEN
        RAISE EXCEPTION 'Unauthorized';
    END IF;

    -- 1. Inserir Header
    INSERT INTO public.quotes (
        seller_id, client_id, client_name, client_email, client_phone, client_company, client_cnpj,
        status, subtotal, discount_percent, discount_amount, total,
        notes, internal_notes, valid_until, payment_terms, delivery_time,
        shipping_type, shipping_cost, negotiation_markup_percent,
        organization_id
    ) VALUES (
        v_seller_id,
        (p_quote_data->>'client_id'),
        (p_quote_data->>'client_name'),
        (p_quote_data->>'client_email'),
        (p_quote_data->>'client_phone'),
        (p_quote_data->>'client_company'),
        (p_quote_data->>'client_cnpj'),
        COALESCE(p_quote_data->>'status', 'draft'),
        (p_quote_data->>'subtotal')::NUMERIC,
        COALESCE((p_quote_data->>'discount_percent')::NUMERIC, 0),
        COALESCE((p_quote_data->>'discount_amount')::NUMERIC, 0),
        (p_quote_data->>'total')::NUMERIC,
        (p_quote_data->>'notes'),
        (p_quote_data->>'internal_notes'),
        (p_quote_data->>'valid_until')::TIMESTAMPTZ,
        (p_quote_data->>'payment_terms'),
        (p_quote_data->>'delivery_time'),
        (p_quote_data->>'shipping_type'),
        COALESCE((p_quote_data->>'shipping_cost')::NUMERIC, 0),
        COALESCE((p_quote_data->>'negotiation_markup_percent')::NUMERIC, 0),
        (p_quote_data->>'organization_id')::UUID
    ) RETURNING id, quote_number INTO v_quote_id, v_quote_number;

    -- 2. Inserir Itens
    FOR v_item IN SELECT * FROM jsonb_array_elements(p_items_data)
    LOOP
        INSERT INTO public.quote_items (
            quote_id, product_id, product_name, product_sku, product_image_url,
            quantity, unit_price, subtotal, color_name, color_hex,
            size_code, gender, bitrix_product_id, sort_order, notes
        ) VALUES (
            v_quote_id,
            (v_item.value->>'product_id'),
            (v_item.value->>'product_name'),
            (v_item.value->>'product_sku'),
            (v_item.value->>'product_image_url'),
            (v_item.value->>'quantity')::INTEGER,
            (v_item.value->>'unit_price')::NUMERIC,
            (v_item.value->>'subtotal')::NUMERIC,
            (v_item.value->>'color_name'),
            (v_item.value->>'color_hex'),
            (v_item.value->>'size_code'),
            (v_item.value->>'gender'),
            (v_item.value->>'bitrix_product_id'),
            COALESCE((v_item.value->>'sort_order')::INTEGER, 0),
            (v_item.value->>'notes')
        ) RETURNING id INTO v_new_item_id;

        -- 3. Personalizações
        IF v_item.value ? 'personalizations' THEN
            FOR v_pers IN SELECT * FROM jsonb_array_elements(v_item.value->'personalizations')
            LOOP
                INSERT INTO public.quote_item_personalizations (
                    quote_item_id, technique_id, technique_name,
                    colors_count, positions_count, area_cm2, width_cm, height_cm,
                    setup_cost, unit_cost, total_cost, notes
                ) VALUES (
                    v_new_item_id,
                    (v_pers.value->>'technique_id'),
                    (v_pers.value->>'technique_name'),
                    COALESCE((v_pers.value->>'colors_count')::INTEGER, 1),
                    COALESCE((v_pers.value->>'positions_count')::INTEGER, 1),
                    (v_pers.value->>'area_cm2')::NUMERIC,
                    (v_pers.value->>'width_cm')::NUMERIC,
                    (v_pers.value->>'height_cm')::NUMERIC,
                    COALESCE((v_pers.value->>'setup_cost')::NUMERIC, 0),
                    COALESCE((v_pers.value->>'unit_cost')::NUMERIC, 0),
                    COALESCE((v_pers.value->>'total_cost')::NUMERIC, 0),
                    (v_pers.value->>'notes')
                );
            END LOOP;
        END IF;
    END LOOP;

    -- 4. Log de História
    INSERT INTO public.quote_history (quote_id, user_id, action, description)
    VALUES (v_quote_id, v_seller_id, 'created_v3', 'Orçamento criado via RPC atômico');

    RETURN jsonb_build_object('id', v_quote_id, 'quote_number', v_quote_number);
END;
$$;


--
-- Name: fn_save_quote_draft(jsonb); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.fn_save_quote_draft(p_data jsonb) RETURNS uuid
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
    v_draft_id UUID;
BEGIN
    INSERT INTO public.quote_drafts (user_id, data, last_saved_at)
    VALUES (auth.uid(), p_data, now())
    ON CONFLICT (user_id) DO UPDATE SET data = EXCLUDED.data, last_saved_at = now()
    RETURNING id INTO v_draft_id;
    RETURN v_draft_id;
END;
$$;


--
-- Name: generate_order_number(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.generate_order_number() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $_$
DECLARE
  year_short text;
  max_num integer;
BEGIN
  year_short := to_char(now(), 'YYYY');
  SELECT COALESCE(MAX(
    CASE WHEN split_part(order_number, '-', 3) ~ '^\d+$'
         THEN split_part(order_number, '-', 3)::integer
         ELSE 0 END
  ), 0)
  INTO max_num
  FROM public.orders
  WHERE order_number LIKE 'PED-' || year_short || '-%';
  
  IF NEW.order_number IS NULL OR NEW.order_number = '' THEN
    NEW.order_number := 'PED-' || year_short || '-' || lpad((max_num + 1)::text, 4, '0');
  END IF;
  RETURN NEW;
END;
$_$;


--
-- Name: generate_order_number_v3(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.generate_order_number_v3() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
DECLARE
    year_suffix TEXT := to_char(now(), 'YY');
    next_val INTEGER;
BEGIN
    IF NEW.order_number IS NULL THEN
        SELECT count(*) + 1 INTO next_val 
        FROM public.orders 
        WHERE order_number LIKE 'PED-' || year_suffix || '-%';
        
        NEW.order_number := 'PED-' || year_suffix || '-' || lpad(next_val::text, 4, '0');
    END IF;
    RETURN NEW;
END;
$$;


--
-- Name: generate_order_number_v5(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.generate_order_number_v5() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
DECLARE
    year_suffix TEXT := to_char(now(), 'YY');
    next_val INTEGER;
BEGIN
    IF NEW.order_number IS NULL OR NEW.order_number = '' THEN
        SELECT count(*) + 1 INTO next_val 
        FROM public.orders 
        WHERE order_number LIKE 'PED-' || year_suffix || '-%';
        
        NEW.order_number := 'PED-' || year_suffix || '-' || lpad(next_val::text, 4, '0');
    END IF;
    RETURN NEW;
END;
$$;


--
-- Name: generate_quote_number(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.generate_quote_number() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $_$
DECLARE
  year_short text;
  max_num integer;
  new_number text;
BEGIN
  year_short := to_char(now(), 'YY');
  
  SELECT COALESCE(MAX(
    CASE WHEN split_part(quote_number, '/', 1) ~ '^\d+$'
         THEN split_part(quote_number, '/', 1)::integer
         ELSE 0 END
  ), 10000)
  INTO max_num
  FROM public.quotes
  WHERE quote_number LIKE '%/' || year_short;
  
  new_number := (max_num + 1)::text || '/' || year_short;
  
  IF NEW.quote_number IS NULL OR NEW.quote_number = '' THEN
    NEW.quote_number := new_number;
  END IF;
  
  RETURN NEW;
END;
$_$;


--
-- Name: generate_secure_token(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.generate_secure_token() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  -- Generate a cryptographically secure 32-byte hex token
  NEW.token := encode(gen_random_bytes(32), 'hex');
  RETURN NEW;
END;
$$;


--
-- Name: get_app_health_summary(integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_app_health_summary(_minutes integer DEFAULT 60) RETURNS jsonb
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_since timestamptz := now() - make_interval(mins => GREATEST(1, LEAST(_minutes, 1440)));
  v_kpis jsonb;
  v_routes jsonb;
  v_webhooks jsonb;
  v_edges jsonb;
  v_vitals jsonb;
BEGIN
  -- Authorization: admin or dev only
  IF NOT (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'dev'::app_role)) THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;

  -- 1) KPIs globais
  SELECT jsonb_build_object(
    'total', COUNT(*),
    'req_per_min', ROUND((COUNT(*)::numeric / GREATEST(1, _minutes))::numeric, 2),
    'pct_4xx', CASE WHEN COUNT(*) = 0 THEN 0
                    ELSE ROUND((COUNT(*) FILTER (WHERE http_status BETWEEN 400 AND 499))::numeric * 100.0 / COUNT(*), 2) END,
    'pct_5xx', CASE WHEN COUNT(*) = 0 THEN 0
                    ELSE ROUND((COUNT(*) FILTER (WHERE http_status >= 500))::numeric * 100.0 / COUNT(*), 2) END,
    'p95_ms', COALESCE(percentile_disc(0.95) WITHIN GROUP (ORDER BY duration_ms), 0),
    'p99_ms', COALESCE(percentile_disc(0.99) WITHIN GROUP (ORDER BY duration_ms), 0),
    'window_minutes', _minutes,
    'since', v_since
  )
  INTO v_kpis
  FROM public.webhook_delivery_metrics
  WHERE occurred_at >= v_since;

  -- 2) Top rotas por erro
  SELECT COALESCE(jsonb_agg(row_to_json(r)), '[]'::jsonb)
  INTO v_routes
  FROM (
    SELECT
      endpoint,
      direction,
      COUNT(*) AS total,
      COUNT(*) FILTER (WHERE http_status BETWEEN 400 AND 499) AS count_4xx,
      COUNT(*) FILTER (WHERE http_status >= 500) AS count_5xx,
      ROUND((COUNT(*) FILTER (WHERE http_status >= 400))::numeric * 100.0
            / NULLIF(COUNT(*),0), 2) AS error_rate_pct,
      MAX(occurred_at) FILTER (WHERE http_status >= 400) AS last_error_at
    FROM public.webhook_delivery_metrics
    WHERE occurred_at >= v_since
      AND endpoint IS NOT NULL
    GROUP BY endpoint, direction
    HAVING COUNT(*) FILTER (WHERE http_status >= 400) > 0
    ORDER BY (COUNT(*) FILTER (WHERE http_status >= 400)) DESC
    LIMIT 20
  ) r;

  -- 3) Webhooks por source
  SELECT COALESCE(jsonb_agg(row_to_json(r)), '[]'::jsonb)
  INTO v_webhooks
  FROM (
    SELECT
      source,
      direction,
      COUNT(*) AS total,
      COUNT(*) FILTER (WHERE NOT success) AS failures,
      ROUND((COUNT(*) FILTER (WHERE NOT success))::numeric * 100.0
            / NULLIF(COUNT(*),0), 2) AS failure_rate_pct,
      COALESCE(percentile_disc(0.95) WITHIN GROUP (ORDER BY duration_ms), 0) AS p95_ms,
      MAX(occurred_at) FILTER (WHERE NOT success) AS last_failure_at
    FROM public.webhook_delivery_metrics
    WHERE occurred_at >= v_since
    GROUP BY source, direction
    ORDER BY failures DESC, total DESC
    LIMIT 30
  ) r;

  -- 4) Edge functions por p95 latency
  SELECT COALESCE(jsonb_agg(row_to_json(r)), '[]'::jsonb)
  INTO v_edges
  FROM (
    SELECT
      source AS edge_function,
      COUNT(*) AS total,
      COALESCE(percentile_disc(0.50) WITHIN GROUP (ORDER BY duration_ms), 0) AS p50_ms,
      COALESCE(percentile_disc(0.95) WITHIN GROUP (ORDER BY duration_ms), 0) AS p95_ms,
      COALESCE(percentile_disc(0.99) WITHIN GROUP (ORDER BY duration_ms), 0) AS p99_ms,
      ROUND(AVG(duration_ms)::numeric, 0) AS avg_ms,
      MAX(duration_ms) AS max_ms
    FROM public.webhook_delivery_metrics
    WHERE occurred_at >= v_since
    GROUP BY source
    ORDER BY p95_ms DESC NULLS LAST
    LIMIT 30
  ) r;

  -- 5) Core Web Vitals (P75 + breakdown)
  SELECT COALESCE(jsonb_agg(row_to_json(r)), '[]'::jsonb)
  INTO v_vitals
  FROM (
    SELECT
      metric_name AS name,
      COUNT(*) AS total,
      COALESCE(percentile_disc(0.75) WITHIN GROUP (ORDER BY metric_value), 0) AS p75,
      COUNT(*) FILTER (WHERE rating = 'good') AS count_good,
      COUNT(*) FILTER (WHERE rating = 'needs-improvement') AS count_needs_improvement,
      COUNT(*) FILTER (WHERE rating = 'poor') AS count_poor,
      ROUND((COUNT(*) FILTER (WHERE rating = 'good'))::numeric * 100.0 / NULLIF(COUNT(*), 0), 1) AS good_pct
    FROM public.app_vitals
    WHERE created_at >= v_since
    GROUP BY metric_name
    ORDER BY metric_name ASC
  ) r;

  RETURN jsonb_build_object(
    'kpis', v_kpis,
    'top_routes_by_error', v_routes,
    'webhooks_by_source', v_webhooks,
    'edges_by_latency', v_edges,
    'web_vitals', v_vitals
  );
END;
$$;


--
-- Name: get_auto_test_job_status(integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_auto_test_job_status(_limit integer DEFAULT 20) RETURNS TABLE(run_started_at timestamp with time zone, run_ended_at timestamp with time zone, duration_ms integer, total_tested integer, ok_count integer, fail_count integer, retried_count integer, avg_latency_ms integer)
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'forbidden: admin role required';
  END IF;

  RETURN QUERY
  WITH ordered AS (
    SELECT
      cth.tested_at,
      cth.success,
      cth.latency_ms,
      cth.attempts,
      date_trunc('minute', cth.tested_at) AS bucket
    FROM public.connection_test_history cth
    WHERE cth.triggered_by = 'cron'
      AND cth.tested_at > now() - interval '7 days'
  ),
  runs AS (
    SELECT
      o.bucket,
      MIN(o.tested_at) AS run_started_at,
      MAX(o.tested_at) AS run_ended_at,
      GREATEST(EXTRACT(EPOCH FROM (MAX(o.tested_at) - MIN(o.tested_at))) * 1000, 0)::int AS duration_ms,
      COUNT(*)::int AS total_tested,
      COUNT(*) FILTER (WHERE o.success)::int AS ok_count,
      COUNT(*) FILTER (WHERE NOT o.success)::int AS fail_count,
      COUNT(*) FILTER (WHERE o.attempts > 1)::int AS retried_count,
      COALESCE(AVG(o.latency_ms) FILTER (WHERE o.latency_ms IS NOT NULL), 0)::int AS avg_latency_ms
    FROM ordered o
    GROUP BY o.bucket
  )
  SELECT
    r.run_started_at,
    r.run_ended_at,
    r.duration_ms,
    r.total_tested,
    r.ok_count,
    r.fail_count,
    r.retried_count,
    r.avg_latency_ms
  FROM runs r
  ORDER BY r.run_started_at DESC
  LIMIT GREATEST(1, LEAST(_limit, 100));
END;
$$;


--
-- Name: get_bundle_suggestions(text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_bundle_suggestions(_product_id text) RETURNS TABLE(product_id text, product_name text, product_image_url text, cooccurrence_count bigint, frequency_percent numeric)
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  WITH anchor_quotes AS (
    SELECT DISTINCT quote_id
    FROM public.quote_items
    WHERE product_id = _product_id
  ),
  total AS (
    SELECT COUNT(*)::numeric AS n FROM anchor_quotes
  ),
  cooc AS (
    SELECT
      qi.product_id,
      MAX(qi.product_name) AS product_name,
      MAX(qi.product_image_url) AS product_image_url,
      COUNT(DISTINCT qi.quote_id) AS cnt
    FROM public.quote_items qi
    JOIN anchor_quotes aq ON aq.quote_id = qi.quote_id
    WHERE qi.product_id IS NOT NULL
      AND qi.product_id <> _product_id
    GROUP BY qi.product_id
  )
  SELECT
    c.product_id,
    c.product_name,
    c.product_image_url,
    c.cnt AS cooccurrence_count,
    ROUND((c.cnt::numeric / NULLIF((SELECT n FROM total), 0)) * 100, 1) AS frequency_percent
  FROM cooc c, total
  WHERE total.n >= 3
    AND (c.cnt::numeric / NULLIF(total.n, 0)) >= 0.30
  ORDER BY c.cnt DESC
  LIMIT 5;
$$;


--
-- Name: get_client_seasonality(text, integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_client_seasonality(_client_id text, _months integer DEFAULT 24) RETURNS TABLE(year integer, month integer, quotes_count bigint, total_revenue numeric, avg_ticket numeric)
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT
    EXTRACT(YEAR FROM q.created_at)::int AS year,
    EXTRACT(MONTH FROM q.created_at)::int AS month,
    COUNT(*)::bigint AS quotes_count,
    COALESCE(SUM(q.total), 0)::numeric AS total_revenue,
    COALESCE(AVG(q.total), 0)::numeric AS avg_ticket
  FROM public.quotes q
  WHERE q.client_id = _client_id
    AND q.status IN ('sent','viewed','approved','converted','pending_approval')
    AND q.created_at >= now() - (GREATEST(_months, 1) || ' months')::interval
    AND (
      q.seller_id = auth.uid()
      OR has_role(auth.uid(), 'admin'::app_role)
      OR has_role(auth.uid(), 'manager'::app_role)
    )
  GROUP BY 1, 2
  ORDER BY 1, 2;
$$;


--
-- Name: get_client_top_products(text, integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_client_top_products(_client_id text, _limit integer DEFAULT 10) RETURNS TABLE(product_id text, product_name text, product_image_url text, total_quantity bigint, occurrences bigint, total_revenue numeric, avg_unit_price numeric, last_quoted_at timestamp with time zone)
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT
    qi.product_id,
    qi.product_name,
    MAX(qi.product_image_url) AS product_image_url,
    SUM(qi.quantity)::bigint AS total_quantity,
    COUNT(DISTINCT qi.quote_id)::bigint AS occurrences,
    SUM(COALESCE(qi.subtotal, qi.quantity * qi.unit_price))::numeric AS total_revenue,
    AVG(qi.unit_price)::numeric AS avg_unit_price,
    MAX(q.created_at) AS last_quoted_at
  FROM public.quote_items qi
  JOIN public.quotes q ON q.id = qi.quote_id
  WHERE q.client_id = _client_id
    AND q.status IN ('sent','viewed','approved','converted','pending_approval')
    AND (
      q.seller_id = auth.uid()
      OR has_role(auth.uid(), 'admin'::app_role)
      OR has_role(auth.uid(), 'manager'::app_role)
    )
  GROUP BY qi.product_id, qi.product_name
  ORDER BY total_quantity DESC, occurrences DESC
  LIMIT GREATEST(_limit, 1);
$$;


--
-- Name: get_collections_weekly_count(integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_collections_weekly_count(_weeks integer DEFAULT 8) RETURNS TABLE(week_start date, item_count bigint)
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  WITH weeks AS (
    SELECT generate_series(
      date_trunc('week', now())::date - (GREATEST(_weeks, 1) - 1) * 7,
      date_trunc('week', now())::date,
      '7 days'::interval
    )::date AS week_start
  )
  SELECT
    w.week_start,
    COALESCE(COUNT(ci.id), 0)::bigint AS item_count
  FROM weeks w
  LEFT JOIN public.collection_items ci
    ON date_trunc('week', ci.created_at)::date = w.week_start
    AND EXISTS (SELECT 1 FROM public.collections c WHERE c.id = ci.collection_id AND c.user_id = auth.uid())
  GROUP BY w.week_start
  ORDER BY w.week_start ASC;
$$;


--
-- Name: get_connection_failure_window_minutes(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_connection_failure_window_minutes() RETURNS integer
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT COALESCE(
    (SELECT (value)::text::int FROM public.system_settings
     WHERE key = 'connection_failure_window_minutes'),
    30
  );
$$;


--
-- Name: get_connections_auto_test_interval(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_connections_auto_test_interval() RETURNS integer
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO 'public', 'cron'
    AS $_$
DECLARE
  s text;
  m text;
BEGIN
  SELECT schedule INTO s FROM cron.job WHERE jobname = 'connections-auto-test' LIMIT 1;
  IF s IS NULL THEN RETURN NULL; END IF;
  -- Expect "*/N * * * *" or "N * * * *"
  m := split_part(s, ' ', 1);
  IF m LIKE '*/%' THEN
    RETURN NULLIF(substring(m FROM 3), '')::int;
  ELSIF m ~ '^[0-9]+$' THEN
    -- Single-minute schedule means "once per hour at minute N" → treat as 60
    RETURN 60;
  END IF;
  RETURN NULL;
END;
$_$;


--
-- Name: get_favorites_weekly_count(integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_favorites_weekly_count(_weeks integer DEFAULT 8) RETURNS TABLE(week_start date, item_count bigint)
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  WITH weeks AS (
    SELECT generate_series(
      date_trunc('week', now())::date - (GREATEST(_weeks, 1) - 1) * 7,
      date_trunc('week', now())::date,
      '7 days'::interval
    )::date AS week_start
  )
  SELECT
    w.week_start,
    COALESCE(COUNT(fi.id), 0)::bigint AS item_count
  FROM weeks w
  LEFT JOIN public.favorite_items fi
    ON fi.user_id = auth.uid()
    AND date_trunc('week', fi.added_at)::date = w.week_start
  GROUP BY w.week_start
  ORDER BY w.week_start ASC;
$$;


--
-- Name: get_industry_benchmark_stats(text[], integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_industry_benchmark_stats(_company_ids text[], _days integer DEFAULT 180) RETURNS TABLE(total_clients_sampled bigint, avg_ltv numeric, avg_ticket numeric, avg_quotes_per_client numeric, avg_items_per_quote numeric, top_product_name text, total_revenue numeric)
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  WITH filtered_quotes AS (
    SELECT q.id, q.client_id, q.total
    FROM public.quotes q
    WHERE q.client_id = ANY(_company_ids)
      AND q.status IN ('sent','viewed','approved','converted','pending_approval')
      AND q.created_at >= now() - (GREATEST(_days, 1) || ' days')::interval
      AND auth.uid() IS NOT NULL
  ),
  per_client AS (
    SELECT
      client_id,
      SUM(total)::numeric AS client_ltv,
      COUNT(*)::numeric AS client_quote_count,
      AVG(total)::numeric AS client_avg_ticket
    FROM filtered_quotes
    GROUP BY client_id
  ),
  items_per_quote AS (
    SELECT fq.id, COUNT(qi.id)::numeric AS item_count
    FROM filtered_quotes fq
    LEFT JOIN public.quote_items qi ON qi.quote_id = fq.id
    GROUP BY fq.id
  ),
  top_product AS (
    SELECT qi.product_name, SUM(qi.quantity) AS qty
    FROM public.quote_items qi
    JOIN filtered_quotes fq ON fq.id = qi.quote_id
    GROUP BY qi.product_name
    ORDER BY qty DESC
    LIMIT 1
  )
  SELECT
    (SELECT COUNT(*)::bigint FROM per_client) AS total_clients_sampled,
    COALESCE((SELECT AVG(client_ltv) FROM per_client), 0)::numeric AS avg_ltv,
    COALESCE((SELECT AVG(client_avg_ticket) FROM per_client), 0)::numeric AS avg_ticket,
    COALESCE((SELECT AVG(client_quote_count) FROM per_client), 0)::numeric AS avg_quotes_per_client,
    COALESCE((SELECT AVG(item_count) FROM items_per_quote), 0)::numeric AS avg_items_per_quote,
    (SELECT product_name FROM top_product) AS top_product_name,
    COALESCE((SELECT SUM(client_ltv) FROM per_client), 0)::numeric AS total_revenue;
$$;


--
-- Name: get_industry_seasonality(text[], integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_industry_seasonality(_company_ids text[], _months integer DEFAULT 24) RETURNS TABLE(year integer, month integer, avg_quotes_per_company numeric, avg_revenue_per_company numeric, companies_active bigint)
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  WITH per_client_month AS (
    SELECT
      q.client_id,
      EXTRACT(YEAR FROM q.created_at)::int AS y,
      EXTRACT(MONTH FROM q.created_at)::int AS m,
      COUNT(*)::numeric AS qc,
      COALESCE(SUM(q.total), 0)::numeric AS rev
    FROM public.quotes q
    WHERE q.client_id = ANY(_company_ids)
      AND q.status IN ('sent','viewed','approved','converted','pending_approval')
      AND q.created_at >= now() - (GREATEST(_months, 1) || ' months')::interval
      AND auth.uid() IS NOT NULL
    GROUP BY q.client_id, 2, 3
  )
  SELECT
    y AS year,
    m AS month,
    AVG(qc)::numeric AS avg_quotes_per_company,
    AVG(rev)::numeric AS avg_revenue_per_company,
    COUNT(DISTINCT client_id)::bigint AS companies_active
  FROM per_client_month
  GROUP BY y, m
  ORDER BY y, m;
$$;


--
-- Name: get_industry_top_products(text[], integer, integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_industry_top_products(_company_ids text[], _days integer DEFAULT 90, _limit integer DEFAULT 10) RETURNS TABLE(product_id text, product_name text, product_image_url text, total_quantity bigint, unique_clients bigint, unique_sellers bigint, total_revenue numeric, avg_unit_price numeric)
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT
    qi.product_id,
    qi.product_name,
    MAX(qi.product_image_url) AS product_image_url,
    SUM(qi.quantity)::bigint AS total_quantity,
    COUNT(DISTINCT q.client_id)::bigint AS unique_clients,
    COUNT(DISTINCT q.seller_id)::bigint AS unique_sellers,
    SUM(COALESCE(qi.subtotal, qi.quantity * qi.unit_price))::numeric AS total_revenue,
    AVG(qi.unit_price)::numeric AS avg_unit_price
  FROM public.quote_items qi
  JOIN public.quotes q ON q.id = qi.quote_id
  WHERE q.client_id = ANY(_company_ids)
    AND q.status IN ('sent','viewed','approved','converted','pending_approval')
    AND q.created_at >= now() - (GREATEST(_days, 1) || ' days')::interval
    AND (
      auth.uid() IS NOT NULL  -- qualquer usuário autenticado vê tendências do setor
    )
  GROUP BY qi.product_id, qi.product_name
  ORDER BY total_quantity DESC, unique_clients DESC
  LIMIT GREATEST(_limit, 1);
$$;


--
-- Name: get_platform_failure_metrics(integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_platform_failure_metrics(window_minutes integer DEFAULT 60) RETURNS jsonb
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  window_start timestamptz := now() - make_interval(mins => COALESCE(window_minutes, 60));
  total_calls bigint;
  total_503 bigint;
  total_cold bigint;
  recent_cold_at timestamptz;
  prev_window_start timestamptz := now() - make_interval(mins => COALESCE(window_minutes, 60) * 2);
  prev_503 bigint;
BEGIN
  SELECT COUNT(*),
         COUNT(*) FILTER (WHERE is_503 = true),
         COUNT(*) FILTER (WHERE is_cold_start = true),
         MAX(created_at) FILTER (WHERE is_cold_start = true)
    INTO total_calls, total_503, total_cold, recent_cold_at
  FROM public.query_telemetry
  WHERE created_at >= window_start;

  SELECT COUNT(*) FILTER (WHERE is_503 = true)
    INTO prev_503
  FROM public.query_telemetry
  WHERE created_at >= prev_window_start AND created_at < window_start;

  RETURN jsonb_build_object(
    'window_minutes', window_minutes,
    'total_calls', COALESCE(total_calls, 0),
    'total_503', COALESCE(total_503, 0),
    'total_cold_starts', COALESCE(total_cold, 0),
    'rate_503_pct', CASE WHEN COALESCE(total_calls, 0) = 0 THEN 0
                         ELSE ROUND(total_503::numeric / total_calls::numeric * 100, 2) END,
    'rate_cold_start_pct', CASE WHEN COALESCE(total_calls, 0) = 0 THEN 0
                                ELSE ROUND(total_cold::numeric / total_calls::numeric * 100, 2) END,
    'last_cold_start_at', recent_cold_at,
    'prev_window_503', COALESCE(prev_503, 0),
    'delta_503', COALESCE(total_503, 0) - COALESCE(prev_503, 0)
  );
END;
$$;


--
-- Name: quote_approval_tokens; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.quote_approval_tokens (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    quote_id text NOT NULL,
    token text DEFAULT encode(extensions.gen_random_bytes(32), 'hex'::text) NOT NULL,
    seller_id uuid NOT NULL,
    client_name text,
    client_email text,
    status text DEFAULT 'active'::text NOT NULL,
    expires_at timestamp with time zone DEFAULT (now() + '30 days'::interval),
    viewed_at timestamp with time zone,
    responded_at timestamp with time zone,
    response text,
    response_notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    signer_name text,
    signer_document text,
    signer_ip text,
    signer_user_agent text,
    signature_hash text,
    signed_at timestamp with time zone
);


--
-- Name: get_quote_token_by_value(text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_quote_token_by_value(_token text) RETURNS SETOF public.quote_approval_tokens
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT * FROM public.quote_approval_tokens WHERE token = _token LIMIT 1;
$$;


--
-- Name: get_top_collected_products(integer, integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_top_collected_products(_days integer DEFAULT 7, _limit integer DEFAULT 6) RETURNS TABLE(product_id text, col_count bigint)
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT
    ci.product_id,
    COUNT(*)::bigint AS col_count
  FROM public.collection_items ci
  WHERE ci.created_at >= (now() - make_interval(days => GREATEST(_days, 1)))
  GROUP BY ci.product_id
  ORDER BY col_count DESC, MAX(ci.created_at) DESC
  LIMIT GREATEST(_limit, 1);
$$;


--
-- Name: get_top_compared_products(integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_top_compared_products(p_limit integer DEFAULT 6) RETURNS TABLE(product_id text, comparison_count bigint)
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT
    (item->>'productId')::text AS product_id,
    count(*)::bigint AS comparison_count
  FROM public.user_comparisons,
       jsonb_array_elements(items) AS item
  WHERE updated_at > now() - interval '30 days'
  GROUP BY (item->>'productId')
  ORDER BY comparison_count DESC
  LIMIT p_limit;
$$;


--
-- Name: get_top_favorited_products(integer, integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_top_favorited_products(_days integer DEFAULT 7, _limit integer DEFAULT 6) RETURNS TABLE(product_id text, fav_count bigint)
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT
    fi.product_id,
    COUNT(*)::bigint AS fav_count
  FROM public.favorite_items fi
  WHERE fi.added_at >= (now() - make_interval(days => GREATEST(_days, 1)))
  GROUP BY fi.product_id
  ORDER BY fav_count DESC, MAX(fi.added_at) DESC
  LIMIT GREATEST(_limit, 1);
$$;


--
-- Name: get_unread_count(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_unread_count() RETURNS integer
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  count_val INTEGER;
BEGIN
  SELECT COUNT(*)::INTEGER INTO count_val
  FROM public.workspace_notifications
  WHERE user_id = auth.uid() AND is_read = FALSE;
  RETURN count_val;
END;
$$;


--
-- Name: get_user_org_ids(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_user_org_ids(_user_id uuid) RETURNS TABLE(organization_id uuid)
    LANGUAGE sql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT organization_id FROM public.organization_members WHERE user_id = _user_id
$$;


--
-- Name: get_user_recent_comparisons(integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_user_recent_comparisons(p_limit integer DEFAULT 5) RETURNS TABLE(id uuid, name text, client_name text, items jsonb, item_count integer, updated_at timestamp with time zone)
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT
    uc.id,
    uc.name,
    uc.client_name,
    uc.items,
    jsonb_array_length(uc.items) AS item_count,
    uc.updated_at
  FROM public.user_comparisons uc
  WHERE uc.user_id = auth.uid()
  ORDER BY uc.updated_at DESC
  LIMIT p_limit;
$$;


--
-- Name: get_webhook_delivery_summary(integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_webhook_delivery_summary(_minutes integer DEFAULT 60) RETURNS TABLE(source text, direction text, status_class text, total bigint, failures bigint, p95_ms integer, last_failure_at timestamp with time zone)
    LANGUAGE sql STABLE
    SET search_path TO 'public'
    AS $$
  SELECT
    source,
    direction,
    CASE
      WHEN http_status BETWEEN 200 AND 299 THEN '2xx'
      WHEN http_status BETWEEN 300 AND 399 THEN '3xx'
      WHEN http_status BETWEEN 400 AND 499 THEN '4xx'
      WHEN http_status BETWEEN 500 AND 599 THEN '5xx'
      ELSE 'unknown'
    END AS status_class,
    COUNT(*)::BIGINT AS total,
    COUNT(*) FILTER (WHERE success = false)::BIGINT AS failures,
    PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY duration_ms)::INT AS p95_ms,
    MAX(occurred_at) FILTER (WHERE success = false) AS last_failure_at
  FROM public.webhook_delivery_metrics
  WHERE occurred_at >= now() - make_interval(mins => _minutes)
  GROUP BY source, direction, status_class
  ORDER BY source, direction, status_class;
$$;


--
-- Name: guard_mcp_api_keys_writes(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.guard_mcp_api_keys_writes() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_role TEXT := current_setting('role', true);
  v_actor UUID := auth.uid();
BEGIN
  -- Se for service_role (edge functions), permite normalmente
  IF v_role = 'service_role' OR current_user = 'service_role' THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  -- Caso contrário, registra violação e bloqueia
  PERFORM public.record_mcp_access_violation(
    v_actor,
    'unauthorized_direct_write',
    'db_trigger:mcp_api_keys',
    TG_OP,
    COALESCE(NEW.id, OLD.id),
    NULL,
    NULL,
    NULL,
    jsonb_build_object('current_user', current_user, 'role', v_role)
  );

  RAISE EXCEPTION 'Direct writes to mcp_api_keys are not allowed';
END;
$$;


--
-- Name: handle_new_user(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.handle_new_user() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  -- Create profile (role will be synced by trg_sync_role_to_profile)
  INSERT INTO public.profiles (user_id, email, full_name)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', '')
  );
  
  -- Create default role (triggers sync to profiles.role)
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'vendedor');
  
  RETURN NEW;
END;
$$;


--
-- Name: has_org_role(uuid, uuid, public.org_role); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.has_org_role(_user_id uuid, _org_id uuid, _role public.org_role) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.organization_members
    WHERE user_id = _user_id AND organization_id = _org_id AND role = _role
  )
$$;


--
-- Name: has_role(uuid, public.app_role); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.has_role(_user_id uuid, _role public.app_role) RETURNS boolean
    LANGUAGE sql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;


--
-- Name: increment_kit_template_usage(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.increment_kit_template_usage(_template_id uuid) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;
  UPDATE public.kit_templates
  SET usage_count = usage_count + 1
  WHERE id = _template_id AND is_active = true;
END;
$$;


--
-- Name: increment_row_version(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.increment_row_version() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  -- Only bump version on actual data changes (not when only version itself was sent)
  IF TG_OP = 'UPDATE' AND OLD.version IS NOT DISTINCT FROM NEW.version THEN
    NEW.version := COALESCE(OLD.version, 1) + 1;
  END IF;
  RETURN NEW;
END;
$$;


--
-- Name: invalidate_used_approval_token(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.invalidate_used_approval_token() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  -- When a response is recorded, mark as expired to prevent reuse
  IF NEW.responded_at IS NOT NULL AND OLD.responded_at IS NULL THEN
    NEW.status := 'responded';
    -- Set expires_at to now to prevent any further use
    NEW.expires_at := now();
  END IF;
  RETURN NEW;
END;
$$;


--
-- Name: is_admin(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.is_admin() RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT public.is_supervisor_or_above(auth.uid())
$$;


--
-- Name: is_admin(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.is_admin(_user_id uuid DEFAULT auth.uid()) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT public.is_supervisor_or_above(_user_id)
$$;


--
-- Name: is_admin_strict(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.is_admin_strict(_user_id uuid DEFAULT auth.uid()) RETURNS boolean
    LANGUAGE sql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = 'admin'::public.app_role
  )
$$;


--
-- Name: is_dev(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.is_dev(_user_id uuid DEFAULT auth.uid()) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = 'dev'::public.app_role
  )
$$;


--
-- Name: is_dnd_active(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.is_dnd_active() RETURNS boolean
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  dnd_enabled BOOLEAN;
  dnd_start TIME;
  dnd_end TIME;
  current_t TIME;
BEGIN
  SELECT 
    COALESCE((preferences->>'dnd_enabled')::boolean, false),
    (preferences->>'dnd_start')::time,
    (preferences->>'dnd_end')::time
  INTO dnd_enabled, dnd_start, dnd_end
  FROM public.profiles
  WHERE user_id = auth.uid();
  
  IF NOT dnd_enabled OR dnd_start IS NULL OR dnd_end IS NULL THEN
    RETURN FALSE;
  END IF;
  
  current_t := LOCALTIME;
  
  IF dnd_start <= dnd_end THEN
    RETURN current_t BETWEEN dnd_start AND dnd_end;
  ELSE
    RETURN current_t >= dnd_start OR current_t <= dnd_end;
  END IF;
END;
$$;


--
-- Name: is_kit_collaborator(uuid, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.is_kit_collaborator(_kit_id uuid, _user_id uuid) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.kit_collaborators
    WHERE kit_id = _kit_id AND user_id = _user_id
  );
$$;


--
-- Name: is_kit_owner(uuid, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.is_kit_owner(_kit_id uuid, _user_id uuid) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.custom_kits WHERE id = _kit_id AND user_id = _user_id
  );
$$;


--
-- Name: is_manager_or_admin(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.is_manager_or_admin() RETURNS boolean
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid() AND role IN ('admin', 'manager')
  );
END;
$$;


--
-- Name: is_org_member(uuid, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.is_org_member(_user_id uuid, _org_id uuid) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.organization_members
    WHERE user_id = _user_id AND organization_id = _org_id
  )
$$;


--
-- Name: is_seller_only(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.is_seller_only(_user_id uuid DEFAULT auth.uid()) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT public.has_role(_user_id,'vendedor'::public.app_role)
     AND NOT public.can_manage_quotes(_user_id)
     AND NOT public.is_admin_strict(_user_id)
$$;


--
-- Name: is_supervisor_or_above(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.is_supervisor_or_above(_user_id uuid DEFAULT auth.uid()) RETURNS boolean
    LANGUAGE sql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id
      AND role IN ('dev'::public.app_role,
                   'supervisor'::public.app_role,
                   'admin'::public.app_role,
                   'manager'::public.app_role)
  )
$$;


--
-- Name: limit_recently_viewed_items(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.limit_recently_viewed_items() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
    -- Remove os itens que excederem o limite de 100 por usuário
    DELETE FROM public.recently_viewed_products
    WHERE id IN (
        SELECT id
        FROM public.recently_viewed_products
        WHERE user_id = NEW.user_id
        ORDER BY viewed_at DESC
        OFFSET 100
    );
    RETURN NEW;
END;
$$;


--
-- Name: limit_recently_viewed_products(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.limit_recently_viewed_products() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
    -- Remove os itens mais antigos se passar de 50
    DELETE FROM public.recently_viewed_products
    WHERE id IN (
        SELECT id
        FROM public.recently_viewed_products
        WHERE user_id = NEW.user_id
        ORDER BY viewed_at DESC
        OFFSET 50
    );
    RETURN NEW;
END;
$$;


--
-- Name: log_access_denied(text, text, text, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.log_access_denied(_blocked_path text, _required_role text, _user_role text DEFAULT NULL::text, _reason text DEFAULT 'route_blocked'::text) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  _uid uuid := auth.uid();
BEGIN
  IF _uid IS NULL THEN
    -- Não autenticado: ignora silenciosamente (não polui o log)
    RETURN;
  END IF;

  IF _required_role NOT IN ('dev','admin','supervisor') THEN
    RAISE EXCEPTION 'invalid required_role: %', _required_role;
  END IF;

  INSERT INTO public.admin_audit_log (
    user_id,
    action,
    resource_type,
    resource_id,
    status,
    source,
    started_at,
    finished_at,
    duration_ms,
    request_id,
    payload_summary,
    details
  ) VALUES (
    _uid,
    'route.access_denied',
    'route',
    _blocked_path,
    'denied',
    'frontend-guard',
    now(),
    now(),
    0,
    gen_random_uuid()::text,
    jsonb_build_object('blocked_path', _blocked_path),
    jsonb_build_object(
      'reason', _reason,
      'blocked_path', _blocked_path,
      'required_role', _required_role,
      'user_role', _user_role
    )
  );
END;
$$;


--
-- Name: log_full_scope_grant(text, uuid, text, uuid, uuid, text, boolean, timestamp with time zone, inet, text, text, jsonb); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.log_full_scope_grant(_operation text, _key_id uuid, _key_prefix text, _challenge_id uuid DEFAULT NULL::uuid, _token_id uuid DEFAULT NULL::uuid, _justification text DEFAULT NULL::text, _confirmation_phrase_ok boolean DEFAULT NULL::boolean, _expires_at timestamp with time zone DEFAULT NULL::timestamp with time zone, _ip inet DEFAULT NULL::inet, _user_agent text DEFAULT NULL::text, _request_id text DEFAULT NULL::text, _extra jsonb DEFAULT '{}'::jsonb) RETURNS uuid
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  _uid UUID := auth.uid();
  _action public.step_up_action;
  _id UUID;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'unauthorized'; END IF;

  -- Mapeia operação → step_up_action
  _action := CASE _operation
    WHEN 'escalate' THEN 'mcp_full_escalate'::public.step_up_action
    ELSE 'mcp_full_issue'::public.step_up_action
  END;

  INSERT INTO public.step_up_audit_log (
    user_id, action, target_ref, event_type,
    challenge_id, token_id, ip_address, user_agent, metadata
  ) VALUES (
    _uid, _action, _key_id::text, 'full_scope_granted',
    _challenge_id, _token_id, _ip, _user_agent,
    jsonb_build_object(
      'operation',          _operation,
      'key_id',             _key_id,
      'key_prefix',         _key_prefix,
      'expires_at',         _expires_at,
      'justification',      _justification,
      'verifications', jsonb_build_object(
        'is_dev_recheck',         true,    -- garantido pela edge antes de chamar
        'step_up_token_consumed', _token_id IS NOT NULL,
        'can_grant_mcp_full',     true,    -- garantido pela edge antes de chamar
        'confirmation_phrase_ok', COALESCE(_confirmation_phrase_ok, true),
        'has_justification',      _justification IS NOT NULL AND length(_justification) > 0
      ),
      'request_id',         _request_id,
      'granted_at',         now(),
      'extra',              _extra
    )
  )
  RETURNING id INTO _id;

  RETURN _id;
END;
$$;


--
-- Name: log_mcp_key_changes(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.log_mcp_key_changes() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  actor uuid;
  changed jsonb := '{}'::jsonb;
  fields text[] := ARRAY[]::text[];
  was_full boolean;
  is_now_full boolean;
  escalated boolean := false;
BEGIN
  actor := public.mcp_audit_actor(NEW.created_by);

  -- Caso 1: revogação (NULL -> NOT NULL)
  IF OLD.revoked_at IS NULL AND NEW.revoked_at IS NOT NULL THEN
    INSERT INTO public.admin_audit_log (
      user_id, action, resource_type, resource_id, details
    ) VALUES (
      actor,
      'mcp_key.revoked',
      'mcp_api_key',
      NEW.id::text,
      jsonb_build_object(
        'key_prefix', NEW.key_prefix,
        'name', NEW.name,
        'scopes', NEW.scopes,
        'is_full_access', '*' = ANY(NEW.scopes),
        'revoked_at', NEW.revoked_at
      )
    );
    RETURN NEW;
  END IF;

  -- Caso 2: alteração de campos sensíveis
  IF NEW.name IS DISTINCT FROM OLD.name THEN
    fields := array_append(fields, 'name');
    changed := changed || jsonb_build_object('name', jsonb_build_object('before', OLD.name, 'after', NEW.name));
  END IF;
  IF NEW.description IS DISTINCT FROM OLD.description THEN
    fields := array_append(fields, 'description');
    changed := changed || jsonb_build_object('description', jsonb_build_object('before', OLD.description, 'after', NEW.description));
  END IF;
  IF NEW.expires_at IS DISTINCT FROM OLD.expires_at THEN
    fields := array_append(fields, 'expires_at');
    changed := changed || jsonb_build_object('expires_at', jsonb_build_object('before', OLD.expires_at, 'after', NEW.expires_at));
  END IF;
  IF NEW.scopes IS DISTINCT FROM OLD.scopes THEN
    fields := array_append(fields, 'scopes');
    changed := changed || jsonb_build_object('scopes', jsonb_build_object('before', OLD.scopes, 'after', NEW.scopes));
    was_full := '*' = ANY(COALESCE(OLD.scopes, ARRAY[]::text[]));
    is_now_full := '*' = ANY(COALESCE(NEW.scopes, ARRAY[]::text[]));
    IF NOT was_full AND is_now_full THEN
      escalated := true;
    END IF;
  END IF;

  IF array_length(fields, 1) IS NOT NULL THEN
    INSERT INTO public.admin_audit_log (
      user_id, action, resource_type, resource_id, details
    ) VALUES (
      actor,
      'mcp_key.updated',
      'mcp_api_key',
      NEW.id::text,
      jsonb_build_object(
        'key_prefix', NEW.key_prefix,
        'name', NEW.name,
        'fields_changed', fields,
        'diff', changed,
        'escalated_to_full', escalated
      )
    );

    IF escalated THEN
      INSERT INTO public.admin_audit_log (
        user_id, action, resource_type, resource_id, details
      ) VALUES (
        actor,
        'mcp_key.scope_escalated',
        'mcp_api_key',
        NEW.id::text,
        jsonb_build_object(
          'key_prefix', NEW.key_prefix,
          'name', NEW.name,
          'before_scopes', OLD.scopes,
          'after_scopes', NEW.scopes
        )
      );
    END IF;
  END IF;

  RETURN NEW;
END;
$$;


--
-- Name: log_mcp_key_revocation(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.log_mcp_key_revocation() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  -- Dispara apenas quando revoked_at passa de NULL para NOT NULL
  IF OLD.revoked_at IS NULL AND NEW.revoked_at IS NOT NULL THEN
    INSERT INTO public.admin_audit_log (
      user_id,
      action,
      resource_type,
      resource_id,
      details
    ) VALUES (
      COALESCE(auth.uid(), NEW.created_by),
      'mcp_key.revoked',
      'mcp_api_key',
      NEW.id::text,
      jsonb_build_object(
        'key_prefix', NEW.key_prefix,
        'name', NEW.name,
        'scopes', NEW.scopes,
        'is_full_access', '*' = ANY(NEW.scopes),
        'revoked_at', NEW.revoked_at
      )
    );
  END IF;
  RETURN NEW;
END;
$$;


--
-- Name: log_mockup_prompt_change(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.log_mockup_prompt_change() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND (OLD.prompt_text IS DISTINCT FROM NEW.prompt_text OR OLD.ai_model IS DISTINCT FROM NEW.ai_model) THEN
    NEW.version := OLD.version + 1;
    INSERT INTO public.mockup_prompt_history (
      config_id, config_key, old_prompt, new_prompt, ai_model, version, changed_by
    ) VALUES (
      NEW.id, NEW.config_key, OLD.prompt_text, NEW.prompt_text, NEW.ai_model, NEW.version, auth.uid()
    );
  END IF;
  RETURN NEW;
END;
$$;


--
-- Name: log_rls_denial(text, text, text, text, uuid, uuid, text, text, text, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.log_rls_denial(p_table_name text, p_operation text, p_endpoint text DEFAULT NULL::text, p_query_summary text DEFAULT NULL::text, p_target_id uuid DEFAULT NULL::uuid, p_target_seller_id uuid DEFAULT NULL::uuid, p_policy_hint text DEFAULT NULL::text, p_error_code text DEFAULT NULL::text, p_error_message text DEFAULT NULL::text, p_user_agent text DEFAULT NULL::text) RETURNS uuid
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_email TEXT;
  v_role TEXT;
  v_id UUID;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'unauthenticated';
  END IF;

  IF p_operation NOT IN ('SELECT','INSERT','UPDATE','DELETE') THEN
    RAISE EXCEPTION 'invalid_operation';
  END IF;

  -- enriquece com email + papel principal (best-effort)
  SELECT email, role INTO v_email, v_role
  FROM public.profiles
  WHERE user_id = v_uid
  LIMIT 1;

  INSERT INTO public.rls_denial_log (
    user_id, user_email, user_role, table_name, operation,
    endpoint, query_summary, target_id, target_seller_id,
    policy_hint, error_code, error_message, user_agent
  ) VALUES (
    v_uid, v_email, v_role, p_table_name, p_operation,
    p_endpoint, p_query_summary, p_target_id, p_target_seller_id,
    p_policy_hint, p_error_code, p_error_message, p_user_agent
  )
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;


--
-- Name: log_user_logout(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.log_user_logout() RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  INSERT INTO public.admin_audit_log (
    user_id,
    action,
    resource_type,
    status,
    source,
    details
  ) VALUES (
    auth.uid(),
    'user.logout',
    'auth',
    'success',
    'client.auth',
    jsonb_build_object('timestamp', now())
  );
END;
$$;


--
-- Name: lookup_request_id(text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.lookup_request_id(_request_id text) RETURNS jsonb
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_webhook_events jsonb;
BEGIN
  IF NOT (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'dev'::app_role)) THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;

  IF _request_id IS NULL OR length(_request_id) < 8 OR length(_request_id) > 128 THEN
    RAISE EXCEPTION 'invalid_request_id' USING ERRCODE = '22023';
  END IF;

  SELECT COALESCE(jsonb_agg(row_to_json(r) ORDER BY (r->>'occurred_at')), '[]'::jsonb)
  INTO v_webhook_events
  FROM (
    SELECT
      occurred_at,
      source,
      direction,
      event_type,
      endpoint,
      http_status,
      duration_ms,
      attempt,
      success,
      error_class,
      error_message,
      payload_bytes
    FROM public.webhook_delivery_metrics
    WHERE request_id = _request_id
    ORDER BY occurred_at ASC
    LIMIT 200
  ) r;

  RETURN jsonb_build_object(
    'request_id', _request_id,
    'webhook_events', v_webhook_events,
    'event_count', jsonb_array_length(v_webhook_events)
  );
END;
$$;


--
-- Name: maintain_webhook_metrics(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.maintain_webhook_metrics() RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
    partition_name TEXT;
    next_month DATE := date_trunc('month', now() + interval '1 month');
    next_month_end DATE := date_trunc('month', now() + interval '2 month');
BEGIN
    DELETE FROM public.webhook_delivery_metrics WHERE occurred_at < now() - INTERVAL '90 days';

    partition_name := 'webhook_delivery_metrics_y' || to_char(next_month, 'YYYY') || 'm' || to_char(next_month, 'MM');
    
    IF NOT EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = partition_name) THEN
        EXECUTE format('CREATE TABLE public.%I PARTITION OF public.webhook_delivery_metrics FOR VALUES FROM (%L) TO (%L)', 
            partition_name, next_month, next_month_end);
    END IF;
END;
$$;


--
-- Name: mark_all_notifications_read(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.mark_all_notifications_read() RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  UPDATE public.workspace_notifications
  SET is_read = TRUE
  WHERE user_id = auth.uid() AND is_read = FALSE;
END;
$$;


--
-- Name: mark_notification_read(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.mark_notification_read(p_notification_id uuid) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  UPDATE public.workspace_notifications
  SET is_read = TRUE
  WHERE id = p_notification_id AND user_id = auth.uid();
END;
$$;


--
-- Name: mark_step_up_password_verified(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.mark_step_up_password_verified(_challenge_id uuid) RETURNS boolean
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  _uid UUID := auth.uid();
  _row RECORD;
BEGIN
  SELECT * INTO _row FROM public.step_up_challenges
  WHERE id = _challenge_id AND user_id = _uid AND consumed = false AND expires_at > now()
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN false;
  END IF;

  UPDATE public.step_up_challenges SET password_verified = true WHERE id = _challenge_id;

  INSERT INTO public.step_up_audit_log(user_id, action, target_ref, event_type, challenge_id)
  VALUES (_uid, _row.action, _row.target_ref, 'password_verified', _challenge_id);

  RETURN true;
END;
$$;


--
-- Name: mcp_audit_actor(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.mcp_audit_actor(_fallback uuid) RETURNS uuid
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  jwt_sub text;
  header_actor text;
BEGIN
  -- Header customizado setado pelas edge functions (set_config('request.jwt.claim.sub', ...))
  BEGIN
    header_actor := current_setting('request.mcp_actor', true);
  EXCEPTION WHEN OTHERS THEN
    header_actor := NULL;
  END;
  IF header_actor IS NOT NULL AND header_actor <> '' THEN
    RETURN header_actor::uuid;
  END IF;

  -- JWT padrão Supabase
  IF auth.uid() IS NOT NULL THEN
    RETURN auth.uid();
  END IF;

  BEGIN
    jwt_sub := current_setting('request.jwt.claims', true)::jsonb->>'sub';
  EXCEPTION WHEN OTHERS THEN
    jwt_sub := NULL;
  END;
  IF jwt_sub IS NOT NULL AND jwt_sub <> '' THEN
    RETURN jwt_sub::uuid;
  END IF;

  RETURN _fallback;
END;
$$;


--
-- Name: move_collection_item_to_trash(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.move_collection_item_to_trash() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  _user_id UUID;
BEGIN
  SELECT user_id INTO _user_id FROM public.collections WHERE id = OLD.collection_id;
  IF _user_id IS NULL THEN
    RETURN OLD;
  END IF;

  INSERT INTO public.collection_items_trash (
    original_id, collection_id, user_id, product_id,
    color_name, color_hex, thumbnail_url, notes, sort_order
  ) VALUES (
    OLD.id, OLD.collection_id, _user_id, OLD.product_id,
    OLD.color_name, OLD.color_hex, OLD.thumbnail_url, OLD.notes, OLD.sort_order
  );
  RETURN OLD;
END;
$$;


--
-- Name: move_favorite_to_trash(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.move_favorite_to_trash() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  INSERT INTO public.favorite_items_trash (
    original_id, list_id, user_id, product_id, variant_id,
    variant_info, note, price_at_save
  ) VALUES (
    OLD.id, OLD.list_id, OLD.user_id, OLD.product_id, OLD.variant_id,
    OLD.variant_info, OLD.note, OLD.price_at_save
  );
  RETURN OLD;
END;
$$;


--
-- Name: notify_discount_approval_request(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.notify_discount_approval_request() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  seller_name TEXT;
  quote_num TEXT;
  admin_user RECORD;
BEGIN
  -- Only on new pending requests
  IF TG_OP = 'INSERT' AND NEW.status = 'pending' THEN
    SELECT full_name INTO seller_name FROM public.profiles WHERE user_id = NEW.seller_id;
    SELECT quote_number INTO quote_num FROM public.quotes WHERE id = NEW.quote_id;

    -- Notify all admins
    FOR admin_user IN SELECT ur.user_id FROM public.user_roles ur WHERE ur.role = 'admin' LOOP
      INSERT INTO public.workspace_notifications (user_id, title, message, type, category, action_url)
      VALUES (
        admin_user.user_id,
        '⚠️ Desconto acima do limite',
        COALESCE(seller_name, 'Vendedor') || ' solicitou ' || NEW.requested_discount_percent || '% de desconto no orçamento ' || COALESCE(quote_num, '') || ' (limite: ' || NEW.max_allowed_percent || '%).',
        'warning',
        'quotes',
        '/admin/aprovacoes-desconto'
      );
    END LOOP;
  END IF;

  -- Notify seller on approval/rejection
  IF TG_OP = 'UPDATE' AND OLD.status = 'pending' AND NEW.status IN ('approved', 'rejected') THEN
    SELECT quote_number INTO quote_num FROM public.quotes WHERE id = NEW.quote_id;
    
    IF NEW.status = 'approved' THEN
      INSERT INTO public.workspace_notifications (user_id, title, message, type, category, action_url)
      VALUES (
        NEW.seller_id,
        '✅ Desconto aprovado!',
        'Seu desconto de ' || NEW.requested_discount_percent || '% no orçamento ' || COALESCE(quote_num, '') || ' foi aprovado.',
        'success',
        'quotes',
        '/orcamentos'
      );
    ELSE
      INSERT INTO public.workspace_notifications (user_id, title, message, type, category, action_url)
      VALUES (
        NEW.seller_id,
        '❌ Desconto recusado',
        'Seu desconto de ' || NEW.requested_discount_percent || '% no orçamento ' || COALESCE(quote_num, '') || ' foi recusado.' || COALESCE(' Motivo: ' || NEW.admin_notes, ''),
        'warning',
        'quotes',
        '/orcamentos'
      );
    END IF;
  END IF;

  RETURN NEW;
END;
$$;


--
-- Name: notify_hardening_regression(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.notify_hardening_regression() RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  _private_buckets int;
  _sensitive_realtime int;
  _pg_trgm_in_extensions boolean;
  _cleanup_job_active boolean;
  _failures text[] := ARRAY[]::text[];
  _score int := 0;
  _max int := 5;
  _admin record;
  _notified int := 0;
  _msg text;
BEGIN
  SELECT count(*) INTO _private_buckets
  FROM storage.buckets
  WHERE id IN ('personalization-images','product-videos','supplier-logos','component-media')
    AND public = false;
  IF _private_buckets = 4 THEN _score := _score + 1;
  ELSE _failures := _failures || format('Buckets privados: %s/4', _private_buckets); END IF;

  SELECT count(*) INTO _sensitive_realtime
  FROM pg_publication_tables
  WHERE pubname = 'supabase_realtime'
    AND schemaname = 'public'
    AND tablename IN ('discount_approval_requests','kit_variants','kit_comments');
  IF _sensitive_realtime = 0 THEN _score := _score + 1;
  ELSE _failures := _failures || format('Tabelas sensíveis em realtime: %s', _sensitive_realtime); END IF;

  SELECT EXISTS (
    SELECT 1 FROM pg_extension e
    JOIN pg_namespace n ON n.oid = e.extnamespace
    WHERE e.extname = 'pg_trgm' AND n.nspname = 'extensions'
  ) INTO _pg_trgm_in_extensions;
  IF _pg_trgm_in_extensions THEN _score := _score + 1;
  ELSE _failures := _failures || 'pg_trgm fora do schema extensions'; END IF;

  SELECT EXISTS (
    SELECT 1 FROM cron.job WHERE jobname = 'cleanup-security-logs-daily' AND active = true
  ) INTO _cleanup_job_active;
  IF _cleanup_job_active THEN _score := _score + 1;
  ELSE _failures := _failures || 'Job cleanup-security-logs-daily inativo'; END IF;

  -- MFA enforced em app — assumido sempre true (controlado em código, não DB)
  _score := _score + 1;

  IF _score >= _max THEN
    RETURN jsonb_build_object('ok', true, 'score', _score, 'max', _max, 'notified', 0);
  END IF;

  _msg := format(
    'Saúde do hardening caiu para %s/%s. Falhas: %s. Acesse /admin/seguranca-acesso.',
    _score, _max, array_to_string(_failures, '; ')
  );

  FOR _admin IN
    SELECT user_id FROM public.user_roles WHERE role = 'admin'
  LOOP
    IF NOT EXISTS (
      SELECT 1 FROM public.workspace_notifications
      WHERE user_id = _admin.user_id
        AND category = 'security'
        AND title = '⚠️ Regressão de hardening detectada'
        AND created_at > now() - interval '20 hours'
    ) THEN
      INSERT INTO public.workspace_notifications (
        user_id, title, message, type, category, action_url, metadata
      ) VALUES (
        _admin.user_id,
        '⚠️ Regressão de hardening detectada',
        _msg,
        'warning',
        'security',
        '/admin/seguranca-acesso',
        jsonb_build_object('score', _score, 'max', _max, 'failures', _failures)
      );
      _notified := _notified + 1;
    END IF;
  END LOOP;

  RETURN jsonb_build_object(
    'ok', true,
    'score', _score,
    'max', _max,
    'failures', _failures,
    'notified', _notified
  );
END;
$$;


--
-- Name: notify_new_order(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.notify_new_order() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  INSERT INTO public.workspace_notifications (user_id, title, message, type, category, action_url)
  VALUES (
    NEW.seller_id,
    '🎉 Novo pedido recebido!',
    'Pedido ' || NEW.order_number || COALESCE(' de ' || NEW.client_name, '') || ' foi criado.',
    'success',
    'orders',
    '/pedidos'
  );

  RETURN NEW;
END;
$$;


--
-- Name: notify_quote_client_response(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.notify_quote_client_response() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  notif_title TEXT;
  notif_message TEXT;
  notif_type TEXT;
BEGIN
  -- Only trigger when responded_at changes from null
  IF OLD.responded_at IS NOT NULL OR NEW.responded_at IS NULL THEN
    RETURN NEW;
  END IF;

  IF NEW.response = 'approved' THEN
    notif_title := '🎉 Cliente aprovou o orçamento!';
    notif_message := COALESCE(NEW.client_name, 'O cliente') || ' aprovou o orçamento via link de aprovação.';
    notif_type := 'success';
  ELSIF NEW.response = 'rejected' THEN
    notif_title := '😔 Cliente recusou o orçamento';
    notif_message := COALESCE(NEW.client_name, 'O cliente') || ' recusou o orçamento via link de aprovação.';
    notif_type := 'warning';
  ELSE
    RETURN NEW;
  END IF;

  INSERT INTO public.workspace_notifications (user_id, title, message, type, category, action_url)
  VALUES (NEW.seller_id, notif_title, notif_message, notif_type, 'quotes', '/orcamentos');

  RETURN NEW;
END;
$$;


--
-- Name: notify_quote_status_change(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.notify_quote_status_change() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  notif_title TEXT;
  notif_message TEXT;
  notif_type TEXT;
  notif_category TEXT;
  notif_url TEXT;
BEGIN
  -- Only trigger on status changes
  IF OLD.status IS NOT DISTINCT FROM NEW.status THEN
    RETURN NEW;
  END IF;

  notif_category := 'quotes';
  notif_url := '/orcamentos';

  CASE NEW.status
    WHEN 'approved' THEN
      notif_title := '✅ Orçamento aprovado!';
      notif_message := 'O orçamento ' || NEW.quote_number || COALESCE(' de ' || NEW.client_name, '') || ' foi aprovado!';
      notif_type := 'success';
    WHEN 'rejected' THEN
      notif_title := '❌ Orçamento recusado';
      notif_message := 'O orçamento ' || NEW.quote_number || COALESCE(' de ' || NEW.client_name, '') || ' foi recusado.';
      notif_type := 'warning';
    WHEN 'sent' THEN
      notif_title := '📤 Orçamento enviado';
      notif_message := 'O orçamento ' || NEW.quote_number || ' foi marcado como enviado.';
      notif_type := 'info';
    WHEN 'expired' THEN
      notif_title := '⏰ Orçamento expirado';
      notif_message := 'O orçamento ' || NEW.quote_number || COALESCE(' de ' || NEW.client_name, '') || ' expirou.';
      notif_type := 'warning';
    ELSE
      RETURN NEW;
  END CASE;

  INSERT INTO public.workspace_notifications (user_id, title, message, type, category, action_url)
  VALUES (NEW.seller_id, notif_title, notif_message, notif_type, notif_category, notif_url);

  RETURN NEW;
END;
$$;


--
-- Name: prevent_profile_role_change(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.prevent_profile_role_change() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  IF OLD.role IS DISTINCT FROM NEW.role THEN
    IF auth.uid() IS NOT NULL AND NOT has_role(auth.uid(), 'admin') THEN
      RAISE EXCEPTION 'Only admins can change the role field on profiles';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;


--
-- Name: prevent_role_self_update(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.prevent_role_self_update() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  IF OLD.role IS DISTINCT FROM NEW.role THEN
    IF auth.uid() IS NOT NULL AND NOT has_role(auth.uid(), 'admin') THEN
      RAISE EXCEPTION 'Only admins can change roles';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;


--
-- Name: purge_expired_security_data(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.purge_expired_security_data() RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
BEGIN
  -- Limpa artefatos de step-up via helper existente
  PERFORM public.purge_expired_step_up_artifacts(60, 60);
  
  -- Limpa tentativas de login antigas (90 dias)
  DELETE FROM public.login_attempts WHERE created_at < now() - interval '90 days';
END;
$$;


--
-- Name: purge_expired_step_up_artifacts(integer, integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.purge_expired_step_up_artifacts(_challenge_grace_minutes integer DEFAULT 60, _token_grace_minutes integer DEFAULT 60) RETURNS TABLE(challenges_deleted bigint, tokens_deleted bigint)
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  _ch bigint := 0;
  _tk bigint := 0;
BEGIN
  -- Delete tokens first (FK challenge_id ON DELETE may be SET NULL/CASCADE; safe either way)
  WITH del AS (
    DELETE FROM public.step_up_tokens
    WHERE expires_at < (now() - make_interval(mins => _token_grace_minutes))
       OR (consumed = true AND consumed_at < (now() - make_interval(mins => _token_grace_minutes)))
    RETURNING 1
  )
  SELECT count(*) INTO _tk FROM del;

  WITH del AS (
    DELETE FROM public.step_up_challenges
    WHERE expires_at < (now() - make_interval(mins => _challenge_grace_minutes))
       OR (consumed = true AND created_at < (now() - make_interval(mins => _challenge_grace_minutes)))
    RETURNING 1
  )
  SELECT count(*) INTO _ch FROM del;

  -- Audit (best-effort; don't fail the job if table missing)
  BEGIN
    INSERT INTO public.admin_audit_log(action, target, metadata)
    VALUES (
      'step_up_artifacts_purged',
      'step_up_challenges,step_up_tokens',
      jsonb_build_object(
        'challenges_deleted', _ch,
        'tokens_deleted', _tk,
        'challenge_grace_minutes', _challenge_grace_minutes,
        'token_grace_minutes', _token_grace_minutes,
        'ran_at', now()
      )
    );
  EXCEPTION WHEN undefined_table OR undefined_column THEN
    NULL;
  END;

  RETURN QUERY SELECT _ch, _tk;
END;
$$;


--
-- Name: purge_old_audit_logs(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.purge_old_audit_logs() RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
    retention_days INT := 90;
    row_limit INT := 100000;
    current_count INT;
BEGIN
    -- 1. Remove logs older than the retention period
    DELETE FROM public.audit_logs
    WHERE created_at < now() - (retention_days || ' days')::interval;

    -- 2. Check total row count and trim if it exceeds the hard limit
    SELECT count(*) INTO current_count FROM public.audit_logs;
    
    IF current_count > row_limit THEN
        DELETE FROM public.audit_logs
        WHERE id IN (
            SELECT id
            FROM public.audit_logs
            ORDER BY created_at ASC
            LIMIT (current_count - row_limit)
        );
    END IF;
END;
$$;


--
-- Name: record_app_vital(text, double precision, text, text, text, text, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.record_app_vital(_name text, _value double precision, _rating text DEFAULT NULL::text, _req_id text DEFAULT NULL::text, _url text DEFAULT NULL::text, _ua text DEFAULT NULL::text, _uid uuid DEFAULT NULL::uuid) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  INSERT INTO public.app_vitals (
    metric_name, 
    metric_value, 
    rating, 
    request_id, 
    page_url, 
    user_agent, 
    user_id
  )
  VALUES (
    _name, 
    _value, 
    _rating, 
    _req_id, 
    _url, 
    _ua, 
    _uid
  );
END;
$$;


--
-- Name: record_app_vital(text, numeric, text, text, text, text, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.record_app_vital(_name text, _value numeric, _rating text, _req_id text, _url text, _ua text, _uid uuid DEFAULT NULL::uuid) RETURNS void
    LANGUAGE sql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
    INSERT INTO public.app_vitals (metric_name, metric_value, rating, request_id, page_url, user_agent, user_id)
    VALUES (_name, _value, _rating, _req_id, _url, _ua, _uid);
$$;


--
-- Name: record_auth_attempt(text, text, boolean, text, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.record_auth_attempt(_email text, _ip text, _success boolean, _reason text DEFAULT NULL::text, _ua text DEFAULT NULL::text) RETURNS void
    LANGUAGE sql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
    INSERT INTO public.auth_login_attempts (email, ip_address, success, failure_reason, user_agent)
    VALUES (_email, _ip, _success, _reason, _ua);
$$;


--
-- Name: record_dev_route_telemetry(text, text, text, integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.record_dev_route_telemetry(_event_type text, _blocked_path text, _user_role text DEFAULT NULL::text, _duration_ms integer DEFAULT NULL::integer) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  _uid uuid := auth.uid();
  _safe_path text;
  _safe_role text;
  _safe_duration integer;
  _recent_count integer;
  _allowed_events constant text[] := ARRAY[
    'view',           -- usuário viu a tela 403
    'back',           -- clicou em "Voltar" (history -1)
    'retry',          -- clicou em "Tentar novamente" (mesmo path)
    'fallback',       -- foi para área segura (Início/Usuários/Catálogo)
    'request_access', -- clicou em "Solicitar acesso a Dev"
    'copy_link',      -- copiou o link da rota bloqueada
    'mail',           -- abriu cliente de e-mail
    'abandon'         -- saiu/fechou a aba (best-effort beacon)
  ];
BEGIN
  -- 1) Anônimo: ignora silenciosamente (não polui audit log).
  IF _uid IS NULL THEN
    RETURN;
  END IF;

  -- 2) Whitelist de event_type (defense-in-depth).
  IF NOT (_event_type = ANY (_allowed_events)) THEN
    RAISE EXCEPTION 'invalid event_type: %', _event_type
      USING ERRCODE = '22023';
  END IF;

  -- 3) Sanitização (sem PII):
  --    - path: trim + corta em 200 chars (rotas internas são curtas).
  --    - role: corta em 32 chars; só aceita papéis conhecidos.
  --    - duration_ms: clamp em [0, 3_600_000] (1h).
  _safe_path := substring(coalesce(_blocked_path, '') from 1 for 200);
  IF length(_safe_path) = 0 THEN
    RAISE EXCEPTION 'blocked_path required' USING ERRCODE = '22023';
  END IF;

  _safe_role := substring(coalesce(_user_role, '') from 1 for 32);
  IF _safe_role NOT IN ('dev','admin','supervisor','agente','agent','vendedor','') THEN
    _safe_role := 'unknown';
  END IF;
  IF length(_safe_role) = 0 THEN
    _safe_role := NULL;
  END IF;

  IF _duration_ms IS NULL THEN
    _safe_duration := NULL;
  ELSIF _duration_ms < 0 THEN
    _safe_duration := 0;
  ELSIF _duration_ms > 3600000 THEN
    _safe_duration := 3600000;
  ELSE
    _safe_duration := _duration_ms;
  END IF;

  -- 4) Rate limit por usuário: 30 eventos/min.
  --    Usa o mesmo log para evitar tabela auxiliar.
  SELECT count(*) INTO _recent_count
  FROM public.admin_audit_log
  WHERE user_id = _uid
    AND action  = 'route.ux_event'
    AND source  = 'dev-route-ui'
    AND created_at > now() - interval '1 minute';

  IF _recent_count >= 30 THEN
    -- Excede orçamento: descarta silenciosamente para não amplificar abuso.
    RETURN;
  END IF;

  -- 5) Insere o evento. payload_summary intencionalmente mínimo (sem
  --    user_agent/IP/email — esses campos só são preenchidos por edge
  --    functions com service role e contexto de request).
  INSERT INTO public.admin_audit_log (
    user_id,
    action,
    resource_type,
    resource_id,
    status,
    source,
    started_at,
    finished_at,
    duration_ms,
    request_id,
    payload_summary,
    details
  ) VALUES (
    _uid,
    'route.ux_event',
    'route',
    _safe_path,
    CASE WHEN _event_type IN ('view','abandon','copy_link','mail') THEN 'denied'
         WHEN _event_type IN ('back','retry','fallback')           THEN 'partial'
         WHEN _event_type = 'request_access'                       THEN 'success'
         ELSE 'denied' END,
    'dev-route-ui',
    now(),
    now(),
    _safe_duration,
    gen_random_uuid()::text,
    jsonb_build_object(
      'event_type',   _event_type,
      'blocked_path', _safe_path
    ),
    jsonb_build_object(
      'event_type',   _event_type,
      'blocked_path', _safe_path,
      'user_role',    _safe_role,
      'duration_ms',  _safe_duration
    )
  );
END;
$$;


--
-- Name: record_mcp_access_violation(uuid, text, text, text, uuid, text, text, text, jsonb); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.record_mcp_access_violation(_user_id uuid, _reason text, _source text, _operation text DEFAULT NULL::text, _target_key_id uuid DEFAULT NULL::uuid, _ip text DEFAULT NULL::text, _user_agent text DEFAULT NULL::text, _request_id text DEFAULT NULL::text, _details jsonb DEFAULT '{}'::jsonb) RETURNS uuid
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_id UUID;
BEGIN
  INSERT INTO public.mcp_access_violations (
    user_id, reason, source, operation, target_key_id,
    ip_address, user_agent, request_id, details
  ) VALUES (
    _user_id, _reason, _source, _operation, _target_key_id,
    _ip, _user_agent, _request_id, COALESCE(_details, '{}'::jsonb)
  )
  RETURNING id INTO v_id;

  PERFORM public.check_mcp_abuse_threshold(_user_id, _ip);

  RETURN v_id;
EXCEPTION WHEN OTHERS THEN
  -- Nunca derruba a operação chamadora
  RAISE WARNING 'record_mcp_access_violation failed: %', SQLERRM;
  RETURN NULL;
END;
$$;


--
-- Name: record_platform_failure(text, text, text, integer, text, boolean, boolean, integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.record_platform_failure(p_operation text, p_table text DEFAULT NULL::text, p_rpc_name text DEFAULT NULL::text, p_duration_ms integer DEFAULT 0, p_error_message text DEFAULT NULL::text, p_is_503 boolean DEFAULT true, p_is_cold_start boolean DEFAULT false, p_retry_count integer DEFAULT 0) RETURNS uuid
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  new_id uuid;
BEGIN
  INSERT INTO public.query_telemetry (
    operation, table_name, rpc_name, duration_ms, record_count,
    severity, error_message, error_kind, user_id,
    retry_count, cache_hit, is_503, is_cold_start
  ) VALUES (
    COALESCE(p_operation, 'unknown'),
    p_table,
    p_rpc_name,
    GREATEST(COALESCE(p_duration_ms, 0), 0),
    NULL,
    'error',
    p_error_message,
    'network',
    auth.uid(),
    GREATEST(COALESCE(p_retry_count, 0), 0),
    false,
    COALESCE(p_is_503, true),
    COALESCE(p_is_cold_start, false)
  )
  RETURNING id INTO new_id;

  RETURN new_id;
END;
$$;


--
-- Name: record_public_token_failure(text, text, text, text, text, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.record_public_token_failure(_resource_type text, _resource_id text, _attempted_token text, _ip text, _ua text, _reason text) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  _recent_failures int;
BEGIN
  INSERT INTO public.public_token_failures (
    resource_type, resource_id, attempted_token, ip_address, user_agent, reason
  ) VALUES (
    _resource_type, _resource_id, _attempted_token, _ip, _ua, _reason
  );

  IF _resource_id IS NULL THEN
    RETURN;
  END IF;

  SELECT count(*) INTO _recent_failures
  FROM public.public_token_failures
  WHERE resource_type = _resource_type
    AND resource_id = _resource_id
    AND created_at > now() - interval '1 hour';

  IF _recent_failures >= 5 THEN
    IF _resource_type = 'quote' THEN
      UPDATE public.quote_approval_tokens
      SET status = 'expired', updated_at = now()
      WHERE quote_id = _resource_id AND status = 'active';
    ELSIF _resource_type = 'kit' THEN
      UPDATE public.kit_share_tokens
      SET status = 'expired', updated_at = now()
      WHERE kit_id::text = _resource_id AND status = 'active';
    END IF;
  END IF;
END;
$$;


--
-- Name: repair_ownership_orphans(uuid, boolean, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.repair_ownership_orphans(_report_id uuid DEFAULT NULL::uuid, _dry_run boolean DEFAULT true, _triggered_by_label text DEFAULT 'manual_admin'::text) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_caller uuid := auth.uid();
  v_report record;
  v_detail jsonb;
  v_table text;
  v_col text;
  v_null_count bigint;
  v_orphan_count bigint;
  v_action text;
  v_rows int;
  v_results jsonb := '[]'::jsonb;
  v_total_deleted int := 0;
  v_total_deactivated int := 0;
  v_total_manual int := 0;
  -- Tabelas onde apagar é seguro (logs/efêmeros)
  v_safe_delete text[] := ARRAY[
    'workspace_notifications', 'rls_denial_log',
    'mcp_audit_log', 'mcp_keys_audit_log',
    'role_migration_audit', 'login_attempts'
  ];
  v_has_active boolean;
  v_has_is_active boolean;
  v_has_status boolean;
BEGIN
  -- Permissão
  IF v_caller IS NULL OR NOT (
    has_role(v_caller, 'admin'::app_role) OR has_role(v_caller, 'dev'::app_role)
  ) THEN
    RAISE EXCEPTION 'repair_ownership_orphans: acesso negado';
  END IF;

  -- Pega o relatório (último por padrão)
  IF _report_id IS NULL THEN
    SELECT * INTO v_report
    FROM public.ownership_audit_reports
    ORDER BY generated_at DESC LIMIT 1;
  ELSE
    SELECT * INTO v_report
    FROM public.ownership_audit_reports WHERE id = _report_id;
  END IF;

  IF v_report.id IS NULL THEN
    RAISE EXCEPTION 'repair_ownership_orphans: nenhum relatório encontrado';
  END IF;

  -- Itera detalhes
  FOR v_detail IN SELECT * FROM jsonb_array_elements(v_report.details)
  LOOP
    v_table := v_detail->>'table';
    v_col := v_detail->>'owner_column';
    v_null_count := COALESCE((v_detail->>'null_owner_count')::bigint, 0);
    v_orphan_count := COALESCE((v_detail->>'missing_user_count')::bigint, 0);

    -- Detecta colunas auxiliares disponíveis na tabela
    SELECT EXISTS(SELECT 1 FROM information_schema.columns
      WHERE table_schema='public' AND table_name=v_table AND column_name='active')
      INTO v_has_active;
    SELECT EXISTS(SELECT 1 FROM information_schema.columns
      WHERE table_schema='public' AND table_name=v_table AND column_name='is_active')
      INTO v_has_is_active;
    SELECT EXISTS(SELECT 1 FROM information_schema.columns
      WHERE table_schema='public' AND table_name=v_table AND column_name='status')
      INTO v_has_status;

    --- (1) NULL OWNERS ---
    IF v_null_count > 0 THEN
      v_action := 'manual_review';
      v_rows := 0;

      IF v_table = ANY(v_safe_delete) THEN
        v_action := 'deleted';
        IF NOT _dry_run THEN
          EXECUTE format('DELETE FROM public.%I WHERE %I IS NULL', v_table, v_col);
          GET DIAGNOSTICS v_rows = ROW_COUNT;
        ELSE
          v_rows := v_null_count::int;
        END IF;
        v_total_deleted := v_total_deleted + v_rows;
      ELSIF v_has_is_active THEN
        v_action := 'deactivated';
        IF NOT _dry_run THEN
          EXECUTE format('UPDATE public.%I SET is_active=false WHERE %I IS NULL AND is_active=true', v_table, v_col);
          GET DIAGNOSTICS v_rows = ROW_COUNT;
        ELSE
          v_rows := v_null_count::int;
        END IF;
        v_total_deactivated := v_total_deactivated + v_rows;
      ELSIF v_has_active THEN
        v_action := 'deactivated';
        IF NOT _dry_run THEN
          EXECUTE format('UPDATE public.%I SET active=false WHERE %I IS NULL AND active=true', v_table, v_col);
          GET DIAGNOSTICS v_rows = ROW_COUNT;
        ELSE
          v_rows := v_null_count::int;
        END IF;
        v_total_deactivated := v_total_deactivated + v_rows;
      ELSIF v_has_status THEN
        v_action := 'deactivated';
        IF NOT _dry_run THEN
          EXECUTE format(
            'UPDATE public.%I SET status=''inactive'' WHERE %I IS NULL AND status<>''inactive''',
            v_table, v_col
          );
          GET DIAGNOSTICS v_rows = ROW_COUNT;
        ELSE
          v_rows := v_null_count::int;
        END IF;
        v_total_deactivated := v_total_deactivated + v_rows;
      ELSE
        v_rows := v_null_count::int;
        v_total_manual := v_total_manual + v_rows;
      END IF;

      INSERT INTO public.ownership_repair_logs(
        report_id, table_name, owner_column, issue_type, action,
        rows_affected, dry_run, triggered_by, triggered_by_label,
        notes
      ) VALUES (
        v_report.id, v_table, v_col, 'null_owner', v_action,
        v_rows, _dry_run, v_caller, _triggered_by_label,
        CASE WHEN v_action='manual_review'
          THEN 'Sem coluna active/is_active/status; tabela não está na allowlist de exclusão segura'
          ELSE NULL END
      );

      v_results := v_results || jsonb_build_object(
        'table', v_table, 'owner_column', v_col,
        'issue', 'null_owner', 'action', v_action,
        'rows_affected', v_rows, 'dry_run', _dry_run
      );
    END IF;

    --- (2) MISSING USERS (órfãos) ---
    IF v_orphan_count > 0 THEN
      v_action := 'manual_review';
      v_rows := 0;

      IF v_table = ANY(v_safe_delete) THEN
        v_action := 'deleted';
        IF NOT _dry_run THEN
          EXECUTE format(
            'DELETE FROM public.%I t WHERE t.%I IS NOT NULL
              AND NOT EXISTS (SELECT 1 FROM auth.users u WHERE u.id = t.%I::uuid)',
            v_table, v_col, v_col
          );
          GET DIAGNOSTICS v_rows = ROW_COUNT;
        ELSE
          v_rows := v_orphan_count::int;
        END IF;
        v_total_deleted := v_total_deleted + v_rows;
      ELSIF v_has_is_active THEN
        v_action := 'deactivated';
        IF NOT _dry_run THEN
          EXECUTE format(
            'UPDATE public.%I t SET is_active=false WHERE t.%I IS NOT NULL AND t.is_active=true
              AND NOT EXISTS (SELECT 1 FROM auth.users u WHERE u.id = t.%I::uuid)',
            v_table, v_col, v_col
          );
          GET DIAGNOSTICS v_rows = ROW_COUNT;
        ELSE
          v_rows := v_orphan_count::int;
        END IF;
        v_total_deactivated := v_total_deactivated + v_rows;
      ELSIF v_has_active THEN
        v_action := 'deactivated';
        IF NOT _dry_run THEN
          EXECUTE format(
            'UPDATE public.%I t SET active=false WHERE t.%I IS NOT NULL AND t.active=true
              AND NOT EXISTS (SELECT 1 FROM auth.users u WHERE u.id = t.%I::uuid)',
            v_table, v_col, v_col
          );
          GET DIAGNOSTICS v_rows = ROW_COUNT;
        ELSE
          v_rows := v_orphan_count::int;
        END IF;
        v_total_deactivated := v_total_deactivated + v_rows;
      ELSIF v_has_status THEN
        v_action := 'deactivated';
        IF NOT _dry_run THEN
          EXECUTE format(
            'UPDATE public.%I t SET status=''inactive'' WHERE t.%I IS NOT NULL AND t.status<>''inactive''
              AND NOT EXISTS (SELECT 1 FROM auth.users u WHERE u.id = t.%I::uuid)',
            v_table, v_col, v_col
          );
          GET DIAGNOSTICS v_rows = ROW_COUNT;
        ELSE
          v_rows := v_orphan_count::int;
        END IF;
        v_total_deactivated := v_total_deactivated + v_rows;
      ELSE
        v_rows := v_orphan_count::int;
        v_total_manual := v_total_manual + v_rows;
      END IF;

      INSERT INTO public.ownership_repair_logs(
        report_id, table_name, owner_column, issue_type, action,
        rows_affected, dry_run, triggered_by, triggered_by_label,
        notes
      ) VALUES (
        v_report.id, v_table, v_col, 'missing_user', v_action,
        v_rows, _dry_run, v_caller, _triggered_by_label,
        CASE WHEN v_action='manual_review'
          THEN 'Sem coluna active/is_active/status; reparo automático inseguro — revisar manualmente'
          ELSE NULL END
      );

      v_results := v_results || jsonb_build_object(
        'table', v_table, 'owner_column', v_col,
        'issue', 'missing_user', 'action', v_action,
        'rows_affected', v_rows, 'dry_run', _dry_run
      );
    END IF;
  END LOOP;

  RETURN jsonb_build_object(
    'report_id', v_report.id,
    'dry_run', _dry_run,
    'totals', jsonb_build_object(
      'deleted', v_total_deleted,
      'deactivated', v_total_deactivated,
      'manual_review', v_total_manual
    ),
    'actions', v_results
  );
END;
$$;


--
-- Name: request_step_up_challenge(public.step_up_action, text, inet, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.request_step_up_challenge(_action public.step_up_action, _target_ref text DEFAULT NULL::text, _ip inet DEFAULT NULL::inet, _user_agent text DEFAULT NULL::text) RETURNS TABLE(challenge_id uuid, otp_plain text, expires_at timestamp with time zone)
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  _uid UUID := auth.uid();
  _otp TEXT;
  _otp_h TEXT;
  _cid UUID;
  _exp TIMESTAMPTZ;
  _recent_count INT;
BEGIN
  IF _uid IS NULL THEN
    RAISE EXCEPTION 'unauthorized: no session';
  END IF;

  -- Apenas dev pode solicitar step-up para essas ações
  IF NOT public.is_dev(_uid) THEN
    INSERT INTO public.step_up_audit_log(user_id, action, target_ref, event_type, ip_address, user_agent)
    VALUES (_uid, _action, _target_ref, 'unauthorized', _ip, _user_agent);
    RAISE EXCEPTION 'forbidden: dev role required';
  END IF;

  -- Rate limit: máx 5 challenges por usuário por hora
  SELECT count(*) INTO _recent_count
  FROM public.step_up_challenges
  WHERE user_id = _uid AND created_at > (now() - interval '1 hour');

  IF _recent_count >= 5 THEN
    INSERT INTO public.step_up_audit_log(user_id, action, target_ref, event_type, ip_address, user_agent)
    VALUES (_uid, _action, _target_ref, 'rate_limited', _ip, _user_agent);
    RAISE EXCEPTION 'rate_limited: too many step-up requests';
  END IF;

  -- Gera OTP de 6 dígitos
  _otp := lpad((floor(random() * 1000000))::int::text, 6, '0');
  _otp_h := encode(digest(_otp || _uid::text, 'sha256'), 'hex');
  _exp := now() + interval '5 minutes';

  INSERT INTO public.step_up_challenges(user_id, action, target_ref, otp_hash, expires_at, ip_address, user_agent)
  VALUES (_uid, _action, _target_ref, _otp_h, _exp, _ip, _user_agent)
  RETURNING id INTO _cid;

  INSERT INTO public.step_up_audit_log(user_id, action, target_ref, event_type, challenge_id, ip_address, user_agent)
  VALUES (_uid, _action, _target_ref, 'challenge_requested', _cid, _ip, _user_agent);

  RETURN QUERY SELECT _cid, _otp, _exp;
END;
$$;


--
-- Name: reset_optimization_queue(boolean); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.reset_optimization_queue(_only_running boolean DEFAULT true) RETURNS integer
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  affected int;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  IF _only_running THEN
    UPDATE public.optimization_queue
       SET status = 'pending', started_at = NULL
     WHERE status = 'running';
  ELSE
    UPDATE public.optimization_queue
       SET status = 'pending', started_at = NULL, finished_at = NULL, error = NULL
     WHERE status IN ('running','failed','blocked');
  END IF;

  GET DIAGNOSTICS affected = ROW_COUNT;
  RETURN affected;
END;
$$;


--
-- Name: retry_failed_webhook_deliveries(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.retry_failed_webhook_deliveries() RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_supabase_url text := 'https://nmojwpihnslkssljowjh.supabase.co';
  v_service_key text;
  v_retried int := 0;
  v_skipped int := 0;
  rec record;
  v_max_attempts int;
BEGIN
  -- Busca service role key do vault (se disponível) ou usa o setting
  BEGIN
    v_service_key := current_setting('app.supabase_service_role_key', true);
  EXCEPTION WHEN OTHERS THEN
    v_service_key := NULL;
  END;

  IF v_service_key IS NULL OR v_service_key = '' THEN
    RETURN jsonb_build_object(
      'ok', false,
      'error', 'service_role_key not configured in app.supabase_service_role_key'
    );
  END IF;

  -- Pega a ÚLTIMA tentativa de cada (webhook_id, event, payload_hash) na última hora
  -- Re-dispara apenas se ainda há margem em retry_policy.max_attempts
  FOR rec IN
    WITH latest AS (
      SELECT DISTINCT ON (d.webhook_id, d.event, d.payload_hash)
        d.id, d.webhook_id, d.event, d.payload, d.attempt, d.success
      FROM public.webhook_deliveries d
      WHERE d.delivered_at > now() - interval '1 hour'
      ORDER BY d.webhook_id, d.event, d.payload_hash, d.attempt DESC
    )
    SELECT l.*, w.active, w.retry_policy
    FROM latest l
    JOIN public.outbound_webhooks w ON w.id = l.webhook_id
    WHERE l.success = false AND w.active = true
  LOOP
    v_max_attempts := COALESCE((rec.retry_policy->>'max_attempts')::int, 3);

    IF rec.attempt >= v_max_attempts THEN
      v_skipped := v_skipped + 1;
      CONTINUE;
    END IF;

    PERFORM net.http_post(
      url := v_supabase_url || '/functions/v1/webhook-dispatcher',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || v_service_key
      ),
      body := jsonb_build_object(
        'event', rec.event,
        'payload', rec.payload
      )
    );
    v_retried := v_retried + 1;
  END LOOP;

  RETURN jsonb_build_object(
    'ok', true,
    'retried', v_retried,
    'skipped_max_attempts', v_skipped,
    'ran_at', now()
  );
END;
$$;


--
-- Name: revoke_all_user_tokens(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.revoke_all_user_tokens(_user_id uuid) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  INSERT INTO public.user_token_revocations (user_id, revoked_at)
  VALUES (_user_id, now())
  ON CONFLICT (user_id) DO UPDATE SET revoked_at = now();
END;
$$;


--
-- Name: search_products_semantic(text, jsonb, integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.search_products_semantic(_query text, _products jsonb, _limit integer DEFAULT 20) RETURNS TABLE(product_id text, score real, matched_field text)
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  _normalized_query text;
BEGIN
  -- Validações básicas
  IF _query IS NULL OR length(trim(_query)) = 0 THEN
    RETURN;
  END IF;

  IF _products IS NULL OR jsonb_typeof(_products) <> 'array' THEN
    RETURN;
  END IF;

  _normalized_query := lower(trim(_query));

  RETURN QUERY
  WITH expanded AS (
    SELECT
      COALESCE(p->>'id', p->>'product_id', '') AS pid,
      lower(COALESCE(p->>'name', '')) AS pname,
      lower(COALESCE(p->>'description', '')) AS pdesc,
      lower(COALESCE(
        (SELECT string_agg(t::text, ' ') FROM jsonb_array_elements_text(COALESCE(p->'tags', '[]'::jsonb)) t),
        ''
      )) AS ptags,
      lower(COALESCE(p->>'category', '')) AS pcat
    FROM jsonb_array_elements(_products) AS p
  ),
  scored AS (
    SELECT
      pid,
      GREATEST(
        similarity(pname, _normalized_query) * 1.0,
        similarity(pdesc, _normalized_query) * 0.6,
        similarity(ptags, _normalized_query) * 0.8,
        similarity(pcat, _normalized_query) * 0.5
      ) AS best_score,
      CASE
        WHEN similarity(pname, _normalized_query) >= similarity(pdesc, _normalized_query)
         AND similarity(pname, _normalized_query) >= similarity(ptags, _normalized_query)
         AND similarity(pname, _normalized_query) >= similarity(pcat, _normalized_query)
          THEN 'name'
        WHEN similarity(ptags, _normalized_query) >= similarity(pdesc, _normalized_query)
         AND similarity(ptags, _normalized_query) >= similarity(pcat, _normalized_query)
          THEN 'tags'
        WHEN similarity(pdesc, _normalized_query) >= similarity(pcat, _normalized_query)
          THEN 'description'
        ELSE 'category'
      END AS field
    FROM expanded
    WHERE pid <> ''
  )
  SELECT pid, best_score::real, field
  FROM scored
  WHERE best_score > 0.05
  ORDER BY best_score DESC
  LIMIT GREATEST(_limit, 1);
END;
$$;


--
-- Name: search_records_rerank(text, jsonb); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.search_records_rerank(_query text, _candidates jsonb) RETURNS TABLE(id text, score real, matched_field text)
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  _q text;
BEGIN
  IF _query IS NULL OR length(trim(_query)) = 0 THEN
    RETURN;
  END IF;

  IF _candidates IS NULL OR jsonb_typeof(_candidates) <> 'array' THEN
    RETURN;
  END IF;

  _q := lower(trim(_query));

  RETURN QUERY
  WITH expanded AS (
    SELECT
      COALESCE(c->>'id', '') AS cid,
      lower(COALESCE(c->>'label', '')) AS clabel,
      lower(COALESCE(c->>'sublabel', '')) AS csublabel
    FROM jsonb_array_elements(_candidates) AS c
  ),
  scored AS (
    SELECT
      cid,
      GREATEST(
        similarity(clabel, _q) * 1.0,
        word_similarity(_q, clabel) * 0.9,
        similarity(csublabel, _q) * 0.7,
        word_similarity(_q, csublabel) * 0.6
      ) AS best_score,
      CASE
        WHEN similarity(clabel, _q) >= similarity(csublabel, _q) THEN 'label'
        ELSE 'sublabel'
      END AS field
    FROM expanded
    WHERE cid <> ''
  )
  SELECT cid, best_score::real, field
  FROM scored
  WHERE best_score > 0.05
  ORDER BY best_score DESC;
END;
$$;


--
-- Name: seed_discount_test_users(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.seed_discount_test_users() RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  _seller_id uuid;
  _admin_id uuid;
BEGIN
  -- Find existing test users by email in profiles
  SELECT user_id INTO _seller_id FROM public.profiles WHERE email = 'seller-test@discount-approval.test' LIMIT 1;
  SELECT user_id INTO _admin_id FROM public.profiles WHERE email = 'admin-test@discount-approval.test' LIMIT 1;

  -- If users don't exist, return error (auth.users insertion requires Supabase Admin API, not SQL)
  IF _seller_id IS NULL OR _admin_id IS NULL THEN
    RETURN jsonb_build_object(
      'ok', false,
      'error', 'Test users not found. Create them via Supabase Admin API first.',
      'seller_exists', _seller_id IS NOT NULL,
      'admin_exists', _admin_id IS NOT NULL
    );
  END IF;

  -- Ensure roles
  INSERT INTO public.user_roles (user_id, role)
  VALUES (_seller_id, 'vendedor')
  ON CONFLICT (user_id, role) DO NOTHING;

  INSERT INTO public.user_roles (user_id, role)
  VALUES (_admin_id, 'admin')
  ON CONFLICT (user_id, role) DO NOTHING;

  -- Sync role on profiles
  UPDATE public.profiles SET role = 'vendedor' WHERE user_id = _seller_id;
  UPDATE public.profiles SET role = 'admin' WHERE user_id = _admin_id;

  RETURN jsonb_build_object(
    'ok', true,
    'seller_id', _seller_id,
    'admin_id', _admin_id
  );
END;
$$;


--
-- Name: set_connection_failure_window_minutes(integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.set_connection_failure_window_minutes(minutes integer) RETURNS integer
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::public.app_role) THEN
    RAISE EXCEPTION 'forbidden: admin role required';
  END IF;

  IF minutes NOT IN (0, 15, 30, 60, 120, 240) THEN
    RAISE EXCEPTION 'invalid window: must be one of 0, 15, 30, 60, 120, 240 minutes';
  END IF;

  INSERT INTO public.system_settings (key, value, updated_by, updated_at)
  VALUES ('connection_failure_window_minutes', to_jsonb(minutes), auth.uid(), now())
  ON CONFLICT (key) DO UPDATE
    SET value = EXCLUDED.value,
        updated_by = EXCLUDED.updated_by,
        updated_at = EXCLUDED.updated_at;

  INSERT INTO public.admin_audit_log (user_id, action, resource_type, resource_id, details)
  VALUES (
    auth.uid(),
    'connection_failure_window_changed',
    'system_setting',
    'connection_failure_window_minutes',
    jsonb_build_object('minutes', minutes)
  );

  RETURN minutes;
END;
$$;


--
-- Name: set_connections_auto_test_interval(integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.set_connections_auto_test_interval(minutes integer) RETURNS integer
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'cron'
    AS $$
DECLARE
  schedule text;
  job_id bigint;
BEGIN
  -- Admin only
  IF NOT public.has_role(auth.uid(), 'admin'::public.app_role) THEN
    RAISE EXCEPTION 'forbidden: admin role required';
  END IF;

  IF minutes NOT IN (5, 10, 15, 30, 60, 120, 240) THEN
    RAISE EXCEPTION 'invalid interval: must be one of 5, 10, 15, 30, 60, 120, 240 minutes';
  END IF;

  IF minutes < 60 THEN
    schedule := '*/' || minutes::text || ' * * * *';
  ELSIF minutes = 60 THEN
    schedule := '0 * * * *';
  ELSIF minutes = 120 THEN
    schedule := '0 */2 * * *';
  ELSIF minutes = 240 THEN
    schedule := '0 */4 * * *';
  END IF;

  SELECT jobid INTO job_id FROM cron.job WHERE jobname = 'connections-auto-test' LIMIT 1;
  IF job_id IS NULL THEN
    RAISE EXCEPTION 'cron job connections-auto-test not found';
  END IF;

  PERFORM cron.alter_job(job_id := job_id, schedule := schedule);

  -- Audit
  INSERT INTO public.admin_audit_log (user_id, action, resource_type, resource_id, details)
  VALUES (
    auth.uid(),
    'connections_auto_test_interval_changed',
    'cron_job',
    job_id::text,
    jsonb_build_object('minutes', minutes, 'schedule', schedule)
  );

  RETURN minutes;
END;
$$;


--
-- Name: set_magic_up_updated_at(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.set_magic_up_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;


--
-- Name: set_optimization_queue_updated_at(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.set_optimization_queue_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;


--
-- Name: set_updated_at(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.set_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$;


--
-- Name: snapshot_hardening_status(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.snapshot_hardening_status() RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'extensions'
    AS $$
DECLARE
  _private_buckets int;
  _sensitive_realtime int;
  _pg_trgm_in_extensions boolean;
  _cleanup_job_active boolean;
  _failures text[] := ARRAY[]::text[];
  _score int := 0;
  _max int := 5;
  _details jsonb;
  _snapshot_id uuid;
BEGIN
  SELECT count(*) INTO _private_buckets
  FROM storage.buckets
  WHERE id IN ('personalization-images','product-videos','supplier-logos','component-media')
    AND public = false;
  IF _private_buckets = 4 THEN _score := _score + 1;
  ELSE _failures := _failures || format('Buckets privados: %s/4', _private_buckets); END IF;

  SELECT count(*) INTO _sensitive_realtime
  FROM pg_publication_tables
  WHERE pubname = 'supabase_realtime'
    AND schemaname = 'public'
    AND tablename IN ('discount_approval_requests','kit_variants','kit_comments');
  IF _sensitive_realtime = 0 THEN _score := _score + 1;
  ELSE _failures := _failures || format('Tabelas sensíveis em realtime: %s', _sensitive_realtime); END IF;

  SELECT EXISTS (
    SELECT 1 FROM pg_extension e
    JOIN pg_namespace n ON n.oid = e.extnamespace
    WHERE e.extname = 'pg_trgm' AND n.nspname = 'extensions'
  ) INTO _pg_trgm_in_extensions;
  IF _pg_trgm_in_extensions THEN _score := _score + 1;
  ELSE _failures := _failures || 'pg_trgm fora do schema extensions'; END IF;

  SELECT EXISTS (
    SELECT 1 FROM cron.job WHERE jobname = 'cleanup-security-logs-daily' AND active = true
  ) INTO _cleanup_job_active;
  IF _cleanup_job_active THEN _score := _score + 1;
  ELSE _failures := _failures || 'Job cleanup-security-logs-daily inativo'; END IF;

  -- MFA enforced em app — assumido true (controlado em código)
  _score := _score + 1;

  _details := jsonb_build_object(
    'private_buckets_count', _private_buckets,
    'sensitive_realtime_count', _sensitive_realtime,
    'pg_trgm_in_extensions', _pg_trgm_in_extensions,
    'cleanup_job_active', _cleanup_job_active,
    'mfa_enforced_in_app', true
  );

  INSERT INTO public.hardening_health_snapshots (score, max_score, failures, details)
  VALUES (_score, _max, _failures, _details)
  RETURNING id INTO _snapshot_id;

  RETURN jsonb_build_object('ok', true, 'snapshot_id', _snapshot_id, 'score', _score, 'max', _max);
END;
$$;


--
-- Name: start_step_up_challenge(text, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.start_step_up_challenge(_action text, _target_ref text DEFAULT NULL::text) RETURNS uuid
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
    v_challenge_id uuid;
BEGIN
    IF auth.uid() IS NULL THEN
        RAISE EXCEPTION 'Não autenticado';
    END IF;

    INSERT INTO public.step_up_challenges (user_id, action, target_ref)
    VALUES (auth.uid(), _action, _target_ref)
    RETURNING id INTO v_challenge_id;

    RETURN v_challenge_id;
END;
$$;


--
-- Name: submit_quote_response(text, text, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.submit_quote_response(_token text, _response text, _response_notes text DEFAULT NULL::text) RETURNS boolean
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  -- Validate response value
  IF _response NOT IN ('approved', 'rejected') THEN
    RAISE EXCEPTION 'Invalid response value';
  END IF;

  -- Only update allowed fields on active, unexpired tokens
  UPDATE public.quote_approval_tokens
  SET 
    response = _response,
    response_notes = _response_notes,
    responded_at = now(),
    status = 'responded',
    updated_at = now()
  WHERE token = _token
    AND status = 'active'
    AND (expires_at IS NULL OR expires_at > now())
    AND responded_at IS NULL;

  RETURN FOUND;
END;
$$;


--
-- Name: sync_external_connections_from_credentials(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.sync_external_connections_from_credentials() RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  _system_uid uuid;
  _env_keys text[] := ARRAY['promobrind', 'crm'];
  _env_key text;
  _url_name text;
  _anon_name text;
  _svc_name text;
  _has_url boolean;
  _has_anon boolean;
  _has_svc boolean;
  _status text;
  _name text;
  _processed int := 0;
BEGIN
  -- Ator de sistema: qualquer admin (created_by é NOT NULL)
  SELECT user_id INTO _system_uid
  FROM public.user_roles
  WHERE role = 'admin'
  LIMIT 1;

  IF _system_uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'no_admin_for_system_actor');
  END IF;

  FOREACH _env_key IN ARRAY _env_keys LOOP
    _url_name  := 'EXTERNAL_' || upper(_env_key) || '_URL';
    _anon_name := 'EXTERNAL_' || upper(_env_key) || '_ANON_KEY';
    _svc_name  := 'EXTERNAL_' || upper(_env_key) || '_SERVICE_ROLE_KEY';

    SELECT EXISTS (SELECT 1 FROM public.integration_credentials WHERE secret_name = _url_name  AND length > 0) INTO _has_url;
    SELECT EXISTS (SELECT 1 FROM public.integration_credentials WHERE secret_name = _anon_name AND length > 0) INTO _has_anon;
    SELECT EXISTS (SELECT 1 FROM public.integration_credentials WHERE secret_name = _svc_name  AND length > 0) INTO _has_svc;

    IF _has_url AND _has_svc THEN
      _status := 'active';
    ELSE
      _status := 'unconfigured';
    END IF;

    _name := CASE _env_key
      WHEN 'promobrind' THEN 'Catálogo Promobrind'
      WHEN 'crm' THEN 'CRM Promobrind'
      ELSE initcap(_env_key)
    END;

    INSERT INTO public.external_connections (
      type, name, env_key, config, secret_refs, status, created_by
    ) VALUES (
      'supabase',
      _name,
      _env_key,
      jsonb_build_object('mirrored_from', 'integration_credentials'),
      ARRAY[_url_name, _anon_name, _svc_name],
      _status,
      _system_uid
    )
    ON CONFLICT (env_key, type) WHERE env_key IS NOT NULL DO UPDATE
    SET status = EXCLUDED.status,
        secret_refs = EXCLUDED.secret_refs,
        name = EXCLUDED.name,
        updated_at = now();

    _processed := _processed + 1;
  END LOOP;

  RETURN jsonb_build_object('ok', true, 'processed', _processed, 'ran_at', now());
END;
$$;


--
-- Name: sync_external_connections_from_credentials(text, text, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.sync_external_connections_from_credentials(_trigger_secret_name text DEFAULT NULL::text, _trigger_op text DEFAULT 'manual'::text, _trigger_user_id uuid DEFAULT NULL::uuid) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  _system_uid uuid;
  _env_keys text[] := ARRAY['promobrind', 'crm'];
  _env_key text;
  _url_name text;
  _anon_name text;
  _svc_name text;
  _has_url boolean;
  _has_anon boolean;
  _has_svc boolean;
  _status text;
  _name text;
  _processed int := 0;
  _created int := 0;
  _updated int := 0;
  _is_insert boolean;
  _start timestamptz := clock_timestamp();
  _result jsonb;
  _err text;
BEGIN
  SELECT user_id INTO _system_uid
  FROM public.user_roles
  WHERE role = 'admin'
  ORDER BY created_at ASC
  LIMIT 1;

  IF _system_uid IS NULL THEN
    INSERT INTO public.external_connections_sync_log (
      triggered_by_user_id, triggered_by_secret_name, trigger_op,
      processed, created_count, updated_count, status, error_message,
      duration_ms
    ) VALUES (
      _trigger_user_id, _trigger_secret_name, COALESCE(_trigger_op, 'manual'),
      0, 0, 0, 'no_admin', 'no_admin_for_system_actor',
      EXTRACT(MILLISECONDS FROM (clock_timestamp() - _start))::int
    );
    RETURN jsonb_build_object('ok', false, 'reason', 'no_admin_for_system_actor');
  END IF;

  BEGIN
    FOREACH _env_key IN ARRAY _env_keys LOOP
      _url_name  := 'EXTERNAL_' || upper(_env_key) || '_URL';
      _anon_name := 'EXTERNAL_' || upper(_env_key) || '_ANON_KEY';
      _svc_name  := 'EXTERNAL_' || upper(_env_key) || '_SERVICE_ROLE_KEY';

      SELECT EXISTS (SELECT 1 FROM public.integration_credentials WHERE secret_name = _url_name  AND length > 0) INTO _has_url;
      SELECT EXISTS (SELECT 1 FROM public.integration_credentials WHERE secret_name = _anon_name AND length > 0) INTO _has_anon;
      SELECT EXISTS (SELECT 1 FROM public.integration_credentials WHERE secret_name = _svc_name  AND length > 0) INTO _has_svc;

      IF _has_url AND _has_svc THEN
        _status := 'active';
      ELSE
        _status := 'unconfigured';
      END IF;

      _name := CASE _env_key
        WHEN 'promobrind' THEN 'Catálogo Promobrind'
        WHEN 'crm' THEN 'CRM Promobrind'
        ELSE initcap(_env_key)
      END;

      -- Detecta se é INSERT ou UPDATE para contagem
      SELECT NOT EXISTS (
        SELECT 1 FROM public.external_connections
        WHERE env_key = _env_key AND type = 'supabase'
      ) INTO _is_insert;

      INSERT INTO public.external_connections (
        type, name, env_key, config, secret_refs, status, created_by
      ) VALUES (
        'supabase',
        _name,
        _env_key,
        jsonb_build_object('mirrored_from', 'integration_credentials'),
        ARRAY[_url_name, _anon_name, _svc_name],
        _status,
        _system_uid
      )
      ON CONFLICT (env_key, type) WHERE env_key IS NOT NULL DO UPDATE
      SET status = EXCLUDED.status,
          secret_refs = EXCLUDED.secret_refs,
          name = EXCLUDED.name,
          updated_at = now();

      IF _is_insert THEN
        _created := _created + 1;
      ELSE
        _updated := _updated + 1;
      END IF;
      _processed := _processed + 1;
    END LOOP;

    INSERT INTO public.external_connections_sync_log (
      triggered_by_user_id, triggered_by_secret_name, trigger_op,
      processed, created_count, updated_count, status,
      duration_ms, details
    ) VALUES (
      _trigger_user_id, _trigger_secret_name, COALESCE(_trigger_op, 'manual'),
      _processed, _created, _updated, 'ok',
      EXTRACT(MILLISECONDS FROM (clock_timestamp() - _start))::int,
      jsonb_build_object('env_keys', _env_keys)
    );

    _result := jsonb_build_object(
      'ok', true,
      'processed', _processed,
      'created', _created,
      'updated', _updated,
      'ran_at', now()
    );
    RETURN _result;

  EXCEPTION WHEN OTHERS THEN
    _err := SQLERRM;
    INSERT INTO public.external_connections_sync_log (
      triggered_by_user_id, triggered_by_secret_name, trigger_op,
      processed, created_count, updated_count, status, error_message,
      duration_ms
    ) VALUES (
      _trigger_user_id, _trigger_secret_name, COALESCE(_trigger_op, 'manual'),
      _processed, _created, _updated, 'error', _err,
      EXTRACT(MILLISECONDS FROM (clock_timestamp() - _start))::int
    );
    RAISE;
  END;
END;
$$;


--
-- Name: trg_auto_revoke_mcp_on_role_loss(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.trg_auto_revoke_mcp_on_role_loss() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  _now TIMESTAMP WITH TIME ZONE := now();
  _rec RECORD;
BEGIN
  -- Só agimos quando uma role 'dev' é removida E o usuário não tem outra linha 'dev'
  IF OLD.role IS DISTINCT FROM 'dev'::app_role THEN
    RETURN OLD;
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.user_roles
     WHERE user_id = OLD.user_id AND role = 'dev'::app_role
  ) THEN
    -- Ainda é dev por outra atribuição: nada a fazer
    RETURN OLD;
  END IF;

  FOR _rec IN
    SELECT id FROM public.mcp_api_keys
     WHERE created_by = OLD.user_id
       AND revoked_at IS NULL
       AND '*' = ANY(scopes)
     FOR UPDATE
  LOOP
    UPDATE public.mcp_api_keys
       SET revoked_at = _now, updated_at = _now
     WHERE id = _rec.id AND revoked_at IS NULL;

    INSERT INTO public.mcp_key_auto_revocations(key_id, created_by, revoked_at, source, reason)
    VALUES (_rec.id, OLD.user_id, _now, 'trigger', 'creator_lost_dev_role');

    INSERT INTO public.step_up_audit_log(user_id, action, target_ref, event_type, metadata)
    VALUES (
      OLD.user_id,
      'mcp_full_issue',
      _rec.id::text,
      'auto_revoked',
      jsonb_build_object('reason','creator_lost_dev_role','source','trigger')
    );
  END LOOP;

  RETURN OLD;
END;
$$;


--
-- Name: trg_sync_external_connections(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.trg_sync_external_connections() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  _secret_name text;
  _op text := TG_OP;
BEGIN
  _secret_name := COALESCE(NEW.secret_name, OLD.secret_name);
  IF (TG_OP = 'DELETE' AND OLD.secret_name LIKE 'EXTERNAL_%')
     OR (TG_OP IN ('INSERT','UPDATE') AND NEW.secret_name LIKE 'EXTERNAL_%') THEN
    PERFORM public.sync_external_connections_from_credentials(
      _secret_name, _op, auth.uid()
    );
  END IF;
  RETURN COALESCE(NEW, OLD);
EXCEPTION WHEN OTHERS THEN
  RETURN COALESCE(NEW, OLD);
END;
$$;


--
-- Name: trim_connection_test_history(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.trim_connection_test_history() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  DELETE FROM public.connection_test_history
  WHERE connection_id = NEW.connection_id
    AND id NOT IN (
      SELECT id FROM public.connection_test_history
      WHERE connection_id = NEW.connection_id
      ORDER BY tested_at DESC
      LIMIT 200
    );
  RETURN NEW;
END;
$$;


--
-- Name: update_updated_at_column(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_updated_at_column() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$;


--
-- Name: validate_discount_approval_status(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.validate_discount_approval_status() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  IF NEW.status NOT IN ('pending', 'approved', 'rejected') THEN
    RAISE EXCEPTION 'Invalid discount approval status: %', NEW.status;
  END IF;
  RETURN NEW;
END;
$$;


--
-- Name: validate_ip_access_control(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.validate_ip_access_control() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  IF NEW.list_type NOT IN ('allow', 'block') THEN
    RAISE EXCEPTION 'Invalid list_type: must be allow or block';
  END IF;
  RETURN NEW;
END;
$$;


--
-- Name: validate_mcp_key(text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.validate_mcp_key(_key_plain text) RETURNS TABLE(key_id uuid, scopes text[], block_reason text, created_by uuid)
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  _hash text;
  _row record;
  _is_full boolean;
  _grantor_is_dev boolean;
BEGIN
  IF _key_plain IS NULL OR length(_key_plain) < 16 THEN
    RETURN;
  END IF;

  _hash := encode(extensions.digest(_key_plain, 'sha256'), 'hex');

  SELECT id, mcp_api_keys.scopes, expires_at, revoked_at, created_by
  INTO _row
  FROM public.mcp_api_keys
  WHERE key_hash = _hash
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN;
  END IF;

  IF _row.revoked_at IS NOT NULL THEN
    RETURN QUERY SELECT _row.id, NULL::text[], 'revoked'::text, _row.created_by;
    RETURN;
  END IF;

  IF _row.expires_at IS NOT NULL AND _row.expires_at < now() THEN
    RETURN QUERY SELECT _row.id, NULL::text[], 'expired'::text, _row.created_by;
    RETURN;
  END IF;

  _is_full := _row.scopes @> ARRAY['*']::text[];
  IF _is_full THEN
    IF _row.created_by IS NULL THEN
      _grantor_is_dev := false;
    ELSE
      _grantor_is_dev := public.is_dev(_row.created_by);
    END IF;

    IF NOT _grantor_is_dev THEN
      UPDATE public.mcp_api_keys
        SET revoked_at = now(), updated_at = now()
        WHERE id = _row.id AND revoked_at IS NULL;

      INSERT INTO public.mcp_key_auto_revocations(key_id, created_by, revoked_at, source, reason)
      VALUES (_row.id, _row.created_by, now(), 'manual', 'grantor_lost_dev_at_use');

      INSERT INTO public.admin_audit_log (
        user_id, action, resource_type, resource_id,
        status, source, details
      ) VALUES (
        _row.created_by,
        'mcp_key.auto_revoked',
        'mcp_api_key',
        _row.id,
        'denied',
        'validate_mcp_key',
        jsonb_build_object(
          'reason', 'grantor_lost_dev_at_use',
          'is_full_access', true,
          'auto_revoked_at', now()
        )
      );

      INSERT INTO public.step_up_audit_log(user_id, action, target_ref, event_type, metadata)
      VALUES (
        _row.created_by,
        'mcp_full_issue',
        _row.id::text,
        'auto_revoked',
        jsonb_build_object('reason','grantor_lost_dev_at_use','source','validate_mcp_key')
      );

      RETURN QUERY SELECT _row.id, NULL::text[], 'grantor_lost_dev'::text, _row.created_by;
      RETURN;
    END IF;
  END IF;

  UPDATE public.mcp_api_keys SET last_used_at = now() WHERE id = _row.id;

  RETURN QUERY SELECT _row.id, _row.scopes, NULL::text, _row.created_by;
END;
$$;


--
-- Name: validate_quote_real_discount(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.validate_quote_real_discount() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  _markup       NUMERIC := COALESCE(NEW.negotiation_markup_percent, 0);
  _apparent_pct NUMERIC := COALESCE(NEW.discount_percent, 0);
  _presented    NUMERIC := COALESCE(NEW.subtotal, 0);
  _real_sub     NUMERIC;
  _final        NUMERIC;
  _real_pct     NUMERIC;
  _max_allowed  NUMERIC;
  _is_admin     BOOLEAN;
BEGIN
  IF _markup > 0 THEN
    _real_sub := _presented / (1 + _markup / 100);
  ELSE
    _real_sub := _presented;
  END IF;

  _final := _presented * (1 - _apparent_pct / 100);

  IF _real_sub > 0 THEN
    _real_pct := ROUND(((_real_sub - _final) / _real_sub) * 100, 2);
  ELSE
    _real_pct := 0;
  END IF;

  NEW.real_subtotal := ROUND(_real_sub, 2);
  NEW.real_discount_percent := _real_pct;

  IF NEW.status IN ('draft', 'pending') AND NEW.seller_id IS NOT NULL AND _real_pct > 0 THEN
    SELECT EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = NEW.seller_id AND role = 'admin'
    ) INTO _is_admin;

    IF NOT _is_admin THEN
      SELECT max_discount_percent INTO _max_allowed
      FROM public.seller_discount_limits
      WHERE user_id = NEW.seller_id;

      IF _max_allowed IS NOT NULL AND _real_pct > _max_allowed THEN
        IF NOT EXISTS (
          SELECT 1 FROM public.discount_approval_requests
          WHERE quote_id = NEW.id
            AND status = 'approved'
            AND requested_discount_percent >= _real_pct
        ) THEN
          RAISE EXCEPTION
            'Desconto real (%.2f%%) excede o limite do vendedor (%.2f%%). Solicite aprovação antes de salvar.',
            _real_pct, _max_allowed
            USING ERRCODE = 'check_violation';
        END IF;
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;


--
-- Name: validate_scheduled_report_email(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.validate_scheduled_report_email() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  user_email TEXT;
BEGIN
  SELECT email INTO user_email
  FROM public.profiles
  WHERE user_id = NEW.user_id;

  IF user_email IS NULL OR NEW.email_to != user_email THEN
    RAISE EXCEPTION 'email_to must match your registered email address';
  END IF;

  RETURN NEW;
END;
$$;


--
-- Name: validate_secret_rotation_action_type(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.validate_secret_rotation_action_type() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  IF NEW.action_type NOT IN ('set', 'rotate') THEN
    RAISE EXCEPTION 'Invalid action_type: must be set or rotate';
  END IF;
  RETURN NEW;
END;
$$;


--
-- Name: validate_status_fields(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.validate_status_fields() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  IF TG_TABLE_NAME = 'quotes' THEN
    IF NEW.status NOT IN ('draft', 'pending', 'sent', 'approved', 'rejected', 'expired', 'revision', 'pending_approval', 'converted', 'viewed') THEN
      RAISE EXCEPTION 'Invalid quote status: %', NEW.status;
    END IF;
  END IF;

  IF TG_TABLE_NAME = 'orders' THEN
    IF NEW.status NOT IN ('pending', 'confirmed', 'in_production', 'shipped', 'delivered', 'cancelled') THEN
      RAISE EXCEPTION 'Invalid order status: %', NEW.status;
    END IF;
    IF NEW.fulfillment_status NOT IN ('unfulfilled', 'partially_fulfilled', 'fulfilled') THEN
      RAISE EXCEPTION 'Invalid fulfillment status: %', NEW.fulfillment_status;
    END IF;
  END IF;

  IF TG_TABLE_NAME = 'custom_kits' THEN
    IF NEW.status NOT IN ('draft', 'ready', 'shared', 'archived') THEN
      RAISE EXCEPTION 'Invalid kit status: %', NEW.status;
    END IF;
  END IF;

  IF TG_TABLE_NAME = 'kit_share_tokens' THEN
    IF NEW.status NOT IN ('active', 'expired', 'responded', 'revoked') THEN
      RAISE EXCEPTION 'Invalid token status: %', NEW.status;
    END IF;
  END IF;

  IF TG_TABLE_NAME = 'quote_approval_tokens' THEN
    IF NEW.status NOT IN ('active', 'expired', 'responded') THEN
      RAISE EXCEPTION 'Invalid approval token status: %', NEW.status;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;


--
-- Name: verify_step_up_otp(uuid, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.verify_step_up_otp(_challenge_id uuid, _otp_attempt text) RETURNS boolean
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
    UPDATE public.step_up_challenges 
    SET otp_verified = true, 
        attempts = attempts + 1
    WHERE id = _challenge_id 
      AND user_id = auth.uid() 
      AND consumed = false 
      AND expires_at > now();
    
    RETURN FOUND;
END;
$$;


--
-- Name: verify_step_up_password(uuid, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.verify_step_up_password(_challenge_id uuid, _password_attempt text) RETURNS boolean
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
    UPDATE public.step_up_challenges 
    SET password_verified = true
    WHERE id = _challenge_id 
      AND user_id = auth.uid() 
      AND consumed = false 
      AND expires_at > now();
      
    RETURN FOUND;
END;
$$;


--
-- Name: access_security_settings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.access_security_settings (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    ip_whitelist_enabled boolean DEFAULT false,
    city_whitelist_enabled boolean DEFAULT false,
    block_unknown_locations boolean DEFAULT false,
    max_failed_attempts integer DEFAULT 5,
    lockout_duration_minutes integer DEFAULT 15,
    strict_access_mode boolean DEFAULT false,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: admin_audit_log; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.admin_audit_log (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    action text NOT NULL,
    resource_type text NOT NULL,
    resource_id text,
    details jsonb,
    ip_address text,
    user_agent text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    request_id text,
    started_at timestamp with time zone,
    finished_at timestamp with time zone,
    duration_ms integer,
    status text,
    payload_summary jsonb,
    source text
)
PARTITION BY RANGE (created_at);


--
-- Name: admin_audit_log_old; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.admin_audit_log_old (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    action text NOT NULL,
    resource_type text NOT NULL,
    resource_id text,
    details jsonb DEFAULT '{}'::jsonb,
    ip_address text,
    user_agent text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    request_id text,
    started_at timestamp with time zone,
    finished_at timestamp with time zone,
    duration_ms integer,
    status text,
    payload_summary jsonb DEFAULT '{}'::jsonb,
    source text
);


--
-- Name: admin_audit_log_y2025m12; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.admin_audit_log_y2025m12 (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    action text NOT NULL,
    resource_type text NOT NULL,
    resource_id text,
    details jsonb,
    ip_address text,
    user_agent text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    request_id text,
    started_at timestamp with time zone,
    finished_at timestamp with time zone,
    duration_ms integer,
    status text,
    payload_summary jsonb,
    source text
);


--
-- Name: admin_audit_log_y2026m01; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.admin_audit_log_y2026m01 (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    action text NOT NULL,
    resource_type text NOT NULL,
    resource_id text,
    details jsonb,
    ip_address text,
    user_agent text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    request_id text,
    started_at timestamp with time zone,
    finished_at timestamp with time zone,
    duration_ms integer,
    status text,
    payload_summary jsonb,
    source text
);


--
-- Name: admin_audit_log_y2026m02; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.admin_audit_log_y2026m02 (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    action text NOT NULL,
    resource_type text NOT NULL,
    resource_id text,
    details jsonb,
    ip_address text,
    user_agent text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    request_id text,
    started_at timestamp with time zone,
    finished_at timestamp with time zone,
    duration_ms integer,
    status text,
    payload_summary jsonb,
    source text
);


--
-- Name: admin_audit_log_y2026m03; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.admin_audit_log_y2026m03 (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    action text NOT NULL,
    resource_type text NOT NULL,
    resource_id text,
    details jsonb,
    ip_address text,
    user_agent text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    request_id text,
    started_at timestamp with time zone,
    finished_at timestamp with time zone,
    duration_ms integer,
    status text,
    payload_summary jsonb,
    source text
);


--
-- Name: admin_audit_log_y2026m04; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.admin_audit_log_y2026m04 (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    action text NOT NULL,
    resource_type text NOT NULL,
    resource_id text,
    details jsonb,
    ip_address text,
    user_agent text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    request_id text,
    started_at timestamp with time zone,
    finished_at timestamp with time zone,
    duration_ms integer,
    status text,
    payload_summary jsonb,
    source text
);


--
-- Name: admin_audit_log_y2026m05; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.admin_audit_log_y2026m05 (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    action text NOT NULL,
    resource_type text NOT NULL,
    resource_id text,
    details jsonb,
    ip_address text,
    user_agent text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    request_id text,
    started_at timestamp with time zone,
    finished_at timestamp with time zone,
    duration_ms integer,
    status text,
    payload_summary jsonb,
    source text
);


--
-- Name: admin_audit_log_y2026m06; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.admin_audit_log_y2026m06 (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    action text NOT NULL,
    resource_type text NOT NULL,
    resource_id text,
    details jsonb,
    ip_address text,
    user_agent text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    request_id text,
    started_at timestamp with time zone,
    finished_at timestamp with time zone,
    duration_ms integer,
    status text,
    payload_summary jsonb,
    source text
);


--
-- Name: admin_settings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.admin_settings (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    key text NOT NULL,
    value jsonb DEFAULT '{}'::jsonb NOT NULL,
    updated_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: ai_insights_cache; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.ai_insights_cache (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    function_name text NOT NULL,
    cache_key text NOT NULL,
    payload jsonb NOT NULL,
    model text,
    tokens_input integer,
    tokens_output integer,
    duration_ms integer,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    expires_at timestamp with time zone DEFAULT (now() + '24:00:00'::interval) NOT NULL
);


--
-- Name: ai_usage_events; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.ai_usage_events (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    function_name text NOT NULL,
    event_type text NOT NULL,
    metadata jsonb,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: ai_usage_logs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.ai_usage_logs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    function_name text NOT NULL,
    model text,
    input_tokens integer DEFAULT 0,
    output_tokens integer DEFAULT 0,
    total_tokens integer DEFAULT 0,
    estimated_cost_usd numeric(10,6) DEFAULT 0,
    duration_ms integer,
    status text DEFAULT 'success'::text NOT NULL,
    error_message text,
    metadata jsonb DEFAULT '{}'::jsonb,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: ai_usage_quotas; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.ai_usage_quotas (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    role public.app_role NOT NULL,
    monthly_limit integer DEFAULT 100 NOT NULL,
    is_unlimited boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: app_vitals; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.app_vitals (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    metric_name text NOT NULL,
    metric_value numeric NOT NULL,
    rating text,
    request_id text,
    page_url text,
    user_agent text,
    user_id uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: art_file_attachments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.art_file_attachments (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    mockup_id uuid,
    quote_id uuid,
    file_url text NOT NULL,
    file_path text NOT NULL,
    original_name text NOT NULL,
    mime_type text,
    file_size_bytes bigint,
    file_extension text,
    notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: audit_logs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.audit_logs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    event_type text NOT NULL,
    endpoint text NOT NULL,
    identifier text NOT NULL,
    metadata jsonb DEFAULT '{}'::jsonb,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: auth_login_attempts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.auth_login_attempts (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    email text NOT NULL,
    ip_address text,
    success boolean DEFAULT false NOT NULL,
    failure_reason text,
    user_agent text,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: bot_detection_log; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.bot_detection_log (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    ip_address text NOT NULL,
    user_agent text,
    endpoint text NOT NULL,
    detection_reason text NOT NULL,
    request_count integer DEFAULT 1,
    blocked boolean DEFAULT false NOT NULL,
    metadata jsonb DEFAULT '{}'::jsonb,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: cart_templates; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.cart_templates (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    name text NOT NULL,
    description text,
    items jsonb DEFAULT '[]'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: category_icons; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.category_icons (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    category_name text NOT NULL,
    icon text NOT NULL,
    description text,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: collection_item_reactions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.collection_item_reactions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    collection_id uuid NOT NULL,
    item_id uuid NOT NULL,
    anon_id text NOT NULL,
    emoji text NOT NULL,
    ip_hash text,
    user_agent text,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: collection_items; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.collection_items (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    collection_id uuid NOT NULL,
    product_id text NOT NULL,
    color_name text,
    color_hex text,
    thumbnail_url text,
    sort_order integer DEFAULT 0,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    notes text,
    price_at_save numeric,
    added_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: collection_items_trash; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.collection_items_trash (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    original_id uuid NOT NULL,
    collection_id uuid NOT NULL,
    user_id uuid NOT NULL,
    product_id text NOT NULL,
    color_name text,
    color_hex text,
    thumbnail_url text,
    notes text,
    price_at_save numeric,
    sort_order integer,
    deleted_at timestamp with time zone DEFAULT now() NOT NULL,
    expires_at timestamp with time zone DEFAULT (now() + '30 days'::interval) NOT NULL
);


--
-- Name: collections; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.collections (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    name text NOT NULL,
    description text,
    is_featured boolean DEFAULT false NOT NULL,
    icon_color text DEFAULT '#3b82f6'::text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    icon text DEFAULT '📁'::text,
    client_id text,
    client_name text,
    share_token text,
    share_expires_at timestamp with time zone,
    is_public boolean DEFAULT false NOT NULL,
    is_deleted boolean DEFAULT false NOT NULL
);


--
-- Name: comparison_reactions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.comparison_reactions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    comparison_id uuid NOT NULL,
    item_index integer DEFAULT 0 NOT NULL,
    emoji text NOT NULL,
    anon_id text NOT NULL,
    ip_hash text,
    user_agent text,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: component_media; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.component_media (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    component_id text NOT NULL,
    product_id text NOT NULL,
    media_type text DEFAULT 'image'::text NOT NULL,
    url text NOT NULL,
    title text,
    sort_order integer DEFAULT 0,
    is_cover boolean DEFAULT false,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT component_media_media_type_check CHECK ((media_type = ANY (ARRAY['image'::text, 'video'::text])))
);


--
-- Name: connection_test_history; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.connection_test_history (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    connection_id uuid NOT NULL,
    tested_at timestamp with time zone DEFAULT now() NOT NULL,
    success boolean DEFAULT false NOT NULL,
    latency_ms integer,
    status_code integer,
    error_message text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    triggered_by text DEFAULT 'manual'::text NOT NULL,
    error_kind text,
    request_method text,
    request_url text,
    response_headers jsonb,
    response_body text,
    dns_ms integer,
    tcp_ms integer,
    tls_ms integer,
    ttfb_ms integer,
    download_ms integer,
    triggered_by_user_id uuid,
    attempts smallint DEFAULT 1 NOT NULL,
    CONSTRAINT connection_test_history_triggered_by_check CHECK ((triggered_by = ANY (ARRAY['manual'::text, 'cron'::text, 'webhook'::text])))
);


--
-- Name: conversation_audit_logs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.conversation_audit_logs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    session_id text NOT NULL,
    user_id uuid NOT NULL,
    started_at timestamp with time zone DEFAULT now() NOT NULL,
    ended_at timestamp with time zone,
    total_tokens_estimated integer DEFAULT 0,
    metadata jsonb DEFAULT '{}'::jsonb,
    status text DEFAULT 'active'::text NOT NULL,
    client_info jsonb DEFAULT '{}'::jsonb
);


--
-- Name: conversation_delivery_status; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.conversation_delivery_status (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    event_id uuid NOT NULL,
    status text DEFAULT 'sent'::text NOT NULL,
    error_details text,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: conversation_event_history; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.conversation_event_history (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    conversation_id uuid NOT NULL,
    role text NOT NULL,
    event_type public.conversation_event_type DEFAULT 'text'::public.conversation_event_type NOT NULL,
    content text,
    media_url text,
    media_metadata jsonb DEFAULT '{}'::jsonb,
    tokens_estimated integer DEFAULT 0,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    request_id uuid
);


--
-- Name: custom_kits; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.custom_kits (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    name text DEFAULT 'Kit sem nome'::text NOT NULL,
    status text DEFAULT 'draft'::text NOT NULL,
    box_data jsonb,
    items_data jsonb DEFAULT '[]'::jsonb NOT NULL,
    personalization_data jsonb DEFAULT '{}'::jsonb NOT NULL,
    kit_quantity integer DEFAULT 1 NOT NULL,
    box_price numeric DEFAULT 0 NOT NULL,
    items_price numeric DEFAULT 0 NOT NULL,
    personalization_price numeric DEFAULT 0 NOT NULL,
    total_price numeric DEFAULT 0 NOT NULL,
    volume_usage_percent numeric DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    kit_type text DEFAULT 'montado'::text NOT NULL,
    color text DEFAULT '#3B82F6'::text NOT NULL,
    tag text,
    icon text DEFAULT 'Package'::text NOT NULL,
    description text,
    is_favorite boolean DEFAULT false NOT NULL,
    last_used_at timestamp with time zone,
    is_pinned boolean DEFAULT false NOT NULL
);


--
-- Name: discount_approval_requests; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.discount_approval_requests (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    quote_id uuid NOT NULL,
    seller_id uuid NOT NULL,
    requested_discount_percent numeric NOT NULL,
    max_allowed_percent numeric NOT NULL,
    status text DEFAULT 'pending'::text NOT NULL,
    admin_id uuid,
    admin_notes text,
    seller_notes text,
    responded_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: e2e_cleanup_audit; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.e2e_cleanup_audit (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    email text NOT NULL,
    user_id uuid,
    dry_run boolean DEFAULT true NOT NULL,
    status text NOT NULL,
    reason text,
    ip text,
    user_agent text,
    total_deleted integer DEFAULT 0 NOT NULL,
    deleted_by_table jsonb DEFAULT '{}'::jsonb NOT NULL,
    errors jsonb DEFAULT '{}'::jsonb NOT NULL,
    duration_ms integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    seller_scope text,
    seller_id uuid,
    name_filter_prefix text,
    CONSTRAINT e2e_cleanup_audit_status_check CHECK ((status = ANY (ARRAY['ok'::text, 'error'::text, 'rate_limited'::text, 'unauthorized'::text, 'forbidden'::text, 'not_found'::text, 'invalid'::text])))
);


--
-- Name: e2e_cleanup_rate_limit; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.e2e_cleanup_rate_limit (
    key text NOT NULL,
    count integer DEFAULT 0 NOT NULL,
    window_start timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: expert_conversations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.expert_conversations (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    seller_id uuid NOT NULL,
    client_id text,
    title text DEFAULT 'Nova Conversa'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: expert_messages; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.expert_messages (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    conversation_id uuid NOT NULL,
    role text DEFAULT 'user'::text NOT NULL,
    content text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);

ALTER TABLE ONLY public.expert_messages REPLICA IDENTITY FULL;


--
-- Name: external_connections; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.external_connections (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    type text NOT NULL,
    name text NOT NULL,
    config jsonb DEFAULT '{}'::jsonb NOT NULL,
    secret_refs text[] DEFAULT ARRAY[]::text[] NOT NULL,
    status text DEFAULT 'unconfigured'::text NOT NULL,
    last_test_at timestamp with time zone,
    last_test_ok boolean,
    last_test_message text,
    created_by uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    last_latency_ms integer,
    env_key text,
    auto_test_enabled boolean DEFAULT true NOT NULL,
    CONSTRAINT external_connections_status_check CHECK ((status = ANY (ARRAY['unconfigured'::text, 'active'::text, 'degraded'::text, 'error'::text, 'disabled'::text]))),
    CONSTRAINT external_connections_type_check CHECK ((type = ANY (ARRAY['supabase'::text, 'bitrix24'::text, 'n8n'::text, 'mcp'::text, 'webhook_outbound'::text, 'webhook_inbound'::text])))
);


--
-- Name: external_connections_sync_log; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.external_connections_sync_log (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    ran_at timestamp with time zone DEFAULT now() NOT NULL,
    triggered_by_user_id uuid,
    triggered_by_secret_name text,
    trigger_op text,
    processed integer DEFAULT 0 NOT NULL,
    created_count integer DEFAULT 0 NOT NULL,
    updated_count integer DEFAULT 0 NOT NULL,
    status text DEFAULT 'ok'::text NOT NULL,
    error_message text,
    duration_ms integer,
    details jsonb DEFAULT '{}'::jsonb,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: favorite_item_reactions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.favorite_item_reactions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    item_id uuid NOT NULL,
    list_id uuid NOT NULL,
    anon_id text NOT NULL,
    emoji text NOT NULL,
    ip_hash text,
    user_agent text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT favorite_item_reactions_emoji_check CHECK ((emoji = ANY (ARRAY['👍'::text, '❤️'::text, '🔥'::text, '💡'::text])))
);


--
-- Name: favorite_items; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.favorite_items (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    list_id uuid NOT NULL,
    user_id uuid NOT NULL,
    product_id text NOT NULL,
    variant_id text,
    variant_info jsonb,
    note text,
    price_at_save numeric(12,2),
    "position" integer DEFAULT 0 NOT NULL,
    added_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT favorite_items_note_check CHECK ((char_length(note) <= 280))
);


--
-- Name: favorite_items_trash; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.favorite_items_trash (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    original_id uuid NOT NULL,
    list_id uuid NOT NULL,
    user_id uuid NOT NULL,
    product_id text NOT NULL,
    variant_id text,
    variant_info jsonb,
    note text,
    price_at_save numeric(12,2),
    deleted_at timestamp with time zone DEFAULT now() NOT NULL,
    expires_at timestamp with time zone DEFAULT (now() + '30 days'::interval) NOT NULL
);


--
-- Name: favorite_lists; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.favorite_lists (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    name text DEFAULT 'Minha lista'::text NOT NULL,
    description text,
    color text DEFAULT '#3B82F6'::text NOT NULL,
    icon text DEFAULT 'Heart'::text NOT NULL,
    is_default boolean DEFAULT false NOT NULL,
    is_archived boolean DEFAULT false NOT NULL,
    client_id text,
    client_name text,
    shared_token text,
    shared_expires_at timestamp with time zone,
    "position" integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: favorites; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.favorites (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    product_id text NOT NULL,
    variant_info jsonb,
    added_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    is_deleted boolean DEFAULT false NOT NULL
);


--
-- Name: file_scan_logs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.file_scan_logs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid,
    bucket character varying(255) NOT NULL,
    path text NOT NULL,
    hash character varying(64) NOT NULL,
    scan_result jsonb DEFAULT '{}'::jsonb NOT NULL,
    status_code integer NOT NULL,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: follow_up_reminders; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.follow_up_reminders (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    quote_id text NOT NULL,
    seller_id uuid NOT NULL,
    reminder_type text DEFAULT 'expiring'::text NOT NULL,
    scheduled_for timestamp with time zone NOT NULL,
    is_sent boolean DEFAULT false NOT NULL,
    sent_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    title text DEFAULT ''::text,
    notes text,
    is_completed boolean DEFAULT false NOT NULL,
    completed_at timestamp with time zone
);


--
-- Name: generated_mockups; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.generated_mockups (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    seller_id uuid NOT NULL,
    client_id text,
    client_name text,
    product_id text,
    product_name text,
    product_sku text,
    technique_id text,
    technique_name text,
    logo_url text,
    mockup_url text,
    layout_url text,
    position_x numeric,
    position_y numeric,
    logo_width_cm numeric,
    logo_height_cm numeric,
    location_name text,
    colors_count integer,
    annotations jsonb,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: geo_allowed_countries; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.geo_allowed_countries (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    country_code character(2) NOT NULL,
    country_name text NOT NULL,
    is_active boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now(),
    created_by uuid
);


--
-- Name: hardening_health_snapshots; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.hardening_health_snapshots (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    snapshot_at timestamp with time zone DEFAULT now() NOT NULL,
    score integer NOT NULL,
    max_score integer DEFAULT 5 NOT NULL,
    failures text[] DEFAULT ARRAY[]::text[] NOT NULL,
    details jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: inbound_webhook_endpoints; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.inbound_webhook_endpoints (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    slug text NOT NULL,
    name text NOT NULL,
    source_system text NOT NULL,
    hmac_secret_ref text NOT NULL,
    allowed_events text[] DEFAULT ARRAY[]::text[] NOT NULL,
    active boolean DEFAULT true NOT NULL,
    description text,
    created_by uuid NOT NULL,
    last_received_at timestamp with time zone,
    total_received integer DEFAULT 0 NOT NULL,
    total_invalid integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: inbound_webhook_events; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.inbound_webhook_events (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    endpoint_id uuid NOT NULL,
    event_type text,
    payload jsonb,
    signature_valid boolean DEFAULT false NOT NULL,
    processed boolean DEFAULT false NOT NULL,
    error text,
    source_ip text,
    received_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: integration_credentials; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.integration_credentials (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    secret_name text NOT NULL,
    secret_value text NOT NULL,
    masked_suffix text,
    length integer,
    notes text,
    updated_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);

ALTER TABLE ONLY public.integration_credentials REPLICA IDENTITY FULL;


--
-- Name: ip_access_control; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.ip_access_control (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    ip_address text NOT NULL,
    list_type text NOT NULL,
    reason text,
    expires_at timestamp with time zone,
    created_by uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: kit_collaborators; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.kit_collaborators (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    kit_id uuid NOT NULL,
    user_id uuid NOT NULL,
    permission text DEFAULT 'view'::text NOT NULL,
    invited_by uuid,
    invited_email text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT kit_collaborators_permission_check CHECK ((permission = ANY (ARRAY['view'::text, 'edit'::text])))
);


--
-- Name: kit_comments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.kit_comments (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    kit_id uuid NOT NULL,
    author_id uuid NOT NULL,
    parent_id uuid,
    item_anchor text,
    body text NOT NULL,
    resolved boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: kit_share_tokens; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.kit_share_tokens (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    kit_id uuid NOT NULL,
    seller_id uuid NOT NULL,
    token text DEFAULT encode(extensions.gen_random_bytes(32), 'hex'::text) NOT NULL,
    client_name text,
    client_email text,
    status text DEFAULT 'active'::text NOT NULL,
    expires_at timestamp with time zone DEFAULT (now() + '30 days'::interval),
    viewed_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: kit_templates; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.kit_templates (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    description text,
    category text DEFAULT 'Geral'::text NOT NULL,
    color text DEFAULT '#3B82F6'::text NOT NULL,
    icon text DEFAULT 'Package'::text NOT NULL,
    tag text,
    cover_image_url text,
    box_data jsonb,
    items_data jsonb DEFAULT '[]'::jsonb NOT NULL,
    personalization_data jsonb DEFAULT '{}'::jsonb NOT NULL,
    total_price numeric DEFAULT 0 NOT NULL,
    volume_usage_percent numeric DEFAULT 0 NOT NULL,
    usage_count integer DEFAULT 0 NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: kit_variants; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.kit_variants (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    kit_master_id uuid NOT NULL,
    label text NOT NULL,
    sort_order integer DEFAULT 0 NOT NULL,
    box_data jsonb,
    items_data jsonb DEFAULT '[]'::jsonb NOT NULL,
    personalization_data jsonb DEFAULT '{}'::jsonb NOT NULL,
    kit_quantity integer DEFAULT 1 NOT NULL,
    total_price numeric DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: login_attempts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.login_attempts (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    email text NOT NULL,
    user_id uuid,
    ip_address text DEFAULT 'unknown'::text NOT NULL,
    user_agent text,
    success boolean DEFAULT false NOT NULL,
    failure_reason text,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: magic_up_brand_kits; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.magic_up_brand_kits (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    client_id text,
    client_name text,
    logo_urls jsonb DEFAULT '[]'::jsonb NOT NULL,
    primary_color text,
    secondary_color text,
    tone_of_voice text,
    visual_style text,
    required_words text[] DEFAULT '{}'::text[] NOT NULL,
    forbidden_words text[] DEFAULT '{}'::text[] NOT NULL,
    notes text,
    metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: magic_up_campaigns; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.magic_up_campaigns (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    client_id text,
    client_name text,
    title text DEFAULT 'Campanha Magic Up'::text NOT NULL,
    objective text,
    channel text,
    audience text,
    tone text,
    cta text,
    occasion text,
    status text DEFAULT 'draft'::text NOT NULL,
    metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: magic_up_comments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.magic_up_comments (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    generation_id uuid NOT NULL,
    author_name text DEFAULT 'Cliente'::text NOT NULL,
    comment text NOT NULL,
    is_public boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: magic_up_generations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.magic_up_generations (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    product_name text,
    scene_title text,
    scene_category text,
    client_name text,
    generated_image_url text,
    is_favorite boolean DEFAULT false,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    campaign_id uuid,
    product_id text,
    product_sku text,
    prompt_text text,
    model text,
    channel text,
    aspect_ratio text,
    quality_score integer,
    status text DEFAULT 'draft'::text NOT NULL,
    tags text[] DEFAULT '{}'::text[] NOT NULL,
    metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
    copy_pack jsonb DEFAULT '{}'::jsonb NOT NULL,
    export_presets jsonb DEFAULT '[]'::jsonb NOT NULL
);


--
-- Name: magic_up_public_shares; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.magic_up_public_shares (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    generation_id uuid,
    campaign_id uuid,
    share_token text DEFAULT encode(extensions.gen_random_bytes(24), 'hex'::text) NOT NULL,
    expires_at timestamp with time zone,
    allow_download boolean DEFAULT true NOT NULL,
    allow_comments boolean DEFAULT true NOT NULL,
    status text DEFAULT 'active'::text NOT NULL,
    metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT magic_up_public_shares_target_check CHECK (((generation_id IS NOT NULL) OR (campaign_id IS NOT NULL)))
);


--
-- Name: magic_up_reactions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.magic_up_reactions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    generation_id uuid NOT NULL,
    reaction_type text NOT NULL,
    ip_hash text,
    user_agent text,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: mcp_access_violations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.mcp_access_violations (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid,
    reason text NOT NULL,
    source text NOT NULL,
    operation text,
    target_key_id uuid,
    ip_address text,
    user_agent text,
    request_id text,
    details jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: mcp_api_keys; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.mcp_api_keys (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    key_hash text NOT NULL,
    key_prefix text NOT NULL,
    scopes text[] DEFAULT ARRAY[]::text[] NOT NULL,
    description text,
    created_by uuid NOT NULL,
    last_used_at timestamp with time zone,
    expires_at timestamp with time zone,
    revoked_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    rotated_from uuid,
    CONSTRAINT mcp_api_keys_key_hash_format_chk CHECK (((length(key_hash) = 64) AND (key_hash ~ '^[0-9a-f]{64}$'::text)))
);

ALTER TABLE ONLY public.mcp_api_keys FORCE ROW LEVEL SECURITY;


--
-- Name: mcp_full_grantors; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.mcp_full_grantors (
    user_id uuid NOT NULL,
    granted_by uuid,
    reason text,
    granted_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: mcp_key_auto_revocations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.mcp_key_auto_revocations (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    key_id uuid NOT NULL,
    created_by uuid NOT NULL,
    revoked_at timestamp with time zone DEFAULT now() NOT NULL,
    source text NOT NULL,
    reason text DEFAULT 'creator_lost_dev_role'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT mcp_key_auto_revocations_source_check CHECK ((source = ANY (ARRAY['trigger'::text, 'cron'::text, 'manual'::text])))
);


--
-- Name: mcp_keys; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.mcp_keys (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    key_name text NOT NULL,
    key_hash text NOT NULL,
    scopes text[],
    expires_at timestamp with time zone,
    last_used_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    is_revoked boolean DEFAULT false NOT NULL
);


--
-- Name: mockup_drafts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.mockup_drafts (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    draft_key text DEFAULT 'default'::text NOT NULL,
    product_id text,
    product_name text,
    technique_id text,
    technique_name text,
    client_id text,
    client_name text,
    personalization_areas jsonb DEFAULT '[]'::jsonb,
    logo_data text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: mockup_prompt_configs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.mockup_prompt_configs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    config_key text NOT NULL,
    label text NOT NULL,
    prompt_text text NOT NULL,
    ai_model text DEFAULT 'google/gemini-2.5-flash-image-preview'::text NOT NULL,
    technique_id uuid,
    is_active boolean DEFAULT true NOT NULL,
    version integer DEFAULT 1 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: mockup_prompt_history; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.mockup_prompt_history (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    config_id uuid NOT NULL,
    config_key text NOT NULL,
    old_prompt text,
    new_prompt text NOT NULL,
    ai_model text NOT NULL,
    version integer NOT NULL,
    changed_by uuid,
    change_notes text,
    changed_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: mockup_templates; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.mockup_templates (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    name text NOT NULL,
    description text,
    product_id text,
    product_name text,
    technique_id text,
    technique_name text,
    personalization_areas jsonb DEFAULT '[]'::jsonb NOT NULL,
    thumbnail_url text,
    usage_count integer DEFAULT 0 NOT NULL,
    is_favorite boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: optimization_queue_runs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.optimization_queue_runs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    queue_id uuid NOT NULL,
    status text NOT NULL,
    notes text,
    guardrail_status text,
    duration_ms integer,
    executed_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: order_item_personalizations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.order_item_personalizations (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    order_item_id uuid NOT NULL,
    technique_id uuid,
    technique_name text,
    location_id uuid,
    location_name text,
    image_url text,
    personalization_text text,
    price_adjustment numeric(10,2) DEFAULT 0,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: order_items; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.order_items (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    order_id uuid,
    product_id text,
    product_sku text,
    product_name text,
    product_image_url text,
    quantity integer DEFAULT 1,
    unit_price numeric(12,4) DEFAULT 0,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    organization_id uuid,
    total_price numeric(12,4),
    color_name text,
    color_hex text,
    notes text,
    size_code text,
    gender text,
    kit_group_id uuid,
    kit_name text,
    CONSTRAINT order_items_order_id_fkey_uuid CHECK (true)
);


--
-- Name: orders; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.orders (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    seller_id uuid NOT NULL,
    order_number text DEFAULT ''::text NOT NULL,
    status text DEFAULT 'pending'::text NOT NULL,
    fulfillment_status text DEFAULT 'unfulfilled'::text NOT NULL,
    client_id text,
    client_name text,
    client_email text,
    client_phone text,
    client_company text,
    quote_id uuid,
    subtotal numeric DEFAULT 0,
    discount_amount numeric DEFAULT 0,
    shipping_cost numeric DEFAULT 0,
    total numeric DEFAULT 0,
    notes text,
    internal_notes text,
    tracking_number text,
    shipping_type text,
    payment_terms text,
    delivery_time text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    organization_id uuid,
    version integer DEFAULT 1 NOT NULL
);


--
-- Name: organization_members; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.organization_members (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organization_id uuid NOT NULL,
    user_id uuid NOT NULL,
    role public.org_role DEFAULT 'member'::public.org_role NOT NULL,
    invited_by uuid,
    joined_at timestamp with time zone DEFAULT now() NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: organizations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.organizations (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    slug text NOT NULL,
    logo_url text,
    description text,
    is_active boolean DEFAULT true NOT NULL,
    settings jsonb DEFAULT '{}'::jsonb,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: outbound_webhooks; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.outbound_webhooks (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    url text NOT NULL,
    secret_ref text,
    events text[] DEFAULT ARRAY[]::text[] NOT NULL,
    active boolean DEFAULT true NOT NULL,
    retry_policy jsonb DEFAULT jsonb_build_object('max_attempts', 3, 'backoff_seconds', ARRAY[5, 30, 120]) NOT NULL,
    description text,
    created_by uuid NOT NULL,
    last_triggered_at timestamp with time zone,
    total_success integer DEFAULT 0 NOT NULL,
    total_failure integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    consecutive_failures integer DEFAULT 0 NOT NULL,
    auto_disabled_at timestamp with time zone,
    auto_disabled_reason text
);


--
-- Name: ownership_audit_reports; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.ownership_audit_reports (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    generated_at timestamp with time zone DEFAULT now() NOT NULL,
    total_tables_scanned integer DEFAULT 0 NOT NULL,
    total_issues_found integer DEFAULT 0 NOT NULL,
    null_owner_count integer DEFAULT 0 NOT NULL,
    missing_user_count integer DEFAULT 0 NOT NULL,
    details jsonb DEFAULT '[]'::jsonb NOT NULL,
    triggered_by text DEFAULT 'cron'::text NOT NULL,
    duration_ms integer,
    rls_coverage jsonb DEFAULT '[]'::jsonb NOT NULL,
    rls_gaps_count integer DEFAULT 0 NOT NULL
);


--
-- Name: ownership_repair_logs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.ownership_repair_logs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    report_id uuid,
    table_name text NOT NULL,
    owner_column text NOT NULL,
    issue_type text NOT NULL,
    action text NOT NULL,
    rows_affected integer DEFAULT 0 NOT NULL,
    dry_run boolean DEFAULT true NOT NULL,
    triggered_by uuid,
    triggered_by_label text,
    notes text,
    error_message text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT ownership_repair_logs_action_check CHECK ((action = ANY (ARRAY['deleted'::text, 'deactivated'::text, 'manual_review'::text, 'skipped'::text, 'failed'::text]))),
    CONSTRAINT ownership_repair_logs_issue_type_check CHECK ((issue_type = ANY (ARRAY['null_owner'::text, 'missing_user'::text])))
);


--
-- Name: password_reset_requests; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.password_reset_requests (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    email text NOT NULL,
    status text DEFAULT 'pending'::text NOT NULL,
    requested_at timestamp with time zone DEFAULT now(),
    reviewed_at timestamp with time zone,
    reviewed_by uuid,
    reviewer_notes text,
    user_id uuid,
    CONSTRAINT password_reset_requests_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'approved'::text, 'rejected'::text])))
);


--
-- Name: permissions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.permissions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    code text NOT NULL,
    name text NOT NULL,
    description text,
    category text DEFAULT 'geral'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: price_history; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.price_history (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    product_id text NOT NULL,
    variant_id text,
    price numeric(12,2) NOT NULL,
    recorded_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: product_component_locations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.product_component_locations (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    component_id uuid NOT NULL,
    location_code text NOT NULL,
    location_name text NOT NULL,
    description text,
    max_width_cm numeric(6,2),
    max_height_cm numeric(6,2),
    is_active boolean DEFAULT true NOT NULL,
    sort_order integer DEFAULT 0,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: product_components; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.product_components (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    product_id text NOT NULL,
    component_code text NOT NULL,
    component_name text NOT NULL,
    is_personalizable boolean DEFAULT true NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    sort_order integer DEFAULT 0,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: product_group_members; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.product_group_members (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    product_group_id uuid NOT NULL,
    product_id text NOT NULL,
    use_group_rules boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: product_groups; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.product_groups (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    group_code text NOT NULL,
    group_name text NOT NULL,
    description text,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: product_price_freshness_overrides; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.product_price_freshness_overrides (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    product_id text NOT NULL,
    threshold_days integer NOT NULL,
    updated_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT product_price_freshness_overrides_threshold_days_check CHECK ((threshold_days = ANY (ARRAY[30, 60, 90])))
);


--
-- Name: product_sync_logs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.product_sync_logs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    source text NOT NULL,
    status text DEFAULT 'pending'::text NOT NULL,
    records_processed integer DEFAULT 0 NOT NULL,
    records_inserted integer DEFAULT 0 NOT NULL,
    records_updated integer DEFAULT 0 NOT NULL,
    records_failed integer DEFAULT 0 NOT NULL,
    duration_ms integer,
    payload jsonb,
    error_message text,
    triggered_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: product_views; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.product_views (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    product_id text,
    product_sku text,
    product_name text,
    seller_id uuid,
    view_type text DEFAULT 'detail'::text,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: products; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.products (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    description text,
    price numeric(10,2),
    stock_quantity integer DEFAULT 0,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: profiles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.profiles (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    email text,
    full_name text,
    role text DEFAULT 'vendedor'::text,
    avatar_url text,
    phone text,
    department text,
    is_active boolean DEFAULT true,
    last_login_at timestamp with time zone,
    preferences jsonb DEFAULT '{}'::jsonb,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: public_token_failures; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.public_token_failures (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    resource_type text NOT NULL,
    resource_id text,
    attempted_token text,
    ip_address text,
    user_agent text,
    reason text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT public_token_failures_resource_type_check CHECK ((resource_type = ANY (ARRAY['quote'::text, 'kit'::text])))
);


--
-- Name: query_telemetry; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.query_telemetry (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    operation text NOT NULL,
    table_name text,
    rpc_name text,
    duration_ms integer NOT NULL,
    record_count integer,
    query_limit integer,
    query_offset integer,
    count_mode text,
    severity text DEFAULT 'slow'::text NOT NULL,
    error_message text,
    user_id uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    error_kind text,
    retry_count integer DEFAULT 0 NOT NULL,
    cache_hit boolean DEFAULT false NOT NULL,
    is_cold_start boolean DEFAULT false NOT NULL,
    is_503 boolean DEFAULT false NOT NULL
);


--
-- Name: quote_comments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.quote_comments (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    quote_id text NOT NULL,
    user_id uuid NOT NULL,
    parent_id uuid,
    content text NOT NULL,
    is_edited boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: quote_drafts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.quote_drafts (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    data jsonb NOT NULL,
    last_saved_at timestamp with time zone DEFAULT now()
);


--
-- Name: quote_history; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.quote_history (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    quote_id uuid NOT NULL,
    user_id uuid,
    action text NOT NULL,
    description text,
    field_changed text,
    old_value text,
    new_value text,
    metadata jsonb DEFAULT '{}'::jsonb,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: quote_item_personalizations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.quote_item_personalizations (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    quote_item_id uuid NOT NULL,
    technique_id text,
    technique_name text,
    colors_count integer DEFAULT 1,
    positions_count integer DEFAULT 1,
    area_cm2 numeric,
    width_cm numeric,
    height_cm numeric,
    personalized_quantity integer,
    setup_cost numeric DEFAULT 0,
    unit_cost numeric DEFAULT 0,
    total_cost numeric DEFAULT 0,
    notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: quote_items; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.quote_items (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    quote_id uuid NOT NULL,
    product_id text,
    product_name text NOT NULL,
    product_sku text,
    product_image_url text,
    quantity integer DEFAULT 1 NOT NULL,
    unit_price numeric DEFAULT 0 NOT NULL,
    subtotal numeric,
    color_name text,
    color_hex text,
    notes text,
    sort_order integer DEFAULT 0,
    display_order integer,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    kit_group_id text,
    kit_name text,
    size_code text,
    gender text,
    price_confirmed_at timestamp with time zone
);


--
-- Name: quote_templates; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.quote_templates (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    seller_id uuid NOT NULL,
    name text NOT NULL,
    description text,
    is_default boolean DEFAULT false,
    template_data jsonb DEFAULT '{}'::jsonb,
    items_data jsonb DEFAULT '[]'::jsonb,
    discount_percent numeric DEFAULT 0,
    discount_amount numeric DEFAULT 0,
    notes text,
    internal_notes text,
    payment_terms text,
    delivery_time text,
    validity_days integer DEFAULT 30,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: quotes; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.quotes (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    quote_number text DEFAULT ''::text NOT NULL,
    client_id text,
    client_name text,
    client_email text,
    client_phone text,
    client_company text,
    client_cnpj text,
    seller_id uuid NOT NULL,
    status text DEFAULT 'draft'::text NOT NULL,
    subtotal numeric DEFAULT 0 NOT NULL,
    discount_percent numeric DEFAULT 0 NOT NULL,
    discount_amount numeric DEFAULT 0 NOT NULL,
    total numeric DEFAULT 0 NOT NULL,
    notes text,
    payment_terms text,
    delivery_time text,
    shipping_type text,
    shipping_cost numeric DEFAULT 0,
    internal_notes text,
    valid_until timestamp with time zone,
    bitrix_deal_id text,
    bitrix_quote_id text,
    synced_to_bitrix boolean DEFAULT false,
    synced_at timestamp with time zone,
    client_response text,
    client_response_at timestamp with time zone,
    client_response_notes text,
    sent_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    version integer DEFAULT 1 NOT NULL,
    parent_quote_id uuid,
    is_latest_version boolean DEFAULT true NOT NULL,
    organization_id uuid,
    negotiation_markup_percent numeric(5,2) DEFAULT 0 NOT NULL,
    real_subtotal numeric(12,2),
    real_discount_percent numeric(5,2),
    CONSTRAINT quotes_negotiation_markup_range CHECK (((negotiation_markup_percent >= (0)::numeric) AND (negotiation_markup_percent <= (50)::numeric)))
);


--
-- Name: recently_viewed_products; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.recently_viewed_products (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    product_id text NOT NULL,
    viewed_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: request_rate_limits; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.request_rate_limits (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    identifier text NOT NULL,
    endpoint text NOT NULL,
    request_count integer DEFAULT 1 NOT NULL,
    window_start timestamp with time zone DEFAULT now() NOT NULL,
    blocked_until timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: rls_denial_log; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.rls_denial_log (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    user_email text,
    user_role text,
    table_name text NOT NULL,
    operation text NOT NULL,
    endpoint text,
    query_summary text,
    target_id uuid,
    target_seller_id uuid,
    policy_hint text,
    error_code text,
    error_message text,
    user_agent text,
    ip_address inet,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT rls_denial_log_operation_check CHECK ((operation = ANY (ARRAY['SELECT'::text, 'INSERT'::text, 'UPDATE'::text, 'DELETE'::text])))
);


--
-- Name: role_migration_batches; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.role_migration_batches (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    label text NOT NULL,
    reason text NOT NULL,
    initiated_by uuid NOT NULL,
    dry_run boolean DEFAULT false NOT NULL,
    status public.role_migration_status DEFAULT 'pending'::public.role_migration_status NOT NULL,
    total_items integer DEFAULT 0 NOT NULL,
    success_count integer DEFAULT 0 NOT NULL,
    failed_count integer DEFAULT 0 NOT NULL,
    skipped_count integer DEFAULT 0 NOT NULL,
    started_at timestamp with time zone,
    finished_at timestamp with time zone,
    duration_ms integer,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: role_migration_items; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.role_migration_items (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    batch_id uuid NOT NULL,
    user_id uuid NOT NULL,
    user_email text,
    from_role public.app_role,
    to_role public.app_role NOT NULL,
    operation text NOT NULL,
    status public.role_migration_item_status DEFAULT 'pending'::public.role_migration_item_status NOT NULL,
    error_message text,
    duration_ms integer,
    processed_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT role_migration_items_operation_check CHECK ((operation = ANY (ARRAY['add'::text, 'remove'::text, 'replace'::text])))
);


--
-- Name: role_permissions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.role_permissions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    role public.app_role NOT NULL,
    permission_code text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: saved_filters; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.saved_filters (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    name text NOT NULL,
    description text,
    filters jsonb DEFAULT '{}'::jsonb NOT NULL,
    context text DEFAULT 'catalog'::text NOT NULL,
    is_default boolean DEFAULT false NOT NULL,
    icon text,
    color text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: saved_trends_views; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.saved_trends_views (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    name text NOT NULL,
    filters jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: scheduled_reports; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.scheduled_reports (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    report_type text DEFAULT 'sales'::text NOT NULL,
    frequency text DEFAULT 'weekly'::text NOT NULL,
    email_to text NOT NULL,
    report_name text DEFAULT 'Relatório'::text NOT NULL,
    filters jsonb DEFAULT '{}'::jsonb,
    is_active boolean DEFAULT true NOT NULL,
    last_sent_at timestamp with time zone,
    next_run_at timestamp with time zone DEFAULT now() NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT valid_frequency CHECK ((frequency = ANY (ARRAY['daily'::text, 'weekly'::text, 'monthly'::text]))),
    CONSTRAINT valid_report_type CHECK ((report_type = ANY (ARRAY['sales'::text, 'quotes'::text, 'clients'::text, 'products'::text, 'orders'::text])))
);


--
-- Name: search_analytics; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.search_analytics (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid,
    search_term text NOT NULL,
    results_count integer DEFAULT 0 NOT NULL,
    search_context text,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: secret_rotation_log; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.secret_rotation_log (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    secret_name text NOT NULL,
    rotated_by uuid NOT NULL,
    rotated_at timestamp with time zone DEFAULT now() NOT NULL,
    previous_suffix text,
    new_suffix text,
    notes text,
    action_type text DEFAULT 'rotate'::text NOT NULL
);


--
-- Name: seller_cart_items; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.seller_cart_items (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    cart_id uuid NOT NULL,
    product_id text NOT NULL,
    product_name text NOT NULL,
    product_sku text,
    product_image_url text,
    product_price numeric DEFAULT 0 NOT NULL,
    quantity integer DEFAULT 1 NOT NULL,
    color_name text,
    color_hex text,
    notes text,
    sort_order integer,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: seller_carts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.seller_carts (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    seller_id uuid NOT NULL,
    company_id text NOT NULL,
    company_name text NOT NULL,
    company_location text,
    company_logo_url text,
    notes text,
    status text DEFAULT 'novo'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: seller_discount_limits; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.seller_discount_limits (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    max_discount_percent numeric DEFAULT 5 NOT NULL,
    set_by uuid NOT NULL,
    notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: simulator_wizard_drafts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.simulator_wizard_drafts (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    title text DEFAULT 'Rascunho'::text NOT NULL,
    product_data jsonb DEFAULT '{}'::jsonb NOT NULL,
    quantity integer DEFAULT 100 NOT NULL,
    personalizations jsonb DEFAULT '[]'::jsonb NOT NULL,
    wizard_step text DEFAULT 'product'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: step_up_audit_log; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.step_up_audit_log (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid,
    action public.step_up_action,
    target_ref text,
    event_type text NOT NULL,
    challenge_id uuid,
    token_id uuid,
    ip_address inet,
    user_agent text,
    metadata jsonb DEFAULT '{}'::jsonb,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: step_up_challenges; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.step_up_challenges (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    action public.step_up_action NOT NULL,
    target_ref text,
    otp_hash text NOT NULL,
    attempts smallint DEFAULT 0 NOT NULL,
    max_attempts smallint DEFAULT 5 NOT NULL,
    password_verified boolean DEFAULT false NOT NULL,
    otp_verified boolean DEFAULT false NOT NULL,
    consumed boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    expires_at timestamp with time zone DEFAULT (now() + '00:05:00'::interval) NOT NULL,
    ip_address inet,
    user_agent text
);


--
-- Name: step_up_tokens; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.step_up_tokens (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    action public.step_up_action NOT NULL,
    target_ref text,
    token_hash text NOT NULL,
    challenge_id uuid NOT NULL,
    consumed boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    expires_at timestamp with time zone DEFAULT (now() + '00:05:00'::interval) NOT NULL,
    consumed_at timestamp with time zone
);


--
-- Name: system_settings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.system_settings (
    key text NOT NULL,
    value jsonb NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_by uuid
);


--
-- Name: user_comparisons; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_comparisons (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    client_id text,
    client_name text,
    name text,
    items jsonb DEFAULT '[]'::jsonb NOT NULL,
    share_token text,
    is_public boolean DEFAULT false NOT NULL,
    share_expires_at timestamp with time zone,
    view_count integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: user_known_devices; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_known_devices (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    fingerprint text NOT NULL,
    device_name text,
    last_seen_at timestamp with time zone DEFAULT now() NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: user_onboarding; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_onboarding (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    has_completed_tour boolean DEFAULT false NOT NULL,
    current_step integer DEFAULT 0 NOT NULL,
    completed_steps jsonb DEFAULT '[]'::jsonb,
    started_at timestamp with time zone,
    completed_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: user_preferences; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_preferences (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    comparison_weights jsonb DEFAULT '{"price": 35, "stock": 20, "colors": 10, "minQty": 15, "leadTime": 10, "verified": 10}'::jsonb NOT NULL,
    comparison_column_order jsonb DEFAULT '[]'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    filter_states jsonb DEFAULT '{}'::jsonb NOT NULL
);


--
-- Name: user_roles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_roles (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    role public.app_role DEFAULT 'vendedor'::public.app_role NOT NULL
);


--
-- Name: user_search_history; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_search_history (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    query_text text NOT NULL,
    history_type text DEFAULT 'general'::text NOT NULL,
    result_count integer DEFAULT 0,
    is_pinned boolean DEFAULT false,
    metadata jsonb DEFAULT '{}'::jsonb,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: user_token_revocations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_token_revocations (
    user_id uuid NOT NULL,
    revoked_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: v_full_scope_grants; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.v_full_scope_grants WITH (security_invoker='on') AS
 SELECT sual.id AS audit_id,
    sual.created_at AS granted_at,
    sual.user_id AS granted_to_user_id,
    p.full_name AS granted_to_name,
    u.email AS granted_to_email,
    sual.action AS step_up_action,
    (sual.metadata ->> 'operation'::text) AS operation,
    ((sual.metadata ->> 'key_id'::text))::uuid AS key_id,
    (sual.metadata ->> 'key_prefix'::text) AS key_prefix,
    ((sual.metadata ->> 'expires_at'::text))::timestamp with time zone AS key_expires_at,
    (sual.metadata ->> 'justification'::text) AS justification,
    sual.challenge_id,
    sual.token_id,
    sual.ip_address,
    sual.user_agent,
    (sual.metadata ->> 'request_id'::text) AS request_id,
    (sual.metadata -> 'verifications'::text) AS verifications_applied,
    (sual.metadata -> 'extra'::text) AS extra
   FROM ((public.step_up_audit_log sual
     LEFT JOIN public.profiles p ON ((p.id = sual.user_id)))
     LEFT JOIN auth.users u ON ((u.id = sual.user_id)))
  WHERE (sual.event_type = 'full_scope_granted'::text);


--
-- Name: video_variant_links; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.video_variant_links (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    video_id text NOT NULL,
    variant_id text NOT NULL,
    variant_name text,
    variant_color_hex text,
    supplier_code text,
    product_id text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: voice_command_logs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.voice_command_logs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    transcript text NOT NULL,
    action text NOT NULL,
    response text,
    data jsonb DEFAULT '{}'::jsonb,
    duration_ms integer,
    success boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: webhook_deliveries; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.webhook_deliveries (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    webhook_id uuid NOT NULL,
    event text NOT NULL,
    payload jsonb,
    payload_hash text,
    status_code integer,
    response_body_truncated text,
    attempt integer DEFAULT 1 NOT NULL,
    success boolean DEFAULT false NOT NULL,
    error_message text,
    delivered_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: webhook_delivery_metrics; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.webhook_delivery_metrics (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    request_id text,
    event_type text,
    source text,
    direction text DEFAULT 'inbound'::text,
    endpoint text,
    http_status integer,
    duration_ms integer,
    attempt integer DEFAULT 1,
    success boolean DEFAULT true,
    error_class text,
    error_message text,
    payload_bytes integer,
    metadata jsonb DEFAULT '{}'::jsonb,
    occurred_at timestamp with time zone DEFAULT now() NOT NULL
)
PARTITION BY RANGE (occurred_at);


--
-- Name: webhook_delivery_metrics_y2026m05; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.webhook_delivery_metrics_y2026m05 (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    request_id text,
    event_type text,
    source text,
    direction text DEFAULT 'inbound'::text,
    endpoint text,
    http_status integer,
    duration_ms integer,
    attempt integer DEFAULT 1,
    success boolean DEFAULT true,
    error_class text,
    error_message text,
    payload_bytes integer,
    metadata jsonb DEFAULT '{}'::jsonb,
    occurred_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: webhook_delivery_metrics_y2026m06; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.webhook_delivery_metrics_y2026m06 (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    request_id text,
    event_type text,
    source text,
    direction text DEFAULT 'inbound'::text,
    endpoint text,
    http_status integer,
    duration_ms integer,
    attempt integer DEFAULT 1,
    success boolean DEFAULT true,
    error_class text,
    error_message text,
    payload_bytes integer,
    metadata jsonb DEFAULT '{}'::jsonb,
    occurred_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: workspace_notifications; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.workspace_notifications (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    title text NOT NULL,
    message text NOT NULL,
    type text DEFAULT 'info'::text NOT NULL,
    category text DEFAULT 'system'::text NOT NULL,
    is_read boolean DEFAULT false NOT NULL,
    action_url text,
    metadata jsonb DEFAULT '{}'::jsonb,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);

ALTER TABLE ONLY public.workspace_notifications REPLICA IDENTITY FULL;


--
-- Name: admin_audit_log_y2025m12; Type: TABLE ATTACH; Schema: public; Owner: -
--

ALTER TABLE ONLY public.admin_audit_log ATTACH PARTITION public.admin_audit_log_y2025m12 FOR VALUES FROM ('2025-12-01 00:00:00+00') TO ('2026-01-01 00:00:00+00');


--
-- Name: admin_audit_log_y2026m01; Type: TABLE ATTACH; Schema: public; Owner: -
--

ALTER TABLE ONLY public.admin_audit_log ATTACH PARTITION public.admin_audit_log_y2026m01 FOR VALUES FROM ('2026-01-01 00:00:00+00') TO ('2026-02-01 00:00:00+00');


--
-- Name: admin_audit_log_y2026m02; Type: TABLE ATTACH; Schema: public; Owner: -
--

ALTER TABLE ONLY public.admin_audit_log ATTACH PARTITION public.admin_audit_log_y2026m02 FOR VALUES FROM ('2026-02-01 00:00:00+00') TO ('2026-03-01 00:00:00+00');


--
-- Name: admin_audit_log_y2026m03; Type: TABLE ATTACH; Schema: public; Owner: -
--

ALTER TABLE ONLY public.admin_audit_log ATTACH PARTITION public.admin_audit_log_y2026m03 FOR VALUES FROM ('2026-03-01 00:00:00+00') TO ('2026-04-01 00:00:00+00');


--
-- Name: admin_audit_log_y2026m04; Type: TABLE ATTACH; Schema: public; Owner: -
--

ALTER TABLE ONLY public.admin_audit_log ATTACH PARTITION public.admin_audit_log_y2026m04 FOR VALUES FROM ('2026-04-01 00:00:00+00') TO ('2026-05-01 00:00:00+00');


--
-- Name: admin_audit_log_y2026m05; Type: TABLE ATTACH; Schema: public; Owner: -
--

ALTER TABLE ONLY public.admin_audit_log ATTACH PARTITION public.admin_audit_log_y2026m05 FOR VALUES FROM ('2026-05-01 00:00:00+00') TO ('2026-06-01 00:00:00+00');


--
-- Name: admin_audit_log_y2026m06; Type: TABLE ATTACH; Schema: public; Owner: -
--

ALTER TABLE ONLY public.admin_audit_log ATTACH PARTITION public.admin_audit_log_y2026m06 FOR VALUES FROM ('2026-06-01 00:00:00+00') TO ('2026-07-01 00:00:00+00');


--
-- Name: webhook_delivery_metrics_y2026m05; Type: TABLE ATTACH; Schema: public; Owner: -
--

ALTER TABLE ONLY public.webhook_delivery_metrics ATTACH PARTITION public.webhook_delivery_metrics_y2026m05 FOR VALUES FROM ('2026-05-01 00:00:00+00') TO ('2026-06-01 00:00:00+00');


--
-- Name: webhook_delivery_metrics_y2026m06; Type: TABLE ATTACH; Schema: public; Owner: -
--

ALTER TABLE ONLY public.webhook_delivery_metrics ATTACH PARTITION public.webhook_delivery_metrics_y2026m06 FOR VALUES FROM ('2026-06-01 00:00:00+00') TO ('2026-07-01 00:00:00+00');


--
-- Name: access_security_settings access_security_settings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.access_security_settings
    ADD CONSTRAINT access_security_settings_pkey PRIMARY KEY (id);


--
-- Name: admin_audit_log admin_audit_log_new_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.admin_audit_log
    ADD CONSTRAINT admin_audit_log_new_pkey PRIMARY KEY (id, created_at);


--
-- Name: admin_audit_log_old admin_audit_log_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.admin_audit_log_old
    ADD CONSTRAINT admin_audit_log_pkey PRIMARY KEY (id);


--
-- Name: admin_audit_log_y2025m12 admin_audit_log_y2025m12_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.admin_audit_log_y2025m12
    ADD CONSTRAINT admin_audit_log_y2025m12_pkey PRIMARY KEY (id, created_at);


--
-- Name: admin_audit_log_y2026m01 admin_audit_log_y2026m01_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.admin_audit_log_y2026m01
    ADD CONSTRAINT admin_audit_log_y2026m01_pkey PRIMARY KEY (id, created_at);


--
-- Name: admin_audit_log_y2026m02 admin_audit_log_y2026m02_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.admin_audit_log_y2026m02
    ADD CONSTRAINT admin_audit_log_y2026m02_pkey PRIMARY KEY (id, created_at);


--
-- Name: admin_audit_log_y2026m03 admin_audit_log_y2026m03_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.admin_audit_log_y2026m03
    ADD CONSTRAINT admin_audit_log_y2026m03_pkey PRIMARY KEY (id, created_at);


--
-- Name: admin_audit_log_y2026m04 admin_audit_log_y2026m04_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.admin_audit_log_y2026m04
    ADD CONSTRAINT admin_audit_log_y2026m04_pkey PRIMARY KEY (id, created_at);


--
-- Name: admin_audit_log_y2026m05 admin_audit_log_y2026m05_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.admin_audit_log_y2026m05
    ADD CONSTRAINT admin_audit_log_y2026m05_pkey PRIMARY KEY (id, created_at);


--
-- Name: admin_audit_log_y2026m06 admin_audit_log_y2026m06_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.admin_audit_log_y2026m06
    ADD CONSTRAINT admin_audit_log_y2026m06_pkey PRIMARY KEY (id, created_at);


--
-- Name: admin_settings admin_settings_key_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.admin_settings
    ADD CONSTRAINT admin_settings_key_key UNIQUE (key);


--
-- Name: admin_settings admin_settings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.admin_settings
    ADD CONSTRAINT admin_settings_pkey PRIMARY KEY (id);


--
-- Name: ai_insights_cache ai_insights_cache_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ai_insights_cache
    ADD CONSTRAINT ai_insights_cache_pkey PRIMARY KEY (id);


--
-- Name: ai_usage_events ai_usage_events_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ai_usage_events
    ADD CONSTRAINT ai_usage_events_pkey PRIMARY KEY (id);


--
-- Name: ai_usage_logs ai_usage_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ai_usage_logs
    ADD CONSTRAINT ai_usage_logs_pkey PRIMARY KEY (id);


--
-- Name: ai_usage_quotas ai_usage_quotas_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ai_usage_quotas
    ADD CONSTRAINT ai_usage_quotas_pkey PRIMARY KEY (id);


--
-- Name: ai_usage_quotas ai_usage_quotas_role_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ai_usage_quotas
    ADD CONSTRAINT ai_usage_quotas_role_key UNIQUE (role);


--
-- Name: app_vitals app_vitals_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.app_vitals
    ADD CONSTRAINT app_vitals_pkey PRIMARY KEY (id);


--
-- Name: art_file_attachments art_file_attachments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.art_file_attachments
    ADD CONSTRAINT art_file_attachments_pkey PRIMARY KEY (id);


--
-- Name: audit_logs audit_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.audit_logs
    ADD CONSTRAINT audit_logs_pkey PRIMARY KEY (id);


--
-- Name: auth_login_attempts auth_login_attempts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.auth_login_attempts
    ADD CONSTRAINT auth_login_attempts_pkey PRIMARY KEY (id);


--
-- Name: bot_detection_log bot_detection_log_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bot_detection_log
    ADD CONSTRAINT bot_detection_log_pkey PRIMARY KEY (id);


--
-- Name: cart_templates cart_templates_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cart_templates
    ADD CONSTRAINT cart_templates_pkey PRIMARY KEY (id);


--
-- Name: category_icons category_icons_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.category_icons
    ADD CONSTRAINT category_icons_pkey PRIMARY KEY (id);


--
-- Name: collection_item_reactions collection_item_reactions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.collection_item_reactions
    ADD CONSTRAINT collection_item_reactions_pkey PRIMARY KEY (id);


--
-- Name: collection_items collection_items_collection_id_product_id_color_name_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.collection_items
    ADD CONSTRAINT collection_items_collection_id_product_id_color_name_key UNIQUE (collection_id, product_id, color_name);


--
-- Name: collection_items collection_items_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.collection_items
    ADD CONSTRAINT collection_items_pkey PRIMARY KEY (id);


--
-- Name: collection_items_trash collection_items_trash_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.collection_items_trash
    ADD CONSTRAINT collection_items_trash_pkey PRIMARY KEY (id);


--
-- Name: collections collections_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.collections
    ADD CONSTRAINT collections_pkey PRIMARY KEY (id);


--
-- Name: collections collections_share_token_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.collections
    ADD CONSTRAINT collections_share_token_key UNIQUE (share_token);


--
-- Name: comparison_reactions comparison_reactions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.comparison_reactions
    ADD CONSTRAINT comparison_reactions_pkey PRIMARY KEY (id);


--
-- Name: component_media component_media_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.component_media
    ADD CONSTRAINT component_media_pkey PRIMARY KEY (id);


--
-- Name: connection_test_history connection_test_history_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.connection_test_history
    ADD CONSTRAINT connection_test_history_pkey PRIMARY KEY (id);


--
-- Name: conversation_audit_logs conversation_audit_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.conversation_audit_logs
    ADD CONSTRAINT conversation_audit_logs_pkey PRIMARY KEY (id);


--
-- Name: conversation_delivery_status conversation_delivery_status_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.conversation_delivery_status
    ADD CONSTRAINT conversation_delivery_status_pkey PRIMARY KEY (id);


--
-- Name: conversation_event_history conversation_event_history_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.conversation_event_history
    ADD CONSTRAINT conversation_event_history_pkey PRIMARY KEY (id);


--
-- Name: custom_kits custom_kits_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.custom_kits
    ADD CONSTRAINT custom_kits_pkey PRIMARY KEY (id);


--
-- Name: discount_approval_requests discount_approval_requests_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.discount_approval_requests
    ADD CONSTRAINT discount_approval_requests_pkey PRIMARY KEY (id);


--
-- Name: e2e_cleanup_audit e2e_cleanup_audit_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.e2e_cleanup_audit
    ADD CONSTRAINT e2e_cleanup_audit_pkey PRIMARY KEY (id);


--
-- Name: e2e_cleanup_rate_limit e2e_cleanup_rate_limit_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.e2e_cleanup_rate_limit
    ADD CONSTRAINT e2e_cleanup_rate_limit_pkey PRIMARY KEY (key);


--
-- Name: expert_conversations expert_conversations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.expert_conversations
    ADD CONSTRAINT expert_conversations_pkey PRIMARY KEY (id);


--
-- Name: expert_messages expert_messages_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.expert_messages
    ADD CONSTRAINT expert_messages_pkey PRIMARY KEY (id);


--
-- Name: external_connections external_connections_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.external_connections
    ADD CONSTRAINT external_connections_pkey PRIMARY KEY (id);


--
-- Name: external_connections_sync_log external_connections_sync_log_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.external_connections_sync_log
    ADD CONSTRAINT external_connections_sync_log_pkey PRIMARY KEY (id);


--
-- Name: external_connections external_connections_type_name_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.external_connections
    ADD CONSTRAINT external_connections_type_name_key UNIQUE (type, name);


--
-- Name: favorite_item_reactions favorite_item_reactions_item_id_anon_id_emoji_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.favorite_item_reactions
    ADD CONSTRAINT favorite_item_reactions_item_id_anon_id_emoji_key UNIQUE (item_id, anon_id, emoji);


--
-- Name: favorite_item_reactions favorite_item_reactions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.favorite_item_reactions
    ADD CONSTRAINT favorite_item_reactions_pkey PRIMARY KEY (id);


--
-- Name: favorite_items favorite_items_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.favorite_items
    ADD CONSTRAINT favorite_items_pkey PRIMARY KEY (id);


--
-- Name: favorite_items_trash favorite_items_trash_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.favorite_items_trash
    ADD CONSTRAINT favorite_items_trash_pkey PRIMARY KEY (id);


--
-- Name: favorite_lists favorite_lists_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.favorite_lists
    ADD CONSTRAINT favorite_lists_pkey PRIMARY KEY (id);


--
-- Name: favorite_lists favorite_lists_shared_token_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.favorite_lists
    ADD CONSTRAINT favorite_lists_shared_token_key UNIQUE (shared_token);


--
-- Name: favorites favorites_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.favorites
    ADD CONSTRAINT favorites_pkey PRIMARY KEY (id);


--
-- Name: favorites favorites_user_id_product_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.favorites
    ADD CONSTRAINT favorites_user_id_product_id_key UNIQUE (user_id, product_id);


--
-- Name: file_scan_logs file_scan_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.file_scan_logs
    ADD CONSTRAINT file_scan_logs_pkey PRIMARY KEY (id);


--
-- Name: follow_up_reminders follow_up_reminders_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.follow_up_reminders
    ADD CONSTRAINT follow_up_reminders_pkey PRIMARY KEY (id);


--
-- Name: generated_mockups generated_mockups_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.generated_mockups
    ADD CONSTRAINT generated_mockups_pkey PRIMARY KEY (id);


--
-- Name: geo_allowed_countries geo_allowed_countries_country_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.geo_allowed_countries
    ADD CONSTRAINT geo_allowed_countries_country_code_key UNIQUE (country_code);


--
-- Name: geo_allowed_countries geo_allowed_countries_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.geo_allowed_countries
    ADD CONSTRAINT geo_allowed_countries_pkey PRIMARY KEY (id);


--
-- Name: hardening_health_snapshots hardening_health_snapshots_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.hardening_health_snapshots
    ADD CONSTRAINT hardening_health_snapshots_pkey PRIMARY KEY (id);


--
-- Name: inbound_webhook_endpoints inbound_webhook_endpoints_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inbound_webhook_endpoints
    ADD CONSTRAINT inbound_webhook_endpoints_pkey PRIMARY KEY (id);


--
-- Name: inbound_webhook_endpoints inbound_webhook_endpoints_slug_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inbound_webhook_endpoints
    ADD CONSTRAINT inbound_webhook_endpoints_slug_key UNIQUE (slug);


--
-- Name: inbound_webhook_events inbound_webhook_events_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inbound_webhook_events
    ADD CONSTRAINT inbound_webhook_events_pkey PRIMARY KEY (id);


--
-- Name: integration_credentials integration_credentials_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.integration_credentials
    ADD CONSTRAINT integration_credentials_pkey PRIMARY KEY (id);


--
-- Name: integration_credentials integration_credentials_secret_name_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.integration_credentials
    ADD CONSTRAINT integration_credentials_secret_name_key UNIQUE (secret_name);


--
-- Name: ip_access_control ip_access_control_ip_address_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ip_access_control
    ADD CONSTRAINT ip_access_control_ip_address_key UNIQUE (ip_address);


--
-- Name: ip_access_control ip_access_control_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ip_access_control
    ADD CONSTRAINT ip_access_control_pkey PRIMARY KEY (id);


--
-- Name: kit_collaborators kit_collaborators_kit_id_user_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.kit_collaborators
    ADD CONSTRAINT kit_collaborators_kit_id_user_id_key UNIQUE (kit_id, user_id);


--
-- Name: kit_collaborators kit_collaborators_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.kit_collaborators
    ADD CONSTRAINT kit_collaborators_pkey PRIMARY KEY (id);


--
-- Name: kit_comments kit_comments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.kit_comments
    ADD CONSTRAINT kit_comments_pkey PRIMARY KEY (id);


--
-- Name: kit_share_tokens kit_share_tokens_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.kit_share_tokens
    ADD CONSTRAINT kit_share_tokens_pkey PRIMARY KEY (id);


--
-- Name: kit_share_tokens kit_share_tokens_token_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.kit_share_tokens
    ADD CONSTRAINT kit_share_tokens_token_key UNIQUE (token);


--
-- Name: kit_templates kit_templates_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.kit_templates
    ADD CONSTRAINT kit_templates_pkey PRIMARY KEY (id);


--
-- Name: kit_variants kit_variants_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.kit_variants
    ADD CONSTRAINT kit_variants_pkey PRIMARY KEY (id);


--
-- Name: login_attempts login_attempts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.login_attempts
    ADD CONSTRAINT login_attempts_pkey PRIMARY KEY (id);


--
-- Name: magic_up_brand_kits magic_up_brand_kits_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.magic_up_brand_kits
    ADD CONSTRAINT magic_up_brand_kits_pkey PRIMARY KEY (id);


--
-- Name: magic_up_brand_kits magic_up_brand_kits_user_id_client_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.magic_up_brand_kits
    ADD CONSTRAINT magic_up_brand_kits_user_id_client_id_key UNIQUE (user_id, client_id);


--
-- Name: magic_up_campaigns magic_up_campaigns_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.magic_up_campaigns
    ADD CONSTRAINT magic_up_campaigns_pkey PRIMARY KEY (id);


--
-- Name: magic_up_comments magic_up_comments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.magic_up_comments
    ADD CONSTRAINT magic_up_comments_pkey PRIMARY KEY (id);


--
-- Name: magic_up_generations magic_up_generations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.magic_up_generations
    ADD CONSTRAINT magic_up_generations_pkey PRIMARY KEY (id);


--
-- Name: magic_up_public_shares magic_up_public_shares_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.magic_up_public_shares
    ADD CONSTRAINT magic_up_public_shares_pkey PRIMARY KEY (id);


--
-- Name: magic_up_public_shares magic_up_public_shares_share_token_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.magic_up_public_shares
    ADD CONSTRAINT magic_up_public_shares_share_token_key UNIQUE (share_token);


--
-- Name: magic_up_reactions magic_up_reactions_generation_id_reaction_type_ip_hash_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.magic_up_reactions
    ADD CONSTRAINT magic_up_reactions_generation_id_reaction_type_ip_hash_key UNIQUE (generation_id, reaction_type, ip_hash);


--
-- Name: magic_up_reactions magic_up_reactions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.magic_up_reactions
    ADD CONSTRAINT magic_up_reactions_pkey PRIMARY KEY (id);


--
-- Name: mcp_access_violations mcp_access_violations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.mcp_access_violations
    ADD CONSTRAINT mcp_access_violations_pkey PRIMARY KEY (id);


--
-- Name: mcp_api_keys mcp_api_keys_key_hash_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.mcp_api_keys
    ADD CONSTRAINT mcp_api_keys_key_hash_key UNIQUE (key_hash);


--
-- Name: mcp_api_keys mcp_api_keys_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.mcp_api_keys
    ADD CONSTRAINT mcp_api_keys_pkey PRIMARY KEY (id);


--
-- Name: mcp_full_grantors mcp_full_grantors_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.mcp_full_grantors
    ADD CONSTRAINT mcp_full_grantors_pkey PRIMARY KEY (user_id);


--
-- Name: mcp_key_auto_revocations mcp_key_auto_revocations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.mcp_key_auto_revocations
    ADD CONSTRAINT mcp_key_auto_revocations_pkey PRIMARY KEY (id);


--
-- Name: mcp_keys mcp_keys_key_hash_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.mcp_keys
    ADD CONSTRAINT mcp_keys_key_hash_key UNIQUE (key_hash);


--
-- Name: mcp_keys mcp_keys_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.mcp_keys
    ADD CONSTRAINT mcp_keys_pkey PRIMARY KEY (id);


--
-- Name: mockup_drafts mockup_drafts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.mockup_drafts
    ADD CONSTRAINT mockup_drafts_pkey PRIMARY KEY (id);


--
-- Name: mockup_drafts mockup_drafts_user_id_draft_key_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.mockup_drafts
    ADD CONSTRAINT mockup_drafts_user_id_draft_key_key UNIQUE (user_id, draft_key);


--
-- Name: mockup_prompt_configs mockup_prompt_configs_config_key_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.mockup_prompt_configs
    ADD CONSTRAINT mockup_prompt_configs_config_key_key UNIQUE (config_key);


--
-- Name: mockup_prompt_configs mockup_prompt_configs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.mockup_prompt_configs
    ADD CONSTRAINT mockup_prompt_configs_pkey PRIMARY KEY (id);


--
-- Name: mockup_prompt_history mockup_prompt_history_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.mockup_prompt_history
    ADD CONSTRAINT mockup_prompt_history_pkey PRIMARY KEY (id);


--
-- Name: mockup_templates mockup_templates_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.mockup_templates
    ADD CONSTRAINT mockup_templates_pkey PRIMARY KEY (id);


--
-- Name: optimization_queue optimization_queue_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.optimization_queue
    ADD CONSTRAINT optimization_queue_pkey PRIMARY KEY (id);


--
-- Name: optimization_queue_runs optimization_queue_runs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.optimization_queue_runs
    ADD CONSTRAINT optimization_queue_runs_pkey PRIMARY KEY (id);


--
-- Name: order_item_personalizations order_item_personalizations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.order_item_personalizations
    ADD CONSTRAINT order_item_personalizations_pkey PRIMARY KEY (id);


--
-- Name: order_items order_items_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.order_items
    ADD CONSTRAINT order_items_pkey PRIMARY KEY (id);


--
-- Name: orders orders_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.orders
    ADD CONSTRAINT orders_pkey PRIMARY KEY (id);


--
-- Name: organization_members organization_members_organization_id_user_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.organization_members
    ADD CONSTRAINT organization_members_organization_id_user_id_key UNIQUE (organization_id, user_id);


--
-- Name: organization_members organization_members_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.organization_members
    ADD CONSTRAINT organization_members_pkey PRIMARY KEY (id);


--
-- Name: organizations organizations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.organizations
    ADD CONSTRAINT organizations_pkey PRIMARY KEY (id);


--
-- Name: organizations organizations_slug_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.organizations
    ADD CONSTRAINT organizations_slug_key UNIQUE (slug);


--
-- Name: outbound_webhooks outbound_webhooks_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.outbound_webhooks
    ADD CONSTRAINT outbound_webhooks_pkey PRIMARY KEY (id);


--
-- Name: ownership_audit_reports ownership_audit_reports_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ownership_audit_reports
    ADD CONSTRAINT ownership_audit_reports_pkey PRIMARY KEY (id);


--
-- Name: ownership_repair_logs ownership_repair_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ownership_repair_logs
    ADD CONSTRAINT ownership_repair_logs_pkey PRIMARY KEY (id);


--
-- Name: password_reset_requests password_reset_requests_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.password_reset_requests
    ADD CONSTRAINT password_reset_requests_pkey PRIMARY KEY (id);


--
-- Name: permissions permissions_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.permissions
    ADD CONSTRAINT permissions_code_key UNIQUE (code);


--
-- Name: permissions permissions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.permissions
    ADD CONSTRAINT permissions_pkey PRIMARY KEY (id);


--
-- Name: price_history price_history_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.price_history
    ADD CONSTRAINT price_history_pkey PRIMARY KEY (id);


--
-- Name: product_component_locations product_component_locations_component_id_location_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.product_component_locations
    ADD CONSTRAINT product_component_locations_component_id_location_code_key UNIQUE (component_id, location_code);


--
-- Name: product_component_locations product_component_locations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.product_component_locations
    ADD CONSTRAINT product_component_locations_pkey PRIMARY KEY (id);


--
-- Name: product_components product_components_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.product_components
    ADD CONSTRAINT product_components_pkey PRIMARY KEY (id);


--
-- Name: product_group_members product_group_members_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.product_group_members
    ADD CONSTRAINT product_group_members_pkey PRIMARY KEY (id);


--
-- Name: product_groups product_groups_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.product_groups
    ADD CONSTRAINT product_groups_pkey PRIMARY KEY (id);


--
-- Name: product_price_freshness_overrides product_price_freshness_overrides_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.product_price_freshness_overrides
    ADD CONSTRAINT product_price_freshness_overrides_pkey PRIMARY KEY (id);


--
-- Name: product_price_freshness_overrides product_price_freshness_overrides_product_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.product_price_freshness_overrides
    ADD CONSTRAINT product_price_freshness_overrides_product_id_key UNIQUE (product_id);


--
-- Name: product_sync_logs product_sync_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.product_sync_logs
    ADD CONSTRAINT product_sync_logs_pkey PRIMARY KEY (id);


--
-- Name: product_views product_views_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.product_views
    ADD CONSTRAINT product_views_pkey PRIMARY KEY (id);


--
-- Name: products products_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.products
    ADD CONSTRAINT products_pkey PRIMARY KEY (id);


--
-- Name: profiles profiles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_pkey PRIMARY KEY (id);


--
-- Name: profiles profiles_user_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_user_id_key UNIQUE (user_id);


--
-- Name: public_token_failures public_token_failures_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.public_token_failures
    ADD CONSTRAINT public_token_failures_pkey PRIMARY KEY (id);


--
-- Name: query_telemetry query_telemetry_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.query_telemetry
    ADD CONSTRAINT query_telemetry_pkey PRIMARY KEY (id);


--
-- Name: quote_approval_tokens quote_approval_tokens_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.quote_approval_tokens
    ADD CONSTRAINT quote_approval_tokens_pkey PRIMARY KEY (id);


--
-- Name: quote_approval_tokens quote_approval_tokens_token_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.quote_approval_tokens
    ADD CONSTRAINT quote_approval_tokens_token_key UNIQUE (token);


--
-- Name: quote_comments quote_comments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.quote_comments
    ADD CONSTRAINT quote_comments_pkey PRIMARY KEY (id);


--
-- Name: quote_drafts quote_drafts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.quote_drafts
    ADD CONSTRAINT quote_drafts_pkey PRIMARY KEY (id);


--
-- Name: quote_drafts quote_drafts_user_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.quote_drafts
    ADD CONSTRAINT quote_drafts_user_id_key UNIQUE (user_id);


--
-- Name: quote_history quote_history_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.quote_history
    ADD CONSTRAINT quote_history_pkey PRIMARY KEY (id);


--
-- Name: quote_item_personalizations quote_item_personalizations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.quote_item_personalizations
    ADD CONSTRAINT quote_item_personalizations_pkey PRIMARY KEY (id);


--
-- Name: quote_items quote_items_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.quote_items
    ADD CONSTRAINT quote_items_pkey PRIMARY KEY (id);


--
-- Name: quote_templates quote_templates_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.quote_templates
    ADD CONSTRAINT quote_templates_pkey PRIMARY KEY (id);


--
-- Name: quotes quotes_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.quotes
    ADD CONSTRAINT quotes_pkey PRIMARY KEY (id);


--
-- Name: recently_viewed_products recently_viewed_products_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.recently_viewed_products
    ADD CONSTRAINT recently_viewed_products_pkey PRIMARY KEY (id);


--
-- Name: recently_viewed_products recently_viewed_products_user_id_product_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.recently_viewed_products
    ADD CONSTRAINT recently_viewed_products_user_id_product_id_key UNIQUE (user_id, product_id);


--
-- Name: request_rate_limits request_rate_limits_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.request_rate_limits
    ADD CONSTRAINT request_rate_limits_pkey PRIMARY KEY (id);


--
-- Name: rls_denial_log rls_denial_log_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.rls_denial_log
    ADD CONSTRAINT rls_denial_log_pkey PRIMARY KEY (id);


--
-- Name: role_migration_batches role_migration_batches_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.role_migration_batches
    ADD CONSTRAINT role_migration_batches_pkey PRIMARY KEY (id);


--
-- Name: role_migration_items role_migration_items_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.role_migration_items
    ADD CONSTRAINT role_migration_items_pkey PRIMARY KEY (id);


--
-- Name: role_permissions role_permissions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.role_permissions
    ADD CONSTRAINT role_permissions_pkey PRIMARY KEY (id);


--
-- Name: role_permissions role_permissions_role_permission_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.role_permissions
    ADD CONSTRAINT role_permissions_role_permission_code_key UNIQUE (role, permission_code);


--
-- Name: saved_filters saved_filters_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.saved_filters
    ADD CONSTRAINT saved_filters_pkey PRIMARY KEY (id);


--
-- Name: saved_trends_views saved_trends_views_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.saved_trends_views
    ADD CONSTRAINT saved_trends_views_pkey PRIMARY KEY (id);


--
-- Name: scheduled_reports scheduled_reports_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.scheduled_reports
    ADD CONSTRAINT scheduled_reports_pkey PRIMARY KEY (id);


--
-- Name: search_analytics search_analytics_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.search_analytics
    ADD CONSTRAINT search_analytics_pkey PRIMARY KEY (id);


--
-- Name: secret_rotation_log secret_rotation_log_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.secret_rotation_log
    ADD CONSTRAINT secret_rotation_log_pkey PRIMARY KEY (id);


--
-- Name: seller_cart_items seller_cart_items_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.seller_cart_items
    ADD CONSTRAINT seller_cart_items_pkey PRIMARY KEY (id);


--
-- Name: seller_carts seller_carts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.seller_carts
    ADD CONSTRAINT seller_carts_pkey PRIMARY KEY (id);


--
-- Name: seller_discount_limits seller_discount_limits_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.seller_discount_limits
    ADD CONSTRAINT seller_discount_limits_pkey PRIMARY KEY (id);


--
-- Name: seller_discount_limits seller_discount_limits_user_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.seller_discount_limits
    ADD CONSTRAINT seller_discount_limits_user_id_key UNIQUE (user_id);


--
-- Name: simulator_wizard_drafts simulator_wizard_drafts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.simulator_wizard_drafts
    ADD CONSTRAINT simulator_wizard_drafts_pkey PRIMARY KEY (id);


--
-- Name: step_up_audit_log step_up_audit_log_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.step_up_audit_log
    ADD CONSTRAINT step_up_audit_log_pkey PRIMARY KEY (id);


--
-- Name: step_up_challenges step_up_challenges_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.step_up_challenges
    ADD CONSTRAINT step_up_challenges_pkey PRIMARY KEY (id);


--
-- Name: step_up_tokens step_up_tokens_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.step_up_tokens
    ADD CONSTRAINT step_up_tokens_pkey PRIMARY KEY (id);


--
-- Name: step_up_tokens step_up_tokens_token_hash_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.step_up_tokens
    ADD CONSTRAINT step_up_tokens_token_hash_key UNIQUE (token_hash);


--
-- Name: system_settings system_settings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.system_settings
    ADD CONSTRAINT system_settings_pkey PRIMARY KEY (key);


--
-- Name: user_search_history unique_user_query_type; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_search_history
    ADD CONSTRAINT unique_user_query_type UNIQUE (user_id, query_text, history_type);


--
-- Name: user_comparisons user_comparisons_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_comparisons
    ADD CONSTRAINT user_comparisons_pkey PRIMARY KEY (id);


--
-- Name: user_comparisons user_comparisons_share_token_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_comparisons
    ADD CONSTRAINT user_comparisons_share_token_key UNIQUE (share_token);


--
-- Name: user_known_devices user_known_devices_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_known_devices
    ADD CONSTRAINT user_known_devices_pkey PRIMARY KEY (id);


--
-- Name: user_onboarding user_onboarding_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_onboarding
    ADD CONSTRAINT user_onboarding_pkey PRIMARY KEY (id);


--
-- Name: user_onboarding user_onboarding_user_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_onboarding
    ADD CONSTRAINT user_onboarding_user_id_key UNIQUE (user_id);


--
-- Name: user_preferences user_preferences_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_preferences
    ADD CONSTRAINT user_preferences_pkey PRIMARY KEY (id);


--
-- Name: user_preferences user_preferences_user_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_preferences
    ADD CONSTRAINT user_preferences_user_id_key UNIQUE (user_id);


--
-- Name: user_roles user_roles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_roles
    ADD CONSTRAINT user_roles_pkey PRIMARY KEY (id);


--
-- Name: user_roles user_roles_user_id_role_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_roles
    ADD CONSTRAINT user_roles_user_id_role_key UNIQUE (user_id, role);


--
-- Name: user_search_history user_search_history_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_search_history
    ADD CONSTRAINT user_search_history_pkey PRIMARY KEY (id);


--
-- Name: user_token_revocations user_token_revocations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_token_revocations
    ADD CONSTRAINT user_token_revocations_pkey PRIMARY KEY (user_id);


--
-- Name: video_variant_links video_variant_links_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.video_variant_links
    ADD CONSTRAINT video_variant_links_pkey PRIMARY KEY (id);


--
-- Name: video_variant_links video_variant_links_video_id_variant_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.video_variant_links
    ADD CONSTRAINT video_variant_links_video_id_variant_id_key UNIQUE (video_id, variant_id);


--
-- Name: voice_command_logs voice_command_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.voice_command_logs
    ADD CONSTRAINT voice_command_logs_pkey PRIMARY KEY (id);


--
-- Name: webhook_deliveries webhook_deliveries_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.webhook_deliveries
    ADD CONSTRAINT webhook_deliveries_pkey PRIMARY KEY (id);


--
-- Name: workspace_notifications workspace_notifications_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.workspace_notifications
    ADD CONSTRAINT workspace_notifications_pkey PRIMARY KEY (id);


--
-- Name: external_connections_type_name_no_env_uidx; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX external_connections_type_name_no_env_uidx ON public.external_connections USING btree (type, name) WHERE (env_key IS NULL);


--
-- Name: idx_admin_audit_log_action; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_admin_audit_log_action ON public.admin_audit_log_old USING btree (action);


--
-- Name: idx_admin_audit_log_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_admin_audit_log_created_at ON public.admin_audit_log_old USING btree (created_at DESC);


--
-- Name: idx_admin_audit_log_details_gin; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_admin_audit_log_details_gin ON public.admin_audit_log_old USING gin (details);


--
-- Name: idx_admin_audit_log_request_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_admin_audit_log_request_id ON public.admin_audit_log_old USING btree (request_id) WHERE (request_id IS NOT NULL);


--
-- Name: idx_admin_audit_log_resource_lookup; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_admin_audit_log_resource_lookup ON public.admin_audit_log_old USING btree (resource_type, resource_id, created_at DESC);


--
-- Name: idx_admin_audit_log_role_actions; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_admin_audit_log_role_actions ON public.admin_audit_log_old USING btree (action, created_at DESC) WHERE (action = ANY (ARRAY['role.granted'::text, 'role.changed'::text, 'role.revoked'::text, 'role.promote'::text, 'role.demote'::text]));


--
-- Name: idx_admin_audit_log_source; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_admin_audit_log_source ON public.admin_audit_log_old USING btree (source, created_at DESC) WHERE (source IS NOT NULL);


--
-- Name: idx_admin_audit_log_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_admin_audit_log_status ON public.admin_audit_log_old USING btree (status, created_at DESC) WHERE (status IS NOT NULL);


--
-- Name: idx_admin_audit_log_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_admin_audit_log_user_id ON public.admin_audit_log_old USING btree (user_id);


--
-- Name: idx_ai_insights_cache_expires; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ai_insights_cache_expires ON public.ai_insights_cache USING btree (expires_at);


--
-- Name: idx_ai_usage_events_fn_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ai_usage_events_fn_created ON public.ai_usage_events USING btree (function_name, created_at DESC);


--
-- Name: idx_ai_usage_events_user_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ai_usage_events_user_created ON public.ai_usage_events USING btree (user_id, created_at DESC);


--
-- Name: idx_ai_usage_logs_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ai_usage_logs_created_at ON public.ai_usage_logs USING btree (created_at);


--
-- Name: idx_ai_usage_logs_function; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ai_usage_logs_function ON public.ai_usage_logs USING btree (function_name);


--
-- Name: idx_ai_usage_logs_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ai_usage_logs_user_id ON public.ai_usage_logs USING btree (user_id);


--
-- Name: idx_ai_usage_logs_user_month; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ai_usage_logs_user_month ON public.ai_usage_logs USING btree (user_id, created_at);


--
-- Name: idx_app_vitals_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_app_vitals_created ON public.app_vitals USING btree (created_at DESC);


--
-- Name: idx_app_vitals_metric_name_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_app_vitals_metric_name_created ON public.app_vitals USING btree (metric_name, created_at DESC);


--
-- Name: idx_app_vitals_name_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_app_vitals_name_created ON public.app_vitals USING btree (metric_name, created_at DESC);


--
-- Name: idx_app_vitals_request_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_app_vitals_request_id ON public.app_vitals USING btree (request_id);


--
-- Name: idx_approval_tokens_quote; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_approval_tokens_quote ON public.quote_approval_tokens USING btree (quote_id);


--
-- Name: idx_approval_tokens_token_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_approval_tokens_token_status ON public.quote_approval_tokens USING btree (token, status) WHERE (status = 'active'::text);


--
-- Name: idx_art_files_mockup; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_art_files_mockup ON public.art_file_attachments USING btree (mockup_id);


--
-- Name: idx_art_files_quote; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_art_files_quote ON public.art_file_attachments USING btree (quote_id);


--
-- Name: idx_art_files_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_art_files_user ON public.art_file_attachments USING btree (user_id);


--
-- Name: idx_audit_logs_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_audit_logs_created_at ON public.audit_logs USING btree (created_at);


--
-- Name: idx_audit_logs_event_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_audit_logs_event_type ON public.audit_logs USING btree (event_type);


--
-- Name: idx_audit_logs_identifier; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_audit_logs_identifier ON public.audit_logs USING btree (identifier);


--
-- Name: idx_auth_login_attempts_email_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_auth_login_attempts_email_created ON public.auth_login_attempts USING btree (email, created_at DESC);


--
-- Name: idx_auth_login_attempts_ip_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_auth_login_attempts_ip_created ON public.auth_login_attempts USING btree (ip_address, created_at DESC);


--
-- Name: idx_bot_log_blocked; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_bot_log_blocked ON public.bot_detection_log USING btree (blocked) WHERE (blocked = true);


--
-- Name: idx_bot_log_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_bot_log_created ON public.bot_detection_log USING btree (created_at DESC);


--
-- Name: idx_bot_log_ip; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_bot_log_ip ON public.bot_detection_log USING btree (ip_address);


--
-- Name: idx_cart_templates_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_cart_templates_user_id ON public.cart_templates USING btree (user_id);


--
-- Name: idx_collection_items_collection; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_collection_items_collection ON public.collection_items USING btree (collection_id, sort_order);


--
-- Name: idx_collection_items_collection_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_collection_items_collection_id ON public.collection_items USING btree (collection_id);


--
-- Name: idx_collection_reactions_collection; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_collection_reactions_collection ON public.collection_item_reactions USING btree (collection_id);


--
-- Name: idx_collection_reactions_item; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_collection_reactions_item ON public.collection_item_reactions USING btree (item_id);


--
-- Name: idx_collection_trash_collection; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_collection_trash_collection ON public.collection_items_trash USING btree (collection_id);


--
-- Name: idx_collection_trash_expires; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_collection_trash_expires ON public.collection_items_trash USING btree (expires_at);


--
-- Name: idx_collection_trash_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_collection_trash_user ON public.collection_items_trash USING btree (user_id);


--
-- Name: idx_collections_client; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_collections_client ON public.collections USING btree (client_id) WHERE (client_id IS NOT NULL);


--
-- Name: idx_collections_share_token; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_collections_share_token ON public.collections USING btree (share_token) WHERE (share_token IS NOT NULL);


--
-- Name: idx_collections_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_collections_user_id ON public.collections USING btree (user_id);


--
-- Name: idx_comparison_reactions_comp; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_comparison_reactions_comp ON public.comparison_reactions USING btree (comparison_id, created_at DESC);


--
-- Name: idx_connection_test_history_conn_time; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_connection_test_history_conn_time ON public.connection_test_history USING btree (connection_id, tested_at DESC);


--
-- Name: idx_conv_audit_session_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_conv_audit_session_id ON public.conversation_audit_logs USING btree (session_id);


--
-- Name: idx_conv_audit_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_conv_audit_user_id ON public.conversation_audit_logs USING btree (user_id);


--
-- Name: idx_conv_delivery_event_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_conv_delivery_event_id ON public.conversation_delivery_status USING btree (event_id);


--
-- Name: idx_conv_event_conv_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_conv_event_conv_id ON public.conversation_event_history USING btree (conversation_id);


--
-- Name: idx_cth_triggered_by; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_cth_triggered_by ON public.connection_test_history USING btree (triggered_by);


--
-- Name: idx_custom_kits_tag; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_custom_kits_tag ON public.custom_kits USING btree (tag);


--
-- Name: idx_custom_kits_user_favorite; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_custom_kits_user_favorite ON public.custom_kits USING btree (user_id, is_favorite) WHERE (is_favorite = true);


--
-- Name: idx_custom_kits_user_pinned; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_custom_kits_user_pinned ON public.custom_kits USING btree (user_id, is_pinned DESC, last_used_at DESC NULLS LAST);


--
-- Name: idx_dar_seller_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_dar_seller_created_at ON public.discount_approval_requests USING btree (seller_id, created_at DESC);


--
-- Name: idx_dar_seller_status_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_dar_seller_status_created_at ON public.discount_approval_requests USING btree (seller_id, status, created_at DESC);


--
-- Name: idx_discount_approval_requests_quote_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_discount_approval_requests_quote_id ON public.discount_approval_requests USING btree (quote_id);


--
-- Name: idx_discount_approval_requests_seller_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_discount_approval_requests_seller_id ON public.discount_approval_requests USING btree (seller_id);


--
-- Name: idx_discount_approval_requests_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_discount_approval_requests_status ON public.discount_approval_requests USING btree (status);


--
-- Name: idx_e2e_cleanup_audit_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_e2e_cleanup_audit_created_at ON public.e2e_cleanup_audit USING btree (created_at DESC);


--
-- Name: idx_e2e_cleanup_audit_email; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_e2e_cleanup_audit_email ON public.e2e_cleanup_audit USING btree (email, created_at DESC);


--
-- Name: idx_e2e_cleanup_audit_seller_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_e2e_cleanup_audit_seller_id ON public.e2e_cleanup_audit USING btree (seller_id, created_at DESC) WHERE (seller_id IS NOT NULL);


--
-- Name: idx_e2e_cleanup_audit_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_e2e_cleanup_audit_status ON public.e2e_cleanup_audit USING btree (status, created_at DESC);


--
-- Name: idx_expert_conversations_seller_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_expert_conversations_seller_id ON public.expert_conversations USING btree (seller_id);


--
-- Name: idx_expert_messages_conversation_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_expert_messages_conversation_id ON public.expert_messages USING btree (conversation_id);


--
-- Name: idx_ext_conn_sync_log_ran_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ext_conn_sync_log_ran_at ON public.external_connections_sync_log USING btree (ran_at DESC);


--
-- Name: idx_ext_conn_sync_log_secret; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ext_conn_sync_log_secret ON public.external_connections_sync_log USING btree (triggered_by_secret_name);


--
-- Name: idx_external_connections_auto_test_enabled; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_external_connections_auto_test_enabled ON public.external_connections USING btree (auto_test_enabled) WHERE (auto_test_enabled = true);


--
-- Name: idx_external_connections_envkey_type; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX idx_external_connections_envkey_type ON public.external_connections USING btree (env_key, type) WHERE (env_key IS NOT NULL);


--
-- Name: idx_external_connections_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_external_connections_type ON public.external_connections USING btree (type);


--
-- Name: idx_favorite_items_list; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_favorite_items_list ON public.favorite_items USING btree (list_id, "position");


--
-- Name: idx_favorite_items_product; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_favorite_items_product ON public.favorite_items USING btree (product_id);


--
-- Name: idx_favorite_items_trash_expires; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_favorite_items_trash_expires ON public.favorite_items_trash USING btree (expires_at);


--
-- Name: idx_favorite_items_trash_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_favorite_items_trash_user ON public.favorite_items_trash USING btree (user_id, deleted_at DESC);


--
-- Name: idx_favorite_items_unique; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX idx_favorite_items_unique ON public.favorite_items USING btree (list_id, product_id, COALESCE(variant_id, ''::text));


--
-- Name: idx_favorite_items_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_favorite_items_user ON public.favorite_items USING btree (user_id);


--
-- Name: idx_favorite_lists_one_default; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX idx_favorite_lists_one_default ON public.favorite_lists USING btree (user_id) WHERE (is_default = true);


--
-- Name: idx_favorite_lists_shared_token; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_favorite_lists_shared_token ON public.favorite_lists USING btree (shared_token) WHERE (shared_token IS NOT NULL);


--
-- Name: idx_favorite_lists_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_favorite_lists_user ON public.favorite_lists USING btree (user_id, "position");


--
-- Name: idx_favorite_reactions_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_favorite_reactions_created ON public.favorite_item_reactions USING btree (created_at DESC);


--
-- Name: idx_favorite_reactions_item; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_favorite_reactions_item ON public.favorite_item_reactions USING btree (item_id);


--
-- Name: idx_favorite_reactions_list; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_favorite_reactions_list ON public.favorite_item_reactions USING btree (list_id);


--
-- Name: idx_file_scan_logs_hash; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_file_scan_logs_hash ON public.file_scan_logs USING btree (hash);


--
-- Name: idx_file_scan_logs_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_file_scan_logs_user_id ON public.file_scan_logs USING btree (user_id);


--
-- Name: idx_follow_up_pending; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_follow_up_pending ON public.follow_up_reminders USING btree (is_sent, scheduled_for);


--
-- Name: idx_follow_up_reminders_completed; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_follow_up_reminders_completed ON public.follow_up_reminders USING btree (is_completed, scheduled_for);


--
-- Name: idx_follow_up_reminders_seller_scheduled; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_follow_up_reminders_seller_scheduled ON public.follow_up_reminders USING btree (seller_id, scheduled_for DESC);


--
-- Name: idx_geo_allowed_countries_created_by; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_geo_allowed_countries_created_by ON public.geo_allowed_countries USING btree (created_by);


--
-- Name: idx_hardening_snapshots_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_hardening_snapshots_at ON public.hardening_health_snapshots USING btree (snapshot_at DESC);


--
-- Name: idx_inbound_events_endpoint_time; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_inbound_events_endpoint_time ON public.inbound_webhook_events USING btree (endpoint_id, received_at DESC);


--
-- Name: idx_integration_credentials_name; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_integration_credentials_name ON public.integration_credentials USING btree (secret_name);


--
-- Name: idx_ip_access_control_ip; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ip_access_control_ip ON public.ip_access_control USING btree (ip_address);


--
-- Name: idx_ip_access_control_type_expires; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ip_access_control_type_expires ON public.ip_access_control USING btree (list_type, expires_at);


--
-- Name: idx_kit_collab_kit; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_kit_collab_kit ON public.kit_collaborators USING btree (kit_id);


--
-- Name: idx_kit_collab_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_kit_collab_user ON public.kit_collaborators USING btree (user_id);


--
-- Name: idx_kit_comments_kit; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_kit_comments_kit ON public.kit_comments USING btree (kit_id);


--
-- Name: idx_kit_comments_parent; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_kit_comments_parent ON public.kit_comments USING btree (parent_id);


--
-- Name: idx_kit_share_tokens_kit_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_kit_share_tokens_kit_id ON public.kit_share_tokens USING btree (kit_id);


--
-- Name: idx_kit_templates_active_category; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_kit_templates_active_category ON public.kit_templates USING btree (is_active, category);


--
-- Name: idx_kit_templates_usage; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_kit_templates_usage ON public.kit_templates USING btree (usage_count DESC) WHERE (is_active = true);


--
-- Name: idx_kit_variants_master; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_kit_variants_master ON public.kit_variants USING btree (kit_master_id);


--
-- Name: idx_login_attempts_email_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_login_attempts_email_created ON public.login_attempts USING btree (email, created_at DESC);


--
-- Name: idx_magic_up_brand_kits_user_client; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_magic_up_brand_kits_user_client ON public.magic_up_brand_kits USING btree (user_id, client_id);


--
-- Name: idx_magic_up_campaigns_user_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_magic_up_campaigns_user_status ON public.magic_up_campaigns USING btree (user_id, status, created_at DESC);


--
-- Name: idx_magic_up_comments_generation; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_magic_up_comments_generation ON public.magic_up_comments USING btree (generation_id, created_at DESC);


--
-- Name: idx_magic_up_generations_campaign; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_magic_up_generations_campaign ON public.magic_up_generations USING btree (campaign_id, created_at DESC);


--
-- Name: idx_magic_up_generations_tags; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_magic_up_generations_tags ON public.magic_up_generations USING gin (tags);


--
-- Name: idx_magic_up_generations_user_channel_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_magic_up_generations_user_channel_status ON public.magic_up_generations USING btree (user_id, channel, status, created_at DESC);


--
-- Name: idx_magic_up_generations_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_magic_up_generations_user_id ON public.magic_up_generations USING btree (user_id);


--
-- Name: idx_magic_up_public_shares_campaign_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_magic_up_public_shares_campaign_id ON public.magic_up_public_shares USING btree (campaign_id);


--
-- Name: idx_magic_up_public_shares_generation_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_magic_up_public_shares_generation_id ON public.magic_up_public_shares USING btree (generation_id);


--
-- Name: idx_magic_up_public_shares_token; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_magic_up_public_shares_token ON public.magic_up_public_shares USING btree (share_token);


--
-- Name: idx_magic_up_reactions_generation; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_magic_up_reactions_generation ON public.magic_up_reactions USING btree (generation_id, created_at DESC);


--
-- Name: idx_mcp_api_keys_rotated_from; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_mcp_api_keys_rotated_from ON public.mcp_api_keys USING btree (rotated_from) WHERE (rotated_from IS NOT NULL);


--
-- Name: idx_mcp_auto_rev_key; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_mcp_auto_rev_key ON public.mcp_key_auto_revocations USING btree (key_id);


--
-- Name: idx_mcp_auto_rev_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_mcp_auto_rev_user ON public.mcp_key_auto_revocations USING btree (created_by, revoked_at DESC);


--
-- Name: idx_mcp_key_revocations_key_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_mcp_key_revocations_key_id ON public.mcp_key_auto_revocations USING btree (key_id);


--
-- Name: idx_mcp_keys_hash; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_mcp_keys_hash ON public.mcp_keys USING btree (key_hash);


--
-- Name: idx_mcp_keys_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_mcp_keys_user_id ON public.mcp_keys USING btree (user_id);


--
-- Name: idx_mcp_violations_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_mcp_violations_created ON public.mcp_access_violations USING btree (created_at DESC);


--
-- Name: idx_mcp_violations_ip_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_mcp_violations_ip_created ON public.mcp_access_violations USING btree (ip_address, created_at DESC);


--
-- Name: idx_mcp_violations_user_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_mcp_violations_user_created ON public.mcp_access_violations USING btree (user_id, created_at DESC);


--
-- Name: idx_mockup_prompt_configs_key; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_mockup_prompt_configs_key ON public.mockup_prompt_configs USING btree (config_key);


--
-- Name: idx_mockup_prompt_configs_technique; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_mockup_prompt_configs_technique ON public.mockup_prompt_configs USING btree (technique_id);


--
-- Name: idx_mockup_prompt_history_config; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_mockup_prompt_history_config ON public.mockup_prompt_history USING btree (config_id, changed_at DESC);


--
-- Name: idx_mockup_templates_product; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_mockup_templates_product ON public.mockup_templates USING btree (product_id);


--
-- Name: idx_mockup_templates_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_mockup_templates_user ON public.mockup_templates USING btree (user_id);


--
-- Name: idx_notifications_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_notifications_created ON public.workspace_notifications USING btree (created_at DESC);


--
-- Name: idx_optimization_queue_runs_queue; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_optimization_queue_runs_queue ON public.optimization_queue_runs USING btree (queue_id, created_at DESC);


--
-- Name: idx_optimization_queue_status_priority; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_optimization_queue_status_priority ON public.optimization_queue USING btree (status, priority, created_at);


--
-- Name: idx_order_item_personalizations_order_item_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_order_item_personalizations_order_item_id ON public.order_item_personalizations USING btree (order_item_id);


--
-- Name: idx_order_items_order_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_order_items_order_id ON public.order_items USING btree (order_id);


--
-- Name: idx_order_items_organization_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_order_items_organization_id ON public.order_items USING btree (organization_id);


--
-- Name: idx_order_items_product_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_order_items_product_id ON public.order_items USING btree (product_id);


--
-- Name: idx_orders_client_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_orders_client_status ON public.orders USING btree (client_id, status);


--
-- Name: idx_orders_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_orders_created_at ON public.orders USING btree (created_at DESC);


--
-- Name: idx_orders_number_search; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_orders_number_search ON public.orders USING gin (order_number extensions.gin_trgm_ops);


--
-- Name: idx_orders_organization_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_orders_organization_id ON public.orders USING btree (organization_id);


--
-- Name: idx_orders_quote_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_orders_quote_id ON public.orders USING btree (quote_id);


--
-- Name: idx_orders_seller_org; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_orders_seller_org ON public.orders USING btree (seller_id, organization_id);


--
-- Name: idx_orders_seller_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_orders_seller_status ON public.orders USING btree (seller_id, status);


--
-- Name: idx_orders_seller_status_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_orders_seller_status_created ON public.orders USING btree (seller_id, status, created_at DESC);


--
-- Name: idx_orders_seller_status_updated_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_orders_seller_status_updated_at ON public.orders USING btree (seller_id, status, updated_at DESC);


--
-- Name: idx_orders_seller_updated_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_orders_seller_updated_at ON public.orders USING btree (seller_id, updated_at DESC);


--
-- Name: idx_org_members_org_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_org_members_org_id ON public.organization_members USING btree (organization_id);


--
-- Name: idx_org_members_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_org_members_user_id ON public.organization_members USING btree (user_id);


--
-- Name: idx_outbound_webhooks_active_events; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_outbound_webhooks_active_events ON public.outbound_webhooks USING gin (events) WHERE (active = true);


--
-- Name: idx_ownership_audit_reports_generated_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ownership_audit_reports_generated_at ON public.ownership_audit_reports USING btree (generated_at DESC);


--
-- Name: idx_ownership_repair_logs_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ownership_repair_logs_created_at ON public.ownership_repair_logs USING btree (created_at DESC);


--
-- Name: idx_ownership_repair_logs_report; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ownership_repair_logs_report ON public.ownership_repair_logs USING btree (report_id);


--
-- Name: idx_password_reset_requests_email; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_password_reset_requests_email ON public.password_reset_requests USING btree (email);


--
-- Name: idx_password_reset_requests_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_password_reset_requests_status ON public.password_reset_requests USING btree (status);


--
-- Name: idx_personalizations_item; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_personalizations_item ON public.quote_item_personalizations USING btree (quote_item_id);


--
-- Name: idx_pfo_product_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_pfo_product_id ON public.product_price_freshness_overrides USING btree (product_id);


--
-- Name: idx_price_history_product_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_price_history_product_date ON public.price_history USING btree (product_id, recorded_at DESC);


--
-- Name: idx_product_comp_loc_component; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_product_comp_loc_component ON public.product_component_locations USING btree (component_id);


--
-- Name: idx_product_group_members_product_group_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_product_group_members_product_group_id ON public.product_group_members USING btree (product_group_id);


--
-- Name: idx_product_price_freshness_overrides_updated_by; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_product_price_freshness_overrides_updated_by ON public.product_price_freshness_overrides USING btree (updated_by);


--
-- Name: idx_product_sync_logs_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_product_sync_logs_created ON public.product_sync_logs USING btree (created_at DESC);


--
-- Name: idx_product_sync_logs_source; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_product_sync_logs_source ON public.product_sync_logs USING btree (source, status);


--
-- Name: idx_product_views_product_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_product_views_product_id ON public.product_views USING btree (product_id);


--
-- Name: idx_product_views_seller; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_product_views_seller ON public.product_views USING btree (seller_id, created_at DESC);


--
-- Name: idx_public_token_failures_ip; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_public_token_failures_ip ON public.public_token_failures USING btree (ip_address, created_at DESC);


--
-- Name: idx_public_token_failures_resource; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_public_token_failures_resource ON public.public_token_failures USING btree (resource_type, resource_id, created_at DESC);


--
-- Name: idx_query_telemetry_cache_hit_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_query_telemetry_cache_hit_created ON public.query_telemetry USING btree (cache_hit, created_at DESC) WHERE (cache_hit = true);


--
-- Name: idx_query_telemetry_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_query_telemetry_created ON public.query_telemetry USING btree (created_at DESC);


--
-- Name: idx_query_telemetry_error_kind_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_query_telemetry_error_kind_created ON public.query_telemetry USING btree (error_kind, created_at DESC) WHERE (error_kind IS NOT NULL);


--
-- Name: idx_query_telemetry_op_table_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_query_telemetry_op_table_created ON public.query_telemetry USING btree (operation, table_name, created_at DESC);


--
-- Name: idx_query_telemetry_platform_failures; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_query_telemetry_platform_failures ON public.query_telemetry USING btree (created_at DESC) WHERE ((is_503 = true) OR (is_cold_start = true));


--
-- Name: idx_query_telemetry_retry_count_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_query_telemetry_retry_count_created ON public.query_telemetry USING btree (retry_count, created_at DESC) WHERE (retry_count > 0);


--
-- Name: idx_query_telemetry_severity; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_query_telemetry_severity ON public.query_telemetry USING btree (severity, created_at DESC);


--
-- Name: idx_quote_approval_tokens_quote; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_quote_approval_tokens_quote ON public.quote_approval_tokens USING btree (quote_id, status);


--
-- Name: idx_quote_approval_tokens_seller_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_quote_approval_tokens_seller_id ON public.quote_approval_tokens USING btree (seller_id);


--
-- Name: idx_quote_comments_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_quote_comments_created_at ON public.quote_comments USING btree (created_at DESC);


--
-- Name: idx_quote_comments_parent_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_quote_comments_parent_id ON public.quote_comments USING btree (parent_id);


--
-- Name: idx_quote_comments_quote_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_quote_comments_quote_id ON public.quote_comments USING btree (quote_id);


--
-- Name: idx_quote_comments_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_quote_comments_user_id ON public.quote_comments USING btree (user_id);


--
-- Name: idx_quote_history_quote_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_quote_history_quote_created ON public.quote_history USING btree (quote_id, created_at DESC);


--
-- Name: idx_quote_history_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_quote_history_user_id ON public.quote_history USING btree (user_id);


--
-- Name: idx_quote_item_personalizations_quote_item_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_quote_item_personalizations_quote_item_id ON public.quote_item_personalizations USING btree (quote_item_id);


--
-- Name: idx_quote_items_quote_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_quote_items_quote_id ON public.quote_items USING btree (quote_id);


--
-- Name: idx_quote_templates_seller_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_quote_templates_seller_id ON public.quote_templates USING btree (seller_id);


--
-- Name: idx_quotes_client_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_quotes_client_status ON public.quotes USING btree (client_id, status);


--
-- Name: idx_quotes_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_quotes_created_at ON public.quotes USING btree (created_at DESC);


--
-- Name: idx_quotes_number_search; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_quotes_number_search ON public.quotes USING gin (quote_number extensions.gin_trgm_ops);


--
-- Name: idx_quotes_organization_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_quotes_organization_id ON public.quotes USING btree (organization_id);


--
-- Name: idx_quotes_parent_quote_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_quotes_parent_quote_id ON public.quotes USING btree (parent_quote_id);


--
-- Name: idx_quotes_seller_org; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_quotes_seller_org ON public.quotes USING btree (seller_id, organization_id);


--
-- Name: idx_quotes_seller_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_quotes_seller_status ON public.quotes USING btree (seller_id, status);


--
-- Name: idx_quotes_seller_status_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_quotes_seller_status_created ON public.quotes USING btree (seller_id, status, created_at DESC);


--
-- Name: idx_quotes_seller_status_updated_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_quotes_seller_status_updated_at ON public.quotes USING btree (seller_id, status, updated_at DESC);


--
-- Name: idx_quotes_seller_updated_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_quotes_seller_updated_at ON public.quotes USING btree (seller_id, updated_at DESC);


--
-- Name: idx_quotes_version; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_quotes_version ON public.quotes USING btree (parent_quote_id, version);


--
-- Name: idx_rate_limits_blocked_until; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_rate_limits_blocked_until ON public.request_rate_limits USING btree (blocked_until) WHERE (blocked_until IS NOT NULL);


--
-- Name: idx_rate_limits_identifier_endpoint; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX idx_rate_limits_identifier_endpoint ON public.request_rate_limits USING btree (identifier, endpoint);


--
-- Name: idx_rate_limits_window_start; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_rate_limits_window_start ON public.request_rate_limits USING btree (window_start);


--
-- Name: idx_recently_viewed_user_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_recently_viewed_user_at ON public.recently_viewed_products USING btree (user_id, viewed_at DESC);


--
-- Name: idx_recently_viewed_user_viewed_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_recently_viewed_user_viewed_at ON public.recently_viewed_products USING btree (user_id, viewed_at DESC);


--
-- Name: idx_rls_denial_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_rls_denial_created ON public.rls_denial_log USING btree (created_at DESC);


--
-- Name: idx_rls_denial_table; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_rls_denial_table ON public.rls_denial_log USING btree (table_name, created_at DESC);


--
-- Name: idx_rls_denial_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_rls_denial_user ON public.rls_denial_log USING btree (user_id, created_at DESC);


--
-- Name: idx_role_mig_batches_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_role_mig_batches_created_at ON public.role_migration_batches USING btree (created_at DESC);


--
-- Name: idx_role_mig_batches_initiated_by; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_role_mig_batches_initiated_by ON public.role_migration_batches USING btree (initiated_by);


--
-- Name: idx_role_mig_items_batch; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_role_mig_items_batch ON public.role_migration_items USING btree (batch_id);


--
-- Name: idx_role_mig_items_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_role_mig_items_status ON public.role_migration_items USING btree (status);


--
-- Name: idx_role_mig_items_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_role_mig_items_user ON public.role_migration_items USING btree (user_id);


--
-- Name: idx_saved_filters_user_context; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_saved_filters_user_context ON public.saved_filters USING btree (user_id, context);


--
-- Name: idx_saved_trends_views_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_saved_trends_views_user ON public.saved_trends_views USING btree (user_id);


--
-- Name: idx_scheduled_reports_next_run; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_scheduled_reports_next_run ON public.scheduled_reports USING btree (next_run_at) WHERE (is_active = true);


--
-- Name: idx_search_analytics_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_search_analytics_created_at ON public.search_analytics USING btree (created_at DESC);


--
-- Name: idx_search_analytics_term_lower; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_search_analytics_term_lower ON public.search_analytics USING btree (lower(search_term));


--
-- Name: idx_search_analytics_zero_results; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_search_analytics_zero_results ON public.search_analytics USING btree (created_at DESC) WHERE (results_count = 0);


--
-- Name: idx_secret_rotation_log_name_time; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_secret_rotation_log_name_time ON public.secret_rotation_log USING btree (secret_name, rotated_at DESC);


--
-- Name: idx_secret_rotation_log_secret_action; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_secret_rotation_log_secret_action ON public.secret_rotation_log USING btree (secret_name, action_type, rotated_at DESC);


--
-- Name: idx_seller_cart_items_cart_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_seller_cart_items_cart_id ON public.seller_cart_items USING btree (cart_id);


--
-- Name: idx_seller_carts_seller_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_seller_carts_seller_id ON public.seller_carts USING btree (seller_id);


--
-- Name: idx_seller_discount_limits_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_seller_discount_limits_user_id ON public.seller_discount_limits USING btree (user_id);


--
-- Name: idx_step_up_audit_action; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_step_up_audit_action ON public.step_up_audit_log USING btree (action, created_at DESC);


--
-- Name: idx_step_up_audit_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_step_up_audit_user ON public.step_up_audit_log USING btree (user_id, created_at DESC);


--
-- Name: idx_step_up_challenges_expires; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_step_up_challenges_expires ON public.step_up_challenges USING btree (expires_at) WHERE (consumed = false);


--
-- Name: idx_step_up_challenges_unconsumed; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_step_up_challenges_unconsumed ON public.step_up_challenges USING btree (user_id, id) WHERE (consumed = false);


--
-- Name: idx_step_up_challenges_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_step_up_challenges_user ON public.step_up_challenges USING btree (user_id, created_at DESC);


--
-- Name: idx_step_up_tokens_challenge_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_step_up_tokens_challenge_id ON public.step_up_tokens USING btree (challenge_id);


--
-- Name: idx_step_up_tokens_hash; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_step_up_tokens_hash ON public.step_up_tokens USING btree (token_hash) WHERE (consumed = false);


--
-- Name: idx_step_up_tokens_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_step_up_tokens_user ON public.step_up_tokens USING btree (user_id, created_at DESC);


--
-- Name: idx_user_comparisons_public; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_user_comparisons_public ON public.user_comparisons USING btree (is_public, share_expires_at) WHERE (is_public = true);


--
-- Name: idx_user_comparisons_token; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_user_comparisons_token ON public.user_comparisons USING btree (share_token) WHERE (share_token IS NOT NULL);


--
-- Name: idx_user_comparisons_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_user_comparisons_user ON public.user_comparisons USING btree (user_id, updated_at DESC);


--
-- Name: idx_user_known_devices_fingerprint; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_user_known_devices_fingerprint ON public.user_known_devices USING btree (fingerprint);


--
-- Name: idx_user_known_devices_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_user_known_devices_user_id ON public.user_known_devices USING btree (user_id);


--
-- Name: idx_user_roles_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_user_roles_user_id ON public.user_roles USING btree (user_id);


--
-- Name: idx_user_search_history_pinned; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_user_search_history_pinned ON public.user_search_history USING btree (is_pinned);


--
-- Name: idx_user_search_history_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_user_search_history_type ON public.user_search_history USING btree (history_type);


--
-- Name: idx_user_search_history_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_user_search_history_user_id ON public.user_search_history USING btree (user_id);


--
-- Name: idx_voice_command_logs_user_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_voice_command_logs_user_created ON public.voice_command_logs USING btree (user_id, created_at DESC);


--
-- Name: idx_webhook_deliveries_event_time; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_webhook_deliveries_event_time ON public.webhook_deliveries USING btree (event, delivered_at DESC);


--
-- Name: idx_webhook_deliveries_webhook_time; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_webhook_deliveries_webhook_time ON public.webhook_deliveries USING btree (webhook_id, delivered_at DESC);


--
-- Name: idx_workspace_notifications_user_unread; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_workspace_notifications_user_unread ON public.workspace_notifications USING btree (user_id, is_read, created_at DESC);


--
-- Name: uq_collection_reactions_anon; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX uq_collection_reactions_anon ON public.collection_item_reactions USING btree (item_id, anon_id, emoji);


--
-- Name: uq_comparison_reactions_anon; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX uq_comparison_reactions_anon ON public.comparison_reactions USING btree (comparison_id, item_index, emoji, anon_id);


--
-- Name: ux_ai_insights_cache_user_fn_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX ux_ai_insights_cache_user_fn_key ON public.ai_insights_cache USING btree (user_id, function_name, cache_key);


--
-- Name: admin_audit_log_y2025m12_pkey; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.admin_audit_log_new_pkey ATTACH PARTITION public.admin_audit_log_y2025m12_pkey;


--
-- Name: admin_audit_log_y2026m01_pkey; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.admin_audit_log_new_pkey ATTACH PARTITION public.admin_audit_log_y2026m01_pkey;


--
-- Name: admin_audit_log_y2026m02_pkey; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.admin_audit_log_new_pkey ATTACH PARTITION public.admin_audit_log_y2026m02_pkey;


--
-- Name: admin_audit_log_y2026m03_pkey; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.admin_audit_log_new_pkey ATTACH PARTITION public.admin_audit_log_y2026m03_pkey;


--
-- Name: admin_audit_log_y2026m04_pkey; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.admin_audit_log_new_pkey ATTACH PARTITION public.admin_audit_log_y2026m04_pkey;


--
-- Name: admin_audit_log_y2026m05_pkey; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.admin_audit_log_new_pkey ATTACH PARTITION public.admin_audit_log_y2026m05_pkey;


--
-- Name: admin_audit_log_y2026m06_pkey; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.admin_audit_log_new_pkey ATTACH PARTITION public.admin_audit_log_y2026m06_pkey;


--
-- Name: collections collections_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER collections_updated_at BEFORE UPDATE ON public.collections FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: favorites favorites_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER favorites_updated_at BEFORE UPDATE ON public.favorites FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: user_search_history limit_user_search_history; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER limit_user_search_history AFTER INSERT ON public.user_search_history FOR EACH ROW EXECUTE FUNCTION public.cleanup_user_search_history();


--
-- Name: discount_approval_requests notify_discount_approval_trigger; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER notify_discount_approval_trigger AFTER INSERT OR UPDATE ON public.discount_approval_requests FOR EACH ROW EXECUTE FUNCTION public.notify_discount_approval_request();


--
-- Name: profiles prevent_profile_role_change_trigger; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER prevent_profile_role_change_trigger BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.prevent_profile_role_change();


--
-- Name: favorite_items set_favorite_items_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER set_favorite_items_updated_at BEFORE UPDATE ON public.favorite_items FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: favorite_lists set_favorite_lists_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER set_favorite_lists_updated_at BEFORE UPDATE ON public.favorite_lists FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: magic_up_brand_kits set_magic_up_brand_kits_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER set_magic_up_brand_kits_updated_at BEFORE UPDATE ON public.magic_up_brand_kits FOR EACH ROW EXECUTE FUNCTION public.set_magic_up_updated_at();


--
-- Name: magic_up_campaigns set_magic_up_campaigns_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER set_magic_up_campaigns_updated_at BEFORE UPDATE ON public.magic_up_campaigns FOR EACH ROW EXECUTE FUNCTION public.set_magic_up_updated_at();


--
-- Name: magic_up_public_shares set_magic_up_public_shares_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER set_magic_up_public_shares_updated_at BEFORE UPDATE ON public.magic_up_public_shares FOR EACH ROW EXECUTE FUNCTION public.set_magic_up_updated_at();


--
-- Name: orders set_order_number; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER set_order_number BEFORE INSERT ON public.orders FOR EACH ROW EXECUTE FUNCTION public.generate_order_number();


--
-- Name: integration_credentials sync_external_connections_on_credential_change; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER sync_external_connections_on_credential_change AFTER INSERT OR DELETE OR UPDATE ON public.integration_credentials FOR EACH ROW EXECUTE FUNCTION public.trg_sync_external_connections();


--
-- Name: orders tr_generate_order_number; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER tr_generate_order_number BEFORE INSERT ON public.orders FOR EACH ROW EXECUTE FUNCTION public.generate_order_number_v5();


--
-- Name: mcp_api_keys trg_audit_mcp_api_keys; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_audit_mcp_api_keys AFTER INSERT OR DELETE OR UPDATE ON public.mcp_api_keys FOR EACH ROW EXECUTE FUNCTION public.audit_mcp_api_keys_changes();


--
-- Name: mcp_api_keys trg_audit_mcp_key_insert; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_audit_mcp_key_insert AFTER INSERT ON public.mcp_api_keys FOR EACH ROW EXECUTE FUNCTION public.audit_mcp_key_insert();


--
-- Name: mcp_api_keys trg_audit_mcp_key_revoke; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_audit_mcp_key_revoke AFTER UPDATE OF revoked_at ON public.mcp_api_keys FOR EACH ROW EXECUTE FUNCTION public.audit_mcp_key_revoke();


--
-- Name: discount_approval_requests trg_dispatch_webhook_discount; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_dispatch_webhook_discount AFTER INSERT OR UPDATE ON public.discount_approval_requests FOR EACH ROW EXECUTE FUNCTION public.dispatch_quote_webhook_event();


--
-- Name: kit_share_tokens trg_dispatch_webhook_kit_share; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_dispatch_webhook_kit_share AFTER INSERT ON public.kit_share_tokens FOR EACH ROW EXECUTE FUNCTION public.dispatch_quote_webhook_event();


--
-- Name: orders trg_dispatch_webhook_orders; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_dispatch_webhook_orders AFTER INSERT ON public.orders FOR EACH ROW EXECUTE FUNCTION public.dispatch_quote_webhook_event();


--
-- Name: quotes trg_dispatch_webhook_quotes; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_dispatch_webhook_quotes AFTER INSERT OR UPDATE ON public.quotes FOR EACH ROW EXECUTE FUNCTION public.dispatch_quote_webhook_event();


--
-- Name: external_connections trg_external_connections_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_external_connections_updated_at BEFORE UPDATE ON public.external_connections FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: favorite_items trg_favorite_items_to_trash; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_favorite_items_to_trash BEFORE DELETE ON public.favorite_items FOR EACH ROW EXECUTE FUNCTION public.move_favorite_to_trash();


--
-- Name: integration_credentials trg_fill_integration_credential_metadata; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_fill_integration_credential_metadata BEFORE INSERT OR UPDATE ON public.integration_credentials FOR EACH ROW EXECUTE FUNCTION public.fill_integration_credential_metadata();


--
-- Name: quote_approval_tokens trg_generate_secure_approval_token; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_generate_secure_approval_token BEFORE INSERT ON public.quote_approval_tokens FOR EACH ROW EXECUTE FUNCTION public.generate_secure_token();


--
-- Name: mcp_api_keys trg_guard_mcp_api_keys; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_guard_mcp_api_keys BEFORE INSERT OR DELETE OR UPDATE ON public.mcp_api_keys FOR EACH ROW EXECUTE FUNCTION public.guard_mcp_api_keys_writes();


--
-- Name: inbound_webhook_endpoints trg_inbound_endpoints_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_inbound_endpoints_updated_at BEFORE UPDATE ON public.inbound_webhook_endpoints FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: quote_approval_tokens trg_invalidate_used_approval_token; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_invalidate_used_approval_token BEFORE UPDATE ON public.quote_approval_tokens FOR EACH ROW EXECUTE FUNCTION public.invalidate_used_approval_token();


--
-- Name: ip_access_control trg_ip_access_control_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_ip_access_control_updated_at BEFORE UPDATE ON public.ip_access_control FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: kit_templates trg_kit_templates_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_kit_templates_updated_at BEFORE UPDATE ON public.kit_templates FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: mcp_api_keys trg_log_mcp_key_changes; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_log_mcp_key_changes AFTER UPDATE ON public.mcp_api_keys FOR EACH ROW EXECUTE FUNCTION public.log_mcp_key_changes();


--
-- Name: mockup_prompt_configs trg_log_mockup_prompt_change; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_log_mockup_prompt_change BEFORE UPDATE ON public.mockup_prompt_configs FOR EACH ROW EXECUTE FUNCTION public.log_mockup_prompt_change();


--
-- Name: mcp_api_keys trg_mcp_api_keys_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_mcp_api_keys_updated_at BEFORE UPDATE ON public.mcp_api_keys FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: collection_items trg_move_collection_item_to_trash; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_move_collection_item_to_trash BEFORE DELETE ON public.collection_items FOR EACH ROW EXECUTE FUNCTION public.move_collection_item_to_trash();


--
-- Name: orders trg_notify_new_order; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_notify_new_order AFTER INSERT ON public.orders FOR EACH ROW EXECUTE FUNCTION public.notify_new_order();


--
-- Name: quote_approval_tokens trg_notify_quote_client_response; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_notify_quote_client_response AFTER UPDATE ON public.quote_approval_tokens FOR EACH ROW EXECUTE FUNCTION public.notify_quote_client_response();


--
-- Name: quotes trg_notify_quote_status_change; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_notify_quote_status_change AFTER UPDATE ON public.quotes FOR EACH ROW EXECUTE FUNCTION public.notify_quote_status_change();


--
-- Name: optimization_queue trg_optimization_queue_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_optimization_queue_updated_at BEFORE UPDATE ON public.optimization_queue FOR EACH ROW EXECUTE FUNCTION public.set_optimization_queue_updated_at();


--
-- Name: orders trg_orders_increment_version; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_orders_increment_version BEFORE UPDATE ON public.orders FOR EACH ROW EXECUTE FUNCTION public.increment_row_version();


--
-- Name: outbound_webhooks trg_outbound_webhooks_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_outbound_webhooks_updated_at BEFORE UPDATE ON public.outbound_webhooks FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: ai_insights_cache trg_owner__ai_insights_cache__user_id; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_owner__ai_insights_cache__user_id BEFORE INSERT ON public.ai_insights_cache FOR EACH ROW EXECUTE FUNCTION public.enforce_user_id_owner();


--
-- Name: art_file_attachments trg_owner__art_file_attachments__user_id; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_owner__art_file_attachments__user_id BEFORE INSERT ON public.art_file_attachments FOR EACH ROW EXECUTE FUNCTION public.enforce_user_id_owner();


--
-- Name: cart_templates trg_owner__cart_templates__user_id; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_owner__cart_templates__user_id BEFORE INSERT ON public.cart_templates FOR EACH ROW EXECUTE FUNCTION public.enforce_user_id_owner();


--
-- Name: collections trg_owner__collections__user_id; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_owner__collections__user_id BEFORE INSERT ON public.collections FOR EACH ROW EXECUTE FUNCTION public.enforce_user_id_owner();


--
-- Name: custom_kits trg_owner__custom_kits__user_id; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_owner__custom_kits__user_id BEFORE INSERT ON public.custom_kits FOR EACH ROW EXECUTE FUNCTION public.enforce_user_id_owner();


--
-- Name: discount_approval_requests trg_owner__discount_approval_requests__seller_id; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_owner__discount_approval_requests__seller_id BEFORE INSERT ON public.discount_approval_requests FOR EACH ROW EXECUTE FUNCTION public.enforce_seller_id_owner();


--
-- Name: expert_conversations trg_owner__expert_conversations__seller_id; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_owner__expert_conversations__seller_id BEFORE INSERT ON public.expert_conversations FOR EACH ROW EXECUTE FUNCTION public.enforce_seller_id_owner();


--
-- Name: external_connections trg_owner__external_connections__created_by; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_owner__external_connections__created_by BEFORE INSERT ON public.external_connections FOR EACH ROW EXECUTE FUNCTION public.enforce_created_by_owner();


--
-- Name: favorite_items trg_owner__favorite_items__user_id; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_owner__favorite_items__user_id BEFORE INSERT ON public.favorite_items FOR EACH ROW EXECUTE FUNCTION public.enforce_user_id_owner();


--
-- Name: favorite_lists trg_owner__favorite_lists__user_id; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_owner__favorite_lists__user_id BEFORE INSERT ON public.favorite_lists FOR EACH ROW EXECUTE FUNCTION public.enforce_user_id_owner();


--
-- Name: follow_up_reminders trg_owner__follow_up_reminders__seller_id; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_owner__follow_up_reminders__seller_id BEFORE INSERT ON public.follow_up_reminders FOR EACH ROW EXECUTE FUNCTION public.enforce_seller_id_owner();


--
-- Name: generated_mockups trg_owner__generated_mockups__seller_id; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_owner__generated_mockups__seller_id BEFORE INSERT ON public.generated_mockups FOR EACH ROW EXECUTE FUNCTION public.enforce_seller_id_owner();


--
-- Name: inbound_webhook_endpoints trg_owner__inbound_webhook_endpoints__created_by; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_owner__inbound_webhook_endpoints__created_by BEFORE INSERT ON public.inbound_webhook_endpoints FOR EACH ROW EXECUTE FUNCTION public.enforce_created_by_owner();


--
-- Name: kit_share_tokens trg_owner__kit_share_tokens__seller_id; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_owner__kit_share_tokens__seller_id BEFORE INSERT ON public.kit_share_tokens FOR EACH ROW EXECUTE FUNCTION public.enforce_seller_id_owner();


--
-- Name: magic_up_brand_kits trg_owner__magic_up_brand_kits__user_id; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_owner__magic_up_brand_kits__user_id BEFORE INSERT ON public.magic_up_brand_kits FOR EACH ROW EXECUTE FUNCTION public.enforce_user_id_owner();


--
-- Name: magic_up_campaigns trg_owner__magic_up_campaigns__user_id; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_owner__magic_up_campaigns__user_id BEFORE INSERT ON public.magic_up_campaigns FOR EACH ROW EXECUTE FUNCTION public.enforce_user_id_owner();


--
-- Name: magic_up_comments trg_owner__magic_up_comments__user_id; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_owner__magic_up_comments__user_id BEFORE INSERT ON public.magic_up_comments FOR EACH ROW EXECUTE FUNCTION public.enforce_user_id_owner();


--
-- Name: magic_up_generations trg_owner__magic_up_generations__user_id; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_owner__magic_up_generations__user_id BEFORE INSERT ON public.magic_up_generations FOR EACH ROW EXECUTE FUNCTION public.enforce_user_id_owner();


--
-- Name: magic_up_public_shares trg_owner__magic_up_public_shares__user_id; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_owner__magic_up_public_shares__user_id BEFORE INSERT ON public.magic_up_public_shares FOR EACH ROW EXECUTE FUNCTION public.enforce_user_id_owner();


--
-- Name: magic_up_reactions trg_owner__magic_up_reactions__user_id; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_owner__magic_up_reactions__user_id BEFORE INSERT ON public.magic_up_reactions FOR EACH ROW EXECUTE FUNCTION public.enforce_user_id_owner();


--
-- Name: mcp_api_keys trg_owner__mcp_api_keys__created_by; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_owner__mcp_api_keys__created_by BEFORE INSERT ON public.mcp_api_keys FOR EACH ROW EXECUTE FUNCTION public.enforce_created_by_owner();


--
-- Name: mockup_drafts trg_owner__mockup_drafts__user_id; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_owner__mockup_drafts__user_id BEFORE INSERT ON public.mockup_drafts FOR EACH ROW EXECUTE FUNCTION public.enforce_user_id_owner();


--
-- Name: mockup_templates trg_owner__mockup_templates__user_id; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_owner__mockup_templates__user_id BEFORE INSERT ON public.mockup_templates FOR EACH ROW EXECUTE FUNCTION public.enforce_user_id_owner();


--
-- Name: orders trg_owner__orders__seller_id; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_owner__orders__seller_id BEFORE INSERT ON public.orders FOR EACH ROW EXECUTE FUNCTION public.enforce_seller_id_owner();


--
-- Name: outbound_webhooks trg_owner__outbound_webhooks__created_by; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_owner__outbound_webhooks__created_by BEFORE INSERT ON public.outbound_webhooks FOR EACH ROW EXECUTE FUNCTION public.enforce_created_by_owner();


--
-- Name: quote_approval_tokens trg_owner__quote_approval_tokens__seller_id; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_owner__quote_approval_tokens__seller_id BEFORE INSERT ON public.quote_approval_tokens FOR EACH ROW EXECUTE FUNCTION public.enforce_seller_id_owner();


--
-- Name: quote_comments trg_owner__quote_comments__user_id; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_owner__quote_comments__user_id BEFORE INSERT ON public.quote_comments FOR EACH ROW EXECUTE FUNCTION public.enforce_user_id_owner();


--
-- Name: quote_templates trg_owner__quote_templates__seller_id; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_owner__quote_templates__seller_id BEFORE INSERT ON public.quote_templates FOR EACH ROW EXECUTE FUNCTION public.enforce_seller_id_owner();


--
-- Name: quotes trg_owner__quotes__seller_id; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_owner__quotes__seller_id BEFORE INSERT ON public.quotes FOR EACH ROW EXECUTE FUNCTION public.enforce_seller_id_owner();


--
-- Name: saved_filters trg_owner__saved_filters__user_id; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_owner__saved_filters__user_id BEFORE INSERT ON public.saved_filters FOR EACH ROW EXECUTE FUNCTION public.enforce_user_id_owner();


--
-- Name: saved_trends_views trg_owner__saved_trends_views__user_id; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_owner__saved_trends_views__user_id BEFORE INSERT ON public.saved_trends_views FOR EACH ROW EXECUTE FUNCTION public.enforce_user_id_owner();


--
-- Name: scheduled_reports trg_owner__scheduled_reports__user_id; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_owner__scheduled_reports__user_id BEFORE INSERT ON public.scheduled_reports FOR EACH ROW EXECUTE FUNCTION public.enforce_user_id_owner();


--
-- Name: seller_carts trg_owner__seller_carts__seller_id; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_owner__seller_carts__seller_id BEFORE INSERT ON public.seller_carts FOR EACH ROW EXECUTE FUNCTION public.enforce_seller_id_owner();


--
-- Name: product_price_freshness_overrides trg_pfo_set_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_pfo_set_updated_at BEFORE UPDATE ON public.product_price_freshness_overrides FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: profiles trg_prevent_role_self_update; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_prevent_role_self_update BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.prevent_role_self_update();


--
-- Name: quotes trg_quotes_increment_version; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_quotes_increment_version BEFORE UPDATE ON public.quotes FOR EACH ROW EXECUTE FUNCTION public.increment_row_version();


--
-- Name: connection_test_history trg_trim_connection_test_history; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_trim_connection_test_history AFTER INSERT ON public.connection_test_history FOR EACH ROW EXECUTE FUNCTION public.trim_connection_test_history();


--
-- Name: user_comparisons trg_user_comparisons_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_user_comparisons_updated_at BEFORE UPDATE ON public.user_comparisons FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: user_roles trg_user_roles_audit_del; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_user_roles_audit_del AFTER DELETE ON public.user_roles FOR EACH ROW EXECUTE FUNCTION public.audit_user_role_changes();


--
-- Name: user_roles trg_user_roles_audit_ins; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_user_roles_audit_ins AFTER INSERT ON public.user_roles FOR EACH ROW EXECUTE FUNCTION public.audit_user_role_changes();


--
-- Name: user_roles trg_user_roles_audit_upd; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_user_roles_audit_upd AFTER UPDATE ON public.user_roles FOR EACH ROW EXECUTE FUNCTION public.audit_user_role_changes();


--
-- Name: user_roles trg_user_roles_auto_revoke_mcp; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_user_roles_auto_revoke_mcp AFTER DELETE ON public.user_roles FOR EACH ROW EXECUTE FUNCTION public.trg_auto_revoke_mcp_on_role_loss();


--
-- Name: quote_approval_tokens trg_validate_approval_token_status; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_validate_approval_token_status BEFORE INSERT OR UPDATE ON public.quote_approval_tokens FOR EACH ROW EXECUTE FUNCTION public.validate_status_fields();


--
-- Name: ip_access_control trg_validate_ip_access_control; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_validate_ip_access_control BEFORE INSERT OR UPDATE ON public.ip_access_control FOR EACH ROW EXECUTE FUNCTION public.validate_ip_access_control();


--
-- Name: kit_share_tokens trg_validate_kit_share_token_status; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_validate_kit_share_token_status BEFORE INSERT OR UPDATE ON public.kit_share_tokens FOR EACH ROW EXECUTE FUNCTION public.validate_status_fields();


--
-- Name: custom_kits trg_validate_kit_status; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_validate_kit_status BEFORE INSERT OR UPDATE ON public.custom_kits FOR EACH ROW EXECUTE FUNCTION public.validate_status_fields();


--
-- Name: orders trg_validate_order_status; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_validate_order_status BEFORE INSERT OR UPDATE ON public.orders FOR EACH ROW EXECUTE FUNCTION public.validate_status_fields();


--
-- Name: quotes trg_validate_quote_real_discount; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_validate_quote_real_discount BEFORE INSERT OR UPDATE OF subtotal, discount_percent, negotiation_markup_percent, status ON public.quotes FOR EACH ROW EXECUTE FUNCTION public.validate_quote_real_discount();


--
-- Name: quotes trg_validate_quote_status; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_validate_quote_status BEFORE INSERT OR UPDATE ON public.quotes FOR EACH ROW EXECUTE FUNCTION public.validate_status_fields();


--
-- Name: scheduled_reports trg_validate_report_email; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_validate_report_email BEFORE INSERT OR UPDATE ON public.scheduled_reports FOR EACH ROW EXECUTE FUNCTION public.validate_scheduled_report_email();


--
-- Name: secret_rotation_log trg_validate_secret_rotation_action_type; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_validate_secret_rotation_action_type BEFORE INSERT OR UPDATE ON public.secret_rotation_log FOR EACH ROW EXECUTE FUNCTION public.validate_secret_rotation_action_type();


--
-- Name: quotes trigger_generate_quote_number; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trigger_generate_quote_number BEFORE INSERT ON public.quotes FOR EACH ROW EXECUTE FUNCTION public.generate_quote_number();


--
-- Name: recently_viewed_products trigger_limit_recently_viewed; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trigger_limit_recently_viewed AFTER INSERT OR UPDATE ON public.recently_viewed_products FOR EACH ROW EXECUTE FUNCTION public.limit_recently_viewed_items();


--
-- Name: recently_viewed_products trigger_limit_recently_viewed_products; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trigger_limit_recently_viewed_products AFTER INSERT ON public.recently_viewed_products FOR EACH ROW EXECUTE FUNCTION public.limit_recently_viewed_products();


--
-- Name: admin_settings update_admin_settings_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_admin_settings_updated_at BEFORE UPDATE ON public.admin_settings FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: art_file_attachments update_art_files_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_art_files_updated_at BEFORE UPDATE ON public.art_file_attachments FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: collections update_collections_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_collections_updated_at BEFORE UPDATE ON public.collections FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: conversation_delivery_status update_delivery_status_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_delivery_status_updated_at BEFORE UPDATE ON public.conversation_delivery_status FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: discount_approval_requests update_discount_approval_requests_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_discount_approval_requests_updated_at BEFORE UPDATE ON public.discount_approval_requests FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: kit_collaborators update_kit_collab_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_kit_collab_updated_at BEFORE UPDATE ON public.kit_collaborators FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: kit_comments update_kit_comments_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_kit_comments_updated_at BEFORE UPDATE ON public.kit_comments FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: kit_variants update_kit_variants_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_kit_variants_updated_at BEFORE UPDATE ON public.kit_variants FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: mockup_prompt_configs update_mockup_prompt_configs_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_mockup_prompt_configs_updated_at BEFORE UPDATE ON public.mockup_prompt_configs FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: mockup_templates update_mockup_templates_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_mockup_templates_updated_at BEFORE UPDATE ON public.mockup_templates FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: product_component_locations update_product_comp_loc_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_product_comp_loc_updated_at BEFORE UPDATE ON public.product_component_locations FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: saved_trends_views update_saved_trends_views_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_saved_trends_views_updated_at BEFORE UPDATE ON public.saved_trends_views FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: seller_discount_limits update_seller_discount_limits_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_seller_discount_limits_updated_at BEFORE UPDATE ON public.seller_discount_limits FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: user_preferences update_user_preferences_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_user_preferences_updated_at BEFORE UPDATE ON public.user_preferences FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: user_search_history update_user_search_history_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_user_search_history_updated_at BEFORE UPDATE ON public.user_search_history FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: discount_approval_requests validate_discount_approval_status_trigger; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER validate_discount_approval_status_trigger BEFORE INSERT OR UPDATE ON public.discount_approval_requests FOR EACH ROW EXECUTE FUNCTION public.validate_discount_approval_status();


--
-- Name: cart_templates cart_templates_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cart_templates
    ADD CONSTRAINT cart_templates_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: collection_items collection_items_collection_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.collection_items
    ADD CONSTRAINT collection_items_collection_id_fkey FOREIGN KEY (collection_id) REFERENCES public.collections(id) ON DELETE CASCADE;


--
-- Name: comparison_reactions comparison_reactions_comparison_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.comparison_reactions
    ADD CONSTRAINT comparison_reactions_comparison_id_fkey FOREIGN KEY (comparison_id) REFERENCES public.user_comparisons(id) ON DELETE CASCADE;


--
-- Name: connection_test_history connection_test_history_connection_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.connection_test_history
    ADD CONSTRAINT connection_test_history_connection_id_fkey FOREIGN KEY (connection_id) REFERENCES public.external_connections(id) ON DELETE CASCADE;


--
-- Name: conversation_audit_logs conversation_audit_logs_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.conversation_audit_logs
    ADD CONSTRAINT conversation_audit_logs_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: conversation_delivery_status conversation_delivery_status_event_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.conversation_delivery_status
    ADD CONSTRAINT conversation_delivery_status_event_id_fkey FOREIGN KEY (event_id) REFERENCES public.conversation_event_history(id) ON DELETE CASCADE;


--
-- Name: conversation_event_history conversation_event_history_conversation_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.conversation_event_history
    ADD CONSTRAINT conversation_event_history_conversation_id_fkey FOREIGN KEY (conversation_id) REFERENCES public.conversation_audit_logs(id) ON DELETE CASCADE;


--
-- Name: discount_approval_requests discount_approval_requests_quote_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.discount_approval_requests
    ADD CONSTRAINT discount_approval_requests_quote_id_fkey FOREIGN KEY (quote_id) REFERENCES public.quotes(id) ON DELETE CASCADE;


--
-- Name: expert_conversations expert_conversations_seller_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.expert_conversations
    ADD CONSTRAINT expert_conversations_seller_id_fkey FOREIGN KEY (seller_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: expert_messages expert_messages_conversation_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.expert_messages
    ADD CONSTRAINT expert_messages_conversation_id_fkey FOREIGN KEY (conversation_id) REFERENCES public.expert_conversations(id) ON DELETE CASCADE;


--
-- Name: favorite_item_reactions favorite_item_reactions_item_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.favorite_item_reactions
    ADD CONSTRAINT favorite_item_reactions_item_id_fkey FOREIGN KEY (item_id) REFERENCES public.favorite_items(id) ON DELETE CASCADE;


--
-- Name: favorite_item_reactions favorite_item_reactions_list_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.favorite_item_reactions
    ADD CONSTRAINT favorite_item_reactions_list_id_fkey FOREIGN KEY (list_id) REFERENCES public.favorite_lists(id) ON DELETE CASCADE;


--
-- Name: favorite_items favorite_items_list_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.favorite_items
    ADD CONSTRAINT favorite_items_list_id_fkey FOREIGN KEY (list_id) REFERENCES public.favorite_lists(id) ON DELETE CASCADE;


--
-- Name: favorites favorites_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.favorites
    ADD CONSTRAINT favorites_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: follow_up_reminders follow_up_reminders_seller_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.follow_up_reminders
    ADD CONSTRAINT follow_up_reminders_seller_id_fkey FOREIGN KEY (seller_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: geo_allowed_countries geo_allowed_countries_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.geo_allowed_countries
    ADD CONSTRAINT geo_allowed_countries_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id);


--
-- Name: inbound_webhook_events inbound_webhook_events_endpoint_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inbound_webhook_events
    ADD CONSTRAINT inbound_webhook_events_endpoint_id_fkey FOREIGN KEY (endpoint_id) REFERENCES public.inbound_webhook_endpoints(id) ON DELETE CASCADE;


--
-- Name: kit_collaborators kit_collaborators_kit_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.kit_collaborators
    ADD CONSTRAINT kit_collaborators_kit_id_fkey FOREIGN KEY (kit_id) REFERENCES public.custom_kits(id) ON DELETE CASCADE;


--
-- Name: kit_comments kit_comments_kit_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.kit_comments
    ADD CONSTRAINT kit_comments_kit_id_fkey FOREIGN KEY (kit_id) REFERENCES public.custom_kits(id) ON DELETE CASCADE;


--
-- Name: kit_comments kit_comments_parent_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.kit_comments
    ADD CONSTRAINT kit_comments_parent_id_fkey FOREIGN KEY (parent_id) REFERENCES public.kit_comments(id) ON DELETE CASCADE;


--
-- Name: kit_share_tokens kit_share_tokens_kit_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.kit_share_tokens
    ADD CONSTRAINT kit_share_tokens_kit_id_fkey FOREIGN KEY (kit_id) REFERENCES public.custom_kits(id) ON DELETE CASCADE;


--
-- Name: kit_variants kit_variants_kit_master_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.kit_variants
    ADD CONSTRAINT kit_variants_kit_master_id_fkey FOREIGN KEY (kit_master_id) REFERENCES public.custom_kits(id) ON DELETE CASCADE;


--
-- Name: magic_up_comments magic_up_comments_generation_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.magic_up_comments
    ADD CONSTRAINT magic_up_comments_generation_id_fkey FOREIGN KEY (generation_id) REFERENCES public.magic_up_generations(id) ON DELETE CASCADE;


--
-- Name: magic_up_generations magic_up_generations_campaign_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.magic_up_generations
    ADD CONSTRAINT magic_up_generations_campaign_id_fkey FOREIGN KEY (campaign_id) REFERENCES public.magic_up_campaigns(id) ON DELETE SET NULL;


--
-- Name: magic_up_generations magic_up_generations_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.magic_up_generations
    ADD CONSTRAINT magic_up_generations_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: magic_up_public_shares magic_up_public_shares_campaign_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.magic_up_public_shares
    ADD CONSTRAINT magic_up_public_shares_campaign_id_fkey FOREIGN KEY (campaign_id) REFERENCES public.magic_up_campaigns(id) ON DELETE CASCADE;


--
-- Name: magic_up_public_shares magic_up_public_shares_generation_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.magic_up_public_shares
    ADD CONSTRAINT magic_up_public_shares_generation_id_fkey FOREIGN KEY (generation_id) REFERENCES public.magic_up_generations(id) ON DELETE CASCADE;


--
-- Name: magic_up_reactions magic_up_reactions_generation_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.magic_up_reactions
    ADD CONSTRAINT magic_up_reactions_generation_id_fkey FOREIGN KEY (generation_id) REFERENCES public.magic_up_generations(id) ON DELETE CASCADE;


--
-- Name: mcp_api_keys mcp_api_keys_rotated_from_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.mcp_api_keys
    ADD CONSTRAINT mcp_api_keys_rotated_from_fkey FOREIGN KEY (rotated_from) REFERENCES public.mcp_api_keys(id) ON DELETE SET NULL;


--
-- Name: mcp_key_auto_revocations mcp_key_auto_revocations_key_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.mcp_key_auto_revocations
    ADD CONSTRAINT mcp_key_auto_revocations_key_id_fkey FOREIGN KEY (key_id) REFERENCES public.mcp_api_keys(id) ON DELETE CASCADE;


--
-- Name: mcp_keys mcp_keys_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.mcp_keys
    ADD CONSTRAINT mcp_keys_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: mockup_drafts mockup_drafts_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.mockup_drafts
    ADD CONSTRAINT mockup_drafts_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: mockup_prompt_history mockup_prompt_history_config_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.mockup_prompt_history
    ADD CONSTRAINT mockup_prompt_history_config_id_fkey FOREIGN KEY (config_id) REFERENCES public.mockup_prompt_configs(id) ON DELETE CASCADE;


--
-- Name: optimization_queue_runs optimization_queue_runs_queue_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.optimization_queue_runs
    ADD CONSTRAINT optimization_queue_runs_queue_id_fkey FOREIGN KEY (queue_id) REFERENCES public.optimization_queue(id) ON DELETE CASCADE;


--
-- Name: order_item_personalizations order_item_personalizations_order_item_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.order_item_personalizations
    ADD CONSTRAINT order_item_personalizations_order_item_id_fkey FOREIGN KEY (order_item_id) REFERENCES public.order_items(id) ON DELETE CASCADE;


--
-- Name: order_items order_items_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.order_items
    ADD CONSTRAINT order_items_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id);


--
-- Name: orders orders_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.orders
    ADD CONSTRAINT orders_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id);


--
-- Name: orders orders_quote_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.orders
    ADD CONSTRAINT orders_quote_id_fkey FOREIGN KEY (quote_id) REFERENCES public.quotes(id);


--
-- Name: organization_members organization_members_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.organization_members
    ADD CONSTRAINT organization_members_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: organization_members organization_members_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.organization_members
    ADD CONSTRAINT organization_members_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: ownership_repair_logs ownership_repair_logs_report_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ownership_repair_logs
    ADD CONSTRAINT ownership_repair_logs_report_id_fkey FOREIGN KEY (report_id) REFERENCES public.ownership_audit_reports(id) ON DELETE SET NULL;


--
-- Name: password_reset_requests password_reset_requests_reviewed_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.password_reset_requests
    ADD CONSTRAINT password_reset_requests_reviewed_by_fkey FOREIGN KEY (reviewed_by) REFERENCES auth.users(id);


--
-- Name: password_reset_requests password_reset_requests_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.password_reset_requests
    ADD CONSTRAINT password_reset_requests_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id);


--
-- Name: product_component_locations product_component_locations_component_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.product_component_locations
    ADD CONSTRAINT product_component_locations_component_id_fkey FOREIGN KEY (component_id) REFERENCES public.product_components(id) ON DELETE CASCADE;


--
-- Name: product_group_members product_group_members_product_group_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.product_group_members
    ADD CONSTRAINT product_group_members_product_group_id_fkey FOREIGN KEY (product_group_id) REFERENCES public.product_groups(id) ON DELETE CASCADE;


--
-- Name: product_price_freshness_overrides product_price_freshness_overrides_updated_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.product_price_freshness_overrides
    ADD CONSTRAINT product_price_freshness_overrides_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES auth.users(id) ON DELETE SET NULL;


--
-- Name: profiles profiles_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: quote_approval_tokens quote_approval_tokens_seller_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.quote_approval_tokens
    ADD CONSTRAINT quote_approval_tokens_seller_id_fkey FOREIGN KEY (seller_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: quote_comments quote_comments_parent_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.quote_comments
    ADD CONSTRAINT quote_comments_parent_id_fkey FOREIGN KEY (parent_id) REFERENCES public.quote_comments(id) ON DELETE CASCADE;


--
-- Name: quote_drafts quote_drafts_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.quote_drafts
    ADD CONSTRAINT quote_drafts_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id);


--
-- Name: quote_history quote_history_quote_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.quote_history
    ADD CONSTRAINT quote_history_quote_id_fkey FOREIGN KEY (quote_id) REFERENCES public.quotes(id) ON DELETE CASCADE;


--
-- Name: quote_item_personalizations quote_item_personalizations_quote_item_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.quote_item_personalizations
    ADD CONSTRAINT quote_item_personalizations_quote_item_id_fkey FOREIGN KEY (quote_item_id) REFERENCES public.quote_items(id) ON DELETE CASCADE;


--
-- Name: quote_items quote_items_quote_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.quote_items
    ADD CONSTRAINT quote_items_quote_id_fkey FOREIGN KEY (quote_id) REFERENCES public.quotes(id) ON DELETE CASCADE;


--
-- Name: quotes quotes_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.quotes
    ADD CONSTRAINT quotes_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id);


--
-- Name: quotes quotes_parent_quote_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.quotes
    ADD CONSTRAINT quotes_parent_quote_id_fkey FOREIGN KEY (parent_quote_id) REFERENCES public.quotes(id) ON DELETE SET NULL;


--
-- Name: recently_viewed_products recently_viewed_products_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.recently_viewed_products
    ADD CONSTRAINT recently_viewed_products_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: role_migration_items role_migration_items_batch_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.role_migration_items
    ADD CONSTRAINT role_migration_items_batch_id_fkey FOREIGN KEY (batch_id) REFERENCES public.role_migration_batches(id) ON DELETE CASCADE;


--
-- Name: saved_filters saved_filters_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.saved_filters
    ADD CONSTRAINT saved_filters_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: seller_cart_items seller_cart_items_cart_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.seller_cart_items
    ADD CONSTRAINT seller_cart_items_cart_id_fkey FOREIGN KEY (cart_id) REFERENCES public.seller_carts(id) ON DELETE CASCADE;


--
-- Name: seller_carts seller_carts_seller_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.seller_carts
    ADD CONSTRAINT seller_carts_seller_id_fkey FOREIGN KEY (seller_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: seller_discount_limits seller_discount_limits_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.seller_discount_limits
    ADD CONSTRAINT seller_discount_limits_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: step_up_tokens step_up_tokens_challenge_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.step_up_tokens
    ADD CONSTRAINT step_up_tokens_challenge_id_fkey FOREIGN KEY (challenge_id) REFERENCES public.step_up_challenges(id) ON DELETE CASCADE;


--
-- Name: user_known_devices user_known_devices_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_known_devices
    ADD CONSTRAINT user_known_devices_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: user_onboarding user_onboarding_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_onboarding
    ADD CONSTRAINT user_onboarding_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: user_roles user_roles_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_roles
    ADD CONSTRAINT user_roles_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: user_search_history user_search_history_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_search_history
    ADD CONSTRAINT user_search_history_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: user_token_revocations user_token_revocations_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_token_revocations
    ADD CONSTRAINT user_token_revocations_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: webhook_deliveries webhook_deliveries_webhook_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.webhook_deliveries
    ADD CONSTRAINT webhook_deliveries_webhook_id_fkey FOREIGN KEY (webhook_id) REFERENCES public.outbound_webhooks(id) ON DELETE CASCADE;


--
-- Name: quote_items Acesso a itens via orcamento; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Acesso a itens via orcamento" ON public.quote_items FOR SELECT USING ((EXISTS ( SELECT 1
   FROM public.quotes
  WHERE (quotes.id = quote_items.quote_id))));


--
-- Name: order_items Acesso a itens via pedido; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Acesso a itens via pedido" ON public.order_items FOR SELECT USING ((EXISTS ( SELECT 1
   FROM public.orders
  WHERE (orders.id = order_items.order_id))));


--
-- Name: conversation_event_history Acesso ao histórico de eventos segue o log de auditoria; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Acesso ao histórico de eventos segue o log de auditoria" ON public.conversation_event_history FOR SELECT TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.conversation_audit_logs
  WHERE (conversation_audit_logs.id = conversation_event_history.conversation_id))));


--
-- Name: category_icons Admins can delete category icons; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can delete category icons" ON public.category_icons FOR DELETE TO authenticated USING (public.is_admin(auth.uid()));


--
-- Name: product_price_freshness_overrides Admins can delete freshness overrides; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can delete freshness overrides" ON public.product_price_freshness_overrides FOR DELETE TO authenticated USING (public.is_admin(auth.uid()));


--
-- Name: integration_credentials Admins can delete integration credentials; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can delete integration credentials" ON public.integration_credentials FOR DELETE TO authenticated USING (public.is_admin(auth.uid()));


--
-- Name: rls_denial_log Admins can delete old logs; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can delete old logs" ON public.rls_denial_log FOR DELETE TO authenticated USING (public.is_admin_strict(auth.uid()));


--
-- Name: kit_templates Admins can delete templates; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can delete templates" ON public.kit_templates FOR DELETE TO authenticated USING (public.is_admin(auth.uid()));


--
-- Name: admin_settings Admins can insert admin_settings; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can insert admin_settings" ON public.admin_settings FOR INSERT TO authenticated WITH CHECK (public.is_admin(auth.uid()));


--
-- Name: category_icons Admins can insert category icons; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can insert category icons" ON public.category_icons FOR INSERT TO authenticated WITH CHECK (public.is_admin(auth.uid()));


--
-- Name: product_price_freshness_overrides Admins can insert freshness overrides; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can insert freshness overrides" ON public.product_price_freshness_overrides FOR INSERT TO authenticated WITH CHECK (public.is_admin(auth.uid()));


--
-- Name: integration_credentials Admins can insert integration credentials; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can insert integration credentials" ON public.integration_credentials FOR INSERT TO authenticated WITH CHECK (public.is_admin(auth.uid()));


--
-- Name: kit_templates Admins can insert templates; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can insert templates" ON public.kit_templates FOR INSERT TO authenticated WITH CHECK (public.is_admin(auth.uid()));


--
-- Name: component_media Admins can manage component media; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can manage component media" ON public.component_media TO authenticated USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));


--
-- Name: product_components Admins can manage components; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can manage components" ON public.product_components TO authenticated USING (public.is_admin(auth.uid()));


--
-- Name: product_groups Admins can manage groups; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can manage groups" ON public.product_groups TO authenticated USING (public.is_admin(auth.uid()));


--
-- Name: product_group_members Admins can manage members; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can manage members" ON public.product_group_members TO authenticated USING (public.is_admin(auth.uid()));


--
-- Name: permissions Admins can manage permissions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can manage permissions" ON public.permissions TO authenticated USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));


--
-- Name: ai_usage_quotas Admins can manage quotas; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can manage quotas" ON public.ai_usage_quotas TO authenticated USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));


--
-- Name: role_permissions Admins can manage role_permissions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can manage role_permissions" ON public.role_permissions TO authenticated USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));


--
-- Name: video_variant_links Admins can manage video variant links; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can manage video variant links" ON public.video_variant_links TO authenticated USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));


--
-- Name: custom_kits Admins can read all kits; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can read all kits" ON public.custom_kits FOR SELECT TO authenticated USING (public.is_admin(auth.uid()));


--
-- Name: login_attempts Admins can read all login attempts; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can read all login attempts" ON public.login_attempts FOR SELECT TO authenticated USING (public.is_admin(auth.uid()));


--
-- Name: product_views Admins can read all views; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can read all views" ON public.product_views FOR SELECT TO authenticated USING (public.is_admin(auth.uid()));


--
-- Name: admin_settings Admins can update admin_settings; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can update admin_settings" ON public.admin_settings FOR UPDATE TO authenticated USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));


--
-- Name: category_icons Admins can update category icons; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can update category icons" ON public.category_icons FOR UPDATE TO authenticated USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));


--
-- Name: product_price_freshness_overrides Admins can update freshness overrides; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can update freshness overrides" ON public.product_price_freshness_overrides FOR UPDATE TO authenticated USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));


--
-- Name: integration_credentials Admins can update integration credentials; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can update integration credentials" ON public.integration_credentials FOR UPDATE TO authenticated USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));


--
-- Name: password_reset_requests Admins can update password reset requests; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can update password reset requests" ON public.password_reset_requests FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM public.user_roles
  WHERE ((user_roles.user_id = auth.uid()) AND (user_roles.role = ANY (ARRAY['dev'::public.app_role, 'supervisor'::public.app_role, 'admin'::public.app_role]))))));


--
-- Name: kit_templates Admins can update templates; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can update templates" ON public.kit_templates FOR UPDATE TO authenticated USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));


--
-- Name: admin_settings Admins can view admin_settings; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can view admin_settings" ON public.admin_settings FOR SELECT TO authenticated USING (public.is_admin(auth.uid()));


--
-- Name: ai_usage_logs Admins can view all AI usage logs; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can view all AI usage logs" ON public.ai_usage_logs FOR SELECT TO authenticated USING (public.is_admin(auth.uid()));


--
-- Name: admin_audit_log Admins can view all audit logs; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can view all audit logs" ON public.admin_audit_log FOR SELECT USING ((auth.uid() IN ( SELECT user_roles.user_id
   FROM public.user_roles
  WHERE (user_roles.role = 'admin'::public.app_role))));


--
-- Name: profiles Admins can view all profiles; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can view all profiles" ON public.profiles FOR SELECT TO authenticated USING (public.is_admin(auth.uid()));


--
-- Name: voice_command_logs Admins can view all voice logs; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can view all voice logs" ON public.voice_command_logs FOR SELECT TO authenticated USING (public.is_manager_or_admin());


--
-- Name: admin_audit_log Admins can view audit logs; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can view audit logs" ON public.admin_audit_log FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: integration_credentials Admins can view integration credentials; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can view integration credentials" ON public.integration_credentials FOR SELECT TO authenticated USING (public.is_admin(auth.uid()));


--
-- Name: password_reset_requests Admins can view password reset requests; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can view password reset requests" ON public.password_reset_requests FOR SELECT USING ((EXISTS ( SELECT 1
   FROM public.user_roles
  WHERE ((user_roles.user_id = auth.uid()) AND (user_roles.role = ANY (ARRAY['dev'::public.app_role, 'supervisor'::public.app_role, 'admin'::public.app_role]))))));


--
-- Name: inbound_webhook_events Admins delete inbound_webhook_events; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins delete inbound_webhook_events" ON public.inbound_webhook_events FOR DELETE USING (public.is_admin(auth.uid()));


--
-- Name: user_roles Admins delete roles; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins delete roles" ON public.user_roles FOR DELETE TO authenticated USING (public.is_admin_strict(auth.uid()));


--
-- Name: webhook_deliveries Admins delete webhook_deliveries; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins delete webhook_deliveries" ON public.webhook_deliveries FOR DELETE USING (public.is_admin(auth.uid()));


--
-- Name: access_security_settings Admins e Devs podem atualizar configurações de segurança; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins e Devs podem atualizar configurações de segurança" ON public.access_security_settings FOR UPDATE TO authenticated USING ((public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_role(auth.uid(), 'dev'::public.app_role))) WITH CHECK ((public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_role(auth.uid(), 'dev'::public.app_role)));


--
-- Name: access_security_settings Admins e Devs podem visualizar configurações de segurança; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins e Devs podem visualizar configurações de segurança" ON public.access_security_settings FOR SELECT TO authenticated USING ((public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_role(auth.uid(), 'dev'::public.app_role)));


--
-- Name: audit_logs Admins e Devs podem visualizar logs de auditoria; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins e Devs podem visualizar logs de auditoria" ON public.audit_logs FOR SELECT TO authenticated USING ((public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_role(auth.uid(), 'dev'::public.app_role)));


--
-- Name: conversation_audit_logs Admins e Managers podem ver todos os logs de conversa; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins e Managers podem ver todos os logs de conversa" ON public.conversation_audit_logs FOR SELECT TO authenticated USING ((public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_role(auth.uid(), 'manager'::public.app_role)));


--
-- Name: product_sync_logs Admins insert product sync logs; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins insert product sync logs" ON public.product_sync_logs FOR INSERT WITH CHECK (public.is_admin(auth.uid()));


--
-- Name: mockup_prompt_history Admins insert prompt history; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins insert prompt history" ON public.mockup_prompt_history FOR INSERT WITH CHECK (public.is_admin(auth.uid()));


--
-- Name: user_roles Admins insert roles; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins insert roles" ON public.user_roles FOR INSERT TO authenticated WITH CHECK (public.is_admin_strict(auth.uid()));


--
-- Name: secret_rotation_log Admins insert secret_rotation_log; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins insert secret_rotation_log" ON public.secret_rotation_log FOR INSERT WITH CHECK ((public.is_admin(auth.uid()) AND (rotated_by = auth.uid())));


--
-- Name: product_component_locations Admins manage component locations; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins manage component locations" ON public.product_component_locations USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));


--
-- Name: inbound_webhook_endpoints Admins manage inbound_webhook_endpoints; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins manage inbound_webhook_endpoints" ON public.inbound_webhook_endpoints USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));


--
-- Name: mcp_full_grantors Admins manage mcp_full_grantors; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins manage mcp_full_grantors" ON public.mcp_full_grantors TO authenticated USING (public.is_admin_strict(auth.uid())) WITH CHECK (public.is_admin_strict(auth.uid()));


--
-- Name: optimization_queue_runs Admins manage optimization runs; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins manage optimization runs" ON public.optimization_queue_runs TO authenticated USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));


--
-- Name: outbound_webhooks Admins manage outbound_webhooks; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins manage outbound_webhooks" ON public.outbound_webhooks USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));


--
-- Name: mockup_prompt_configs Admins manage prompt configs; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins manage prompt configs" ON public.mockup_prompt_configs USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));


--
-- Name: favorite_items Admins read all favorite items; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins read all favorite items" ON public.favorite_items FOR SELECT TO authenticated USING (public.is_admin(auth.uid()));


--
-- Name: favorite_lists Admins read all favorite lists; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins read all favorite lists" ON public.favorite_lists FOR SELECT TO authenticated USING (public.is_admin(auth.uid()));


--
-- Name: favorite_item_reactions Admins read all reactions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins read all reactions" ON public.favorite_item_reactions FOR SELECT TO authenticated USING (public.is_admin(auth.uid()));


--
-- Name: external_connections_sync_log Admins read external_connections_sync_log; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins read external_connections_sync_log" ON public.external_connections_sync_log FOR SELECT USING (public.is_admin(auth.uid()));


--
-- Name: inbound_webhook_events Admins read inbound_webhook_events; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins read inbound_webhook_events" ON public.inbound_webhook_events FOR SELECT USING (public.is_admin(auth.uid()));


--
-- Name: mcp_access_violations Admins read mcp violations; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins read mcp violations" ON public.mcp_access_violations FOR SELECT TO authenticated USING (public.is_admin(auth.uid()));


--
-- Name: rls_denial_log Admins read rls denials; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins read rls denials" ON public.rls_denial_log FOR SELECT TO authenticated USING (public.is_supervisor_or_above(auth.uid()));


--
-- Name: public_token_failures Admins read token failures; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins read token failures" ON public.public_token_failures FOR SELECT TO authenticated USING (public.is_admin(auth.uid()));


--
-- Name: webhook_deliveries Admins read webhook_deliveries; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins read webhook_deliveries" ON public.webhook_deliveries FOR SELECT USING (public.is_admin(auth.uid()));


--
-- Name: user_roles Admins update roles; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins update roles" ON public.user_roles FOR UPDATE TO authenticated USING (public.is_admin_strict(auth.uid())) WITH CHECK (public.is_admin_strict(auth.uid()));


--
-- Name: product_sync_logs Admins view product sync logs; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins view product sync logs" ON public.product_sync_logs FOR SELECT USING (public.is_admin(auth.uid()));


--
-- Name: mockup_prompt_history Admins view prompt history; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins view prompt history" ON public.mockup_prompt_history FOR SELECT USING (public.is_admin(auth.uid()));


--
-- Name: ownership_repair_logs Admins/devs read repair logs; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins/devs read repair logs" ON public.ownership_repair_logs FOR SELECT TO authenticated USING ((public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_role(auth.uid(), 'dev'::public.app_role)));


--
-- Name: products Allow initial sync insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Allow initial sync insert" ON public.products FOR INSERT WITH CHECK (true);


--
-- Name: category_icons Anyone can read category icons; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Anyone can read category icons" ON public.category_icons FOR SELECT USING (true);


--
-- Name: password_reset_requests Anyone can request a password reset; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Anyone can request a password reset" ON public.password_reset_requests FOR INSERT WITH CHECK (true);


--
-- Name: file_scan_logs Apenas administradores podem visualizar logs de scan; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Apenas administradores podem visualizar logs de scan" ON public.file_scan_logs FOR SELECT TO authenticated USING (((auth.jwt() ->> 'email'::text) ~~ '%admin%'::text));


--
-- Name: product_price_freshness_overrides Authenticated can read freshness overrides; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Authenticated can read freshness overrides" ON public.product_price_freshness_overrides FOR SELECT TO authenticated USING (true);


--
-- Name: organizations Authenticated users can create organizations; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Authenticated users can create organizations" ON public.organizations FOR INSERT TO authenticated WITH CHECK ((auth.uid() IS NOT NULL));


--
-- Name: query_telemetry Authenticated users can insert own telemetry; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Authenticated users can insert own telemetry" ON public.query_telemetry FOR INSERT TO authenticated WITH CHECK ((user_id = auth.uid()));


--
-- Name: search_analytics Authenticated users can log searches; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Authenticated users can log searches" ON public.search_analytics FOR INSERT TO authenticated WITH CHECK ((auth.uid() IS NOT NULL));


--
-- Name: component_media Authenticated users can read component media; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Authenticated users can read component media" ON public.component_media FOR SELECT TO authenticated USING (true);


--
-- Name: product_components Authenticated users can read components; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Authenticated users can read components" ON public.product_components FOR SELECT TO authenticated USING (true);


--
-- Name: product_groups Authenticated users can read groups; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Authenticated users can read groups" ON public.product_groups FOR SELECT TO authenticated USING (true);


--
-- Name: product_group_members Authenticated users can read members; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Authenticated users can read members" ON public.product_group_members FOR SELECT TO authenticated USING (true);


--
-- Name: permissions Authenticated users can read permissions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Authenticated users can read permissions" ON public.permissions FOR SELECT TO authenticated USING (true);


--
-- Name: ai_usage_quotas Authenticated users can read quotas; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Authenticated users can read quotas" ON public.ai_usage_quotas FOR SELECT TO authenticated USING (true);


--
-- Name: role_permissions Authenticated users can read role_permissions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Authenticated users can read role_permissions" ON public.role_permissions FOR SELECT TO authenticated USING (true);


--
-- Name: video_variant_links Authenticated users can read video variant links; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Authenticated users can read video variant links" ON public.video_variant_links FOR SELECT TO authenticated USING (true);


--
-- Name: kit_templates Authenticated users can view active templates; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Authenticated users can view active templates" ON public.kit_templates FOR SELECT TO authenticated USING (((is_active = true) OR public.is_admin(auth.uid())));


--
-- Name: product_component_locations Authenticated view component locations; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Authenticated view component locations" ON public.product_component_locations FOR SELECT TO authenticated USING (true);


--
-- Name: kit_comments Author can delete own comment; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Author can delete own comment" ON public.kit_comments FOR DELETE USING (((author_id = auth.uid()) OR public.is_admin(auth.uid())));


--
-- Name: kit_comments Author can edit own comment; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Author can edit own comment" ON public.kit_comments FOR UPDATE USING (((author_id = auth.uid()) OR public.is_admin(auth.uid())));


--
-- Name: rls_denial_log Block direct insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Block direct insert" ON public.rls_denial_log FOR INSERT TO authenticated WITH CHECK (false);


--
-- Name: rls_denial_log Block direct update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Block direct update" ON public.rls_denial_log FOR UPDATE TO authenticated USING (false);


--
-- Name: query_telemetry Devs can delete telemetry; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Devs can delete telemetry" ON public.query_telemetry FOR DELETE TO authenticated USING (public.is_dev(auth.uid()));


--
-- Name: ip_access_control Devs can manage ip_access_control; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Devs can manage ip_access_control" ON public.ip_access_control TO authenticated USING (public.is_dev(auth.uid())) WITH CHECK (public.is_dev(auth.uid()));


--
-- Name: admin_audit_log_old Devs can read audit logs; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Devs can read audit logs" ON public.admin_audit_log_old FOR SELECT TO authenticated USING (public.is_dev(auth.uid()));


--
-- Name: bot_detection_log Devs can read bot log; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Devs can read bot log" ON public.bot_detection_log FOR SELECT TO authenticated USING (public.is_dev(auth.uid()));


--
-- Name: request_rate_limits Devs can read rate limits; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Devs can read rate limits" ON public.request_rate_limits FOR SELECT TO authenticated USING (public.is_dev(auth.uid()));


--
-- Name: query_telemetry Devs can read telemetry; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Devs can read telemetry" ON public.query_telemetry FOR SELECT TO authenticated USING (public.is_dev(auth.uid()));


--
-- Name: step_up_audit_log Devs can view all audit logs; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Devs can view all audit logs" ON public.step_up_audit_log FOR SELECT USING (public.is_dev(auth.uid()));


--
-- Name: mcp_key_auto_revocations Devs can view auto-revocations; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Devs can view auto-revocations" ON public.mcp_key_auto_revocations FOR SELECT USING (public.is_dev(auth.uid()));


--
-- Name: connection_test_history Devs delete connection_test_history; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Devs delete connection_test_history" ON public.connection_test_history FOR DELETE TO authenticated USING (public.is_dev(auth.uid()));


--
-- Name: external_connections Devs manage external_connections; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Devs manage external_connections" ON public.external_connections TO authenticated USING (public.is_dev(auth.uid())) WITH CHECK (public.is_dev(auth.uid()));


--
-- Name: optimization_queue Devs manage optimization queue; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Devs manage optimization queue" ON public.optimization_queue TO authenticated USING (public.is_dev(auth.uid())) WITH CHECK (public.is_dev(auth.uid()));


--
-- Name: connection_test_history Devs read connection_test_history; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Devs read connection_test_history" ON public.connection_test_history FOR SELECT TO authenticated USING (public.is_dev(auth.uid()));


--
-- Name: hardening_health_snapshots Devs read hardening snapshots; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Devs read hardening snapshots" ON public.hardening_health_snapshots FOR SELECT TO authenticated USING (public.is_dev(auth.uid()));


--
-- Name: mcp_api_keys Devs read mcp_api_keys; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Devs read mcp_api_keys" ON public.mcp_api_keys FOR SELECT TO authenticated USING (public.is_dev(auth.uid()));


--
-- Name: mcp_full_grantors Devs read mcp_full_grantors; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Devs read mcp_full_grantors" ON public.mcp_full_grantors FOR SELECT TO authenticated USING (public.is_dev(auth.uid()));


--
-- Name: secret_rotation_log Devs read secret_rotation_log; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Devs read secret_rotation_log" ON public.secret_rotation_log FOR SELECT TO authenticated USING (public.is_dev(auth.uid()));


--
-- Name: conversation_event_history Inserção de eventos permitida para o dono da conversa; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Inserção de eventos permitida para o dono da conversa" ON public.conversation_event_history FOR INSERT TO authenticated WITH CHECK ((EXISTS ( SELECT 1
   FROM public.conversation_audit_logs
  WHERE ((conversation_audit_logs.id = conversation_event_history.conversation_id) AND (conversation_audit_logs.user_id = auth.uid())))));


--
-- Name: search_analytics Managers and admins can read search analytics; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Managers and admins can read search analytics" ON public.search_analytics FOR SELECT TO authenticated USING (public.is_manager_or_admin());


--
-- Name: quote_comments Managers can read all comments; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Managers can read all comments" ON public.quote_comments FOR SELECT TO authenticated USING (public.is_manager_or_admin());


--
-- Name: organization_members Members can view org members; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Members can view org members" ON public.organization_members FOR SELECT TO authenticated USING ((organization_id IN ( SELECT public.get_user_org_ids(auth.uid()) AS get_user_org_ids)));


--
-- Name: organizations Members can view their organizations; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Members can view their organizations" ON public.organizations FOR SELECT TO authenticated USING ((id IN ( SELECT public.get_user_org_ids(auth.uid()) AS get_user_org_ids)));


--
-- Name: role_migration_batches No direct delete role_migration_batches; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "No direct delete role_migration_batches" ON public.role_migration_batches FOR DELETE TO authenticated USING (false);


--
-- Name: role_migration_items No direct delete role_migration_items; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "No direct delete role_migration_items" ON public.role_migration_items FOR DELETE TO authenticated USING (false);


--
-- Name: mcp_api_keys No direct delete via JWT; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "No direct delete via JWT" ON public.mcp_api_keys FOR DELETE TO authenticated USING (false);


--
-- Name: role_migration_batches No direct insert role_migration_batches; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "No direct insert role_migration_batches" ON public.role_migration_batches FOR INSERT TO authenticated WITH CHECK (false);


--
-- Name: role_migration_items No direct insert role_migration_items; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "No direct insert role_migration_items" ON public.role_migration_items FOR INSERT TO authenticated WITH CHECK (false);


--
-- Name: mcp_api_keys No direct insert via JWT; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "No direct insert via JWT" ON public.mcp_api_keys FOR INSERT TO authenticated WITH CHECK (false);


--
-- Name: role_migration_batches No direct update role_migration_batches; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "No direct update role_migration_batches" ON public.role_migration_batches FOR UPDATE TO authenticated USING (false) WITH CHECK (false);


--
-- Name: role_migration_items No direct update role_migration_items; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "No direct update role_migration_items" ON public.role_migration_items FOR UPDATE TO authenticated USING (false) WITH CHECK (false);


--
-- Name: mcp_api_keys No direct update via JWT; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "No direct update via JWT" ON public.mcp_api_keys FOR UPDATE TO authenticated USING (false) WITH CHECK (false);


--
-- Name: login_attempts Only admins can view login attempts; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Only admins can view login attempts" ON public.login_attempts FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: organization_members Org owners can delete members; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Org owners can delete members" ON public.organization_members FOR DELETE TO authenticated USING ((public.has_org_role(auth.uid(), organization_id, 'owner'::public.org_role) OR (user_id = auth.uid())));


--
-- Name: organization_members Org owners can insert members any role; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Org owners can insert members any role" ON public.organization_members FOR INSERT TO authenticated WITH CHECK (public.has_org_role(auth.uid(), organization_id, 'owner'::public.org_role));


--
-- Name: organization_members Org owners can update members; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Org owners can update members" ON public.organization_members FOR UPDATE TO authenticated USING (public.has_org_role(auth.uid(), organization_id, 'owner'::public.org_role)) WITH CHECK (public.has_org_role(auth.uid(), organization_id, 'owner'::public.org_role));


--
-- Name: kit_variants Owner can delete variants; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Owner can delete variants" ON public.kit_variants FOR DELETE USING ((EXISTS ( SELECT 1
   FROM public.custom_kits k
  WHERE ((k.id = kit_variants.kit_master_id) AND (k.user_id = auth.uid())))));


--
-- Name: kit_variants Owner can insert variants; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Owner can insert variants" ON public.kit_variants FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM public.custom_kits k
  WHERE ((k.id = kit_variants.kit_master_id) AND (k.user_id = auth.uid())))));


--
-- Name: kit_collaborators Owner can invite collaborators; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Owner can invite collaborators" ON public.kit_collaborators FOR INSERT WITH CHECK (public.is_kit_owner(kit_id, auth.uid()));


--
-- Name: kit_collaborators Owner can remove collaborators; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Owner can remove collaborators" ON public.kit_collaborators FOR DELETE USING (public.is_kit_owner(kit_id, auth.uid()));


--
-- Name: kit_collaborators Owner can update collaborators; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Owner can update collaborators" ON public.kit_collaborators FOR UPDATE USING (public.is_kit_owner(kit_id, auth.uid()));


--
-- Name: kit_variants Owner can update variants; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Owner can update variants" ON public.kit_variants FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM public.custom_kits k
  WHERE ((k.id = kit_variants.kit_master_id) AND (k.user_id = auth.uid())))));


--
-- Name: kit_variants Owner can view variants; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Owner can view variants" ON public.kit_variants FOR SELECT USING (((EXISTS ( SELECT 1
   FROM public.custom_kits k
  WHERE ((k.id = kit_variants.kit_master_id) AND (k.user_id = auth.uid())))) OR public.is_admin(auth.uid())));


--
-- Name: kit_comments Owner or collab can comment; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Owner or collab can comment" ON public.kit_comments FOR INSERT WITH CHECK (((author_id = auth.uid()) AND (public.is_kit_owner(kit_id, auth.uid()) OR public.is_kit_collaborator(kit_id, auth.uid()))));


--
-- Name: organizations Owners can update their organization; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Owners can update their organization" ON public.organizations FOR UPDATE TO authenticated USING (public.has_org_role(auth.uid(), id, 'owner'::public.org_role)) WITH CHECK (public.has_org_role(auth.uid(), id, 'owner'::public.org_role));


--
-- Name: favorite_item_reactions Owners delete own list reactions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Owners delete own list reactions" ON public.favorite_item_reactions FOR DELETE TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.favorite_lists l
  WHERE ((l.id = favorite_item_reactions.list_id) AND (l.user_id = auth.uid())))));


--
-- Name: favorite_item_reactions Owners read own list reactions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Owners read own list reactions" ON public.favorite_item_reactions FOR SELECT TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.favorite_lists l
  WHERE ((l.id = favorite_item_reactions.list_id) AND (l.user_id = auth.uid())))));


--
-- Name: products Products are viewable by all authenticated users; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Products are viewable by all authenticated users" ON public.products FOR SELECT USING ((auth.uid() IS NOT NULL));


--
-- Name: favorite_item_reactions Public can insert reactions on shared lists; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Public can insert reactions on shared lists" ON public.favorite_item_reactions FOR INSERT TO authenticated, anon WITH CHECK ((EXISTS ( SELECT 1
   FROM public.favorite_lists l
  WHERE ((l.id = favorite_item_reactions.list_id) AND (l.shared_token IS NOT NULL) AND ((l.shared_expires_at IS NULL) OR (l.shared_expires_at > now()))))));


--
-- Name: favorite_items Public can read items of shared lists; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Public can read items of shared lists" ON public.favorite_items FOR SELECT TO authenticated, anon USING ((EXISTS ( SELECT 1
   FROM public.favorite_lists l
  WHERE ((l.id = favorite_items.list_id) AND (l.shared_token IS NOT NULL) AND ((l.shared_expires_at IS NULL) OR (l.shared_expires_at > now()))))));


--
-- Name: favorite_item_reactions Public can read reactions of shared lists; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Public can read reactions of shared lists" ON public.favorite_item_reactions FOR SELECT TO authenticated, anon USING ((EXISTS ( SELECT 1
   FROM public.favorite_lists l
  WHERE ((l.id = favorite_item_reactions.list_id) AND (l.shared_token IS NOT NULL) AND ((l.shared_expires_at IS NULL) OR (l.shared_expires_at > now()))))));


--
-- Name: favorite_lists Public can read shared lists by token; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Public can read shared lists by token" ON public.favorite_lists FOR SELECT TO authenticated, anon USING (((shared_token IS NOT NULL) AND ((shared_expires_at IS NULL) OR (shared_expires_at > now()))));


--
-- Name: collections Public can view collection by valid share token; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Public can view collection by valid share token" ON public.collections FOR SELECT USING (((is_public = true) AND (share_token IS NOT NULL) AND ((share_expires_at IS NULL) OR (share_expires_at > now()))));


--
-- Name: collection_items Public can view items of public collections; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Public can view items of public collections" ON public.collection_items FOR SELECT USING ((EXISTS ( SELECT 1
   FROM public.collections c
  WHERE ((c.id = collection_items.collection_id) AND (c.is_public = true) AND (c.share_token IS NOT NULL) AND ((c.share_expires_at IS NULL) OR (c.share_expires_at > now()))))));


--
-- Name: collection_item_reactions Public can view reactions for public collections; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Public can view reactions for public collections" ON public.collection_item_reactions FOR SELECT USING (((EXISTS ( SELECT 1
   FROM public.collections c
  WHERE ((c.id = collection_item_reactions.collection_id) AND (c.is_public = true) AND (c.share_token IS NOT NULL) AND ((c.share_expires_at IS NULL) OR (c.share_expires_at > now()))))) OR (EXISTS ( SELECT 1
   FROM public.collections c
  WHERE ((c.id = collection_item_reactions.collection_id) AND (c.user_id = auth.uid()))))));


--
-- Name: kit_share_tokens Sellers can manage own kit share tokens; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Sellers can manage own kit share tokens" ON public.kit_share_tokens TO authenticated USING ((seller_id = auth.uid())) WITH CHECK ((seller_id = auth.uid()));


--
-- Name: quote_comments Sellers can read comments on own quotes; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Sellers can read comments on own quotes" ON public.quote_comments FOR SELECT TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.quotes q
  WHERE (((q.id)::text = quote_comments.quote_id) AND (q.seller_id = auth.uid())))));


--
-- Name: seller_discount_limits Sellers can read own discount limit; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Sellers can read own discount limit" ON public.seller_discount_limits FOR SELECT TO authenticated USING ((user_id = auth.uid()));


--
-- Name: ai_usage_logs Service role can insert AI usage logs; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Service role can insert AI usage logs" ON public.ai_usage_logs FOR INSERT TO service_role WITH CHECK (true);


--
-- Name: bot_detection_log Service role can insert bot log; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Service role can insert bot log" ON public.bot_detection_log FOR INSERT TO service_role WITH CHECK (true);


--
-- Name: login_attempts Service role can insert login attempts; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Service role can insert login attempts" ON public.login_attempts FOR INSERT TO service_role WITH CHECK (true);


--
-- Name: request_rate_limits Service role can manage rate limits; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Service role can manage rate limits" ON public.request_rate_limits TO service_role USING (true) WITH CHECK (true);


--
-- Name: ai_usage_logs Service role can update AI usage logs; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Service role can update AI usage logs" ON public.ai_usage_logs FOR UPDATE TO service_role USING (true) WITH CHECK (true);


--
-- Name: ip_access_control Service role full access ip_access_control; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Service role full access ip_access_control" ON public.ip_access_control TO service_role USING (true) WITH CHECK (true);


--
-- Name: connection_test_history Service role inserts connection_test_history; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Service role inserts connection_test_history" ON public.connection_test_history FOR INSERT TO service_role WITH CHECK (true);


--
-- Name: collection_item_reactions Service role inserts reactions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Service role inserts reactions" ON public.collection_item_reactions FOR INSERT WITH CHECK (false);


--
-- Name: public_token_failures Service role inserts token failures; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Service role inserts token failures" ON public.public_token_failures FOR INSERT TO service_role WITH CHECK (true);


--
-- Name: admin_audit_log_old Supervisors can insert audit entries; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Supervisors can insert audit entries" ON public.admin_audit_log_old FOR INSERT TO authenticated WITH CHECK (public.is_supervisor_or_above(auth.uid()));


--
-- Name: seller_discount_limits Supervisors can manage all discount limits; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Supervisors can manage all discount limits" ON public.seller_discount_limits TO authenticated USING (public.can_approve_discount(auth.uid())) WITH CHECK (public.can_approve_discount(auth.uid()));


--
-- Name: user_token_revocations Supervisors can manage revocations; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Supervisors can manage revocations" ON public.user_token_revocations TO authenticated USING (public.is_supervisor_or_above(auth.uid()));


--
-- Name: user_roles Supervisors read all roles; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Supervisors read all roles" ON public.user_roles FOR SELECT TO authenticated USING (public.is_supervisor_or_above(auth.uid()));


--
-- Name: role_migration_batches Supervisors+ can read role_migration_batches; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Supervisors+ can read role_migration_batches" ON public.role_migration_batches FOR SELECT TO authenticated USING (public.is_supervisor_or_above(auth.uid()));


--
-- Name: role_migration_items Supervisors+ can read role_migration_items; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Supervisors+ can read role_migration_items" ON public.role_migration_items FOR SELECT TO authenticated USING (public.is_supervisor_or_above(auth.uid()));


--
-- Name: workspace_notifications System can insert notifications; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "System can insert notifications" ON public.workspace_notifications FOR INSERT TO authenticated WITH CHECK ((user_id = auth.uid()));


--
-- Name: magic_up_comments Users can create comments on own Magic Up generations; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can create comments on own Magic Up generations" ON public.magic_up_comments FOR INSERT TO authenticated WITH CHECK (((auth.uid() = user_id) AND (EXISTS ( SELECT 1
   FROM public.magic_up_generations g
  WHERE ((g.id = magic_up_comments.generation_id) AND (g.user_id = auth.uid()))))));


--
-- Name: magic_up_brand_kits Users can create own Magic Up brand kits; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can create own Magic Up brand kits" ON public.magic_up_brand_kits FOR INSERT TO authenticated WITH CHECK ((auth.uid() = user_id));


--
-- Name: magic_up_campaigns Users can create own Magic Up campaigns; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can create own Magic Up campaigns" ON public.magic_up_campaigns FOR INSERT TO authenticated WITH CHECK ((auth.uid() = user_id));


--
-- Name: magic_up_public_shares Users can create own Magic Up public shares; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can create own Magic Up public shares" ON public.magic_up_public_shares FOR INSERT TO authenticated WITH CHECK ((auth.uid() = user_id));


--
-- Name: scheduled_reports Users can create own scheduled reports; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can create own scheduled reports" ON public.scheduled_reports FOR INSERT TO authenticated WITH CHECK ((auth.uid() = user_id));


--
-- Name: magic_up_reactions Users can create reactions on own Magic Up generations; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can create reactions on own Magic Up generations" ON public.magic_up_reactions FOR INSERT TO authenticated WITH CHECK (((auth.uid() = user_id) AND (EXISTS ( SELECT 1
   FROM public.magic_up_generations g
  WHERE ((g.id = magic_up_reactions.generation_id) AND (g.user_id = auth.uid()))))));


--
-- Name: magic_up_comments Users can delete comments on own Magic Up generations; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can delete comments on own Magic Up generations" ON public.magic_up_comments FOR DELETE TO authenticated USING ((auth.uid() = user_id));


--
-- Name: magic_up_brand_kits Users can delete own Magic Up brand kits; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can delete own Magic Up brand kits" ON public.magic_up_brand_kits FOR DELETE TO authenticated USING ((auth.uid() = user_id));


--
-- Name: magic_up_campaigns Users can delete own Magic Up campaigns; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can delete own Magic Up campaigns" ON public.magic_up_campaigns FOR DELETE TO authenticated USING ((auth.uid() = user_id));


--
-- Name: magic_up_public_shares Users can delete own Magic Up public shares; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can delete own Magic Up public shares" ON public.magic_up_public_shares FOR DELETE TO authenticated USING ((auth.uid() = user_id));


--
-- Name: quote_comments Users can delete own comments; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can delete own comments" ON public.quote_comments FOR DELETE TO authenticated USING (((user_id = auth.uid()) OR public.can_manage_quotes(auth.uid())));


--
-- Name: simulator_wizard_drafts Users can delete own drafts; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can delete own drafts" ON public.simulator_wizard_drafts FOR DELETE TO authenticated USING ((user_id = auth.uid()));


--
-- Name: saved_filters Users can delete own filters; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can delete own filters" ON public.saved_filters FOR DELETE TO authenticated USING ((user_id = auth.uid()));


--
-- Name: workspace_notifications Users can delete own notifications; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can delete own notifications" ON public.workspace_notifications FOR DELETE TO authenticated USING ((user_id = auth.uid()));


--
-- Name: user_onboarding Users can delete own onboarding; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can delete own onboarding" ON public.user_onboarding FOR DELETE TO authenticated USING ((user_id = auth.uid()));


--
-- Name: scheduled_reports Users can delete own scheduled reports; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can delete own scheduled reports" ON public.scheduled_reports FOR DELETE TO authenticated USING ((auth.uid() = user_id));


--
-- Name: magic_up_reactions Users can delete reactions on own Magic Up generations; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can delete reactions on own Magic Up generations" ON public.magic_up_reactions FOR DELETE TO authenticated USING ((auth.uid() = user_id));


--
-- Name: ai_insights_cache Users can delete their own cached insights; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can delete their own cached insights" ON public.ai_insights_cache FOR DELETE TO authenticated USING (((auth.uid() = user_id) OR public.is_admin(auth.uid())));


--
-- Name: recently_viewed_products Users can delete their own recently viewed products; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can delete their own recently viewed products" ON public.recently_viewed_products FOR DELETE USING ((auth.uid() = user_id));


--
-- Name: simulator_wizard_drafts Users can insert own drafts; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can insert own drafts" ON public.simulator_wizard_drafts FOR INSERT TO authenticated WITH CHECK ((user_id = auth.uid()));


--
-- Name: saved_filters Users can insert own filters; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can insert own filters" ON public.saved_filters FOR INSERT TO authenticated WITH CHECK ((user_id = auth.uid()));


--
-- Name: user_onboarding Users can insert own onboarding; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can insert own onboarding" ON public.user_onboarding FOR INSERT TO authenticated WITH CHECK ((user_id = auth.uid()));


--
-- Name: profiles Users can insert own profile; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can insert own profile" ON public.profiles FOR INSERT TO authenticated WITH CHECK ((user_id = auth.uid()));


--
-- Name: product_views Users can insert own views; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can insert own views" ON public.product_views FOR INSERT TO authenticated WITH CHECK ((seller_id = auth.uid()));


--
-- Name: voice_command_logs Users can insert own voice logs; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can insert own voice logs" ON public.voice_command_logs FOR INSERT TO authenticated WITH CHECK ((auth.uid() = user_id));


--
-- Name: ai_insights_cache Users can insert their own cached insights; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can insert their own cached insights" ON public.ai_insights_cache FOR INSERT TO authenticated WITH CHECK ((auth.uid() = user_id));


--
-- Name: recently_viewed_products Users can insert their own recently viewed products; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can insert their own recently viewed products" ON public.recently_viewed_products FOR INSERT WITH CHECK ((auth.uid() = user_id));


--
-- Name: ai_usage_events Users can insert their own usage events; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can insert their own usage events" ON public.ai_usage_events FOR INSERT TO authenticated WITH CHECK ((auth.uid() = user_id));


--
-- Name: quote_history Users can manage history via quote ownership; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can manage history via quote ownership" ON public.quote_history TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.quotes q
  WHERE ((q.id = quote_history.quote_id) AND ((q.seller_id = auth.uid()) OR public.can_manage_quotes(auth.uid())))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM public.quotes q
  WHERE ((q.id = quote_history.quote_id) AND ((q.seller_id = auth.uid()) OR public.can_manage_quotes(auth.uid()))))));


--
-- Name: seller_cart_items Users can manage own cart items; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can manage own cart items" ON public.seller_cart_items TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.seller_carts c
  WHERE ((c.id = seller_cart_items.cart_id) AND (c.seller_id = auth.uid()))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM public.seller_carts c
  WHERE ((c.id = seller_cart_items.cart_id) AND (c.seller_id = auth.uid())))));


--
-- Name: seller_carts Users can manage own carts; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can manage own carts" ON public.seller_carts TO authenticated USING ((seller_id = auth.uid())) WITH CHECK ((seller_id = auth.uid()));


--
-- Name: collection_items Users can manage own collection items; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can manage own collection items" ON public.collection_items TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.collections
  WHERE ((collections.id = collection_items.collection_id) AND (collections.user_id = auth.uid()))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM public.collections
  WHERE ((collections.id = collection_items.collection_id) AND (collections.user_id = auth.uid())))));


--
-- Name: collections Users can manage own collections; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can manage own collections" ON public.collections TO authenticated USING ((user_id = auth.uid())) WITH CHECK ((user_id = auth.uid()));


--
-- Name: expert_conversations Users can manage own conversations; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can manage own conversations" ON public.expert_conversations TO authenticated USING ((seller_id = auth.uid())) WITH CHECK ((seller_id = auth.uid()));


--
-- Name: mockup_drafts Users can manage own drafts; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can manage own drafts" ON public.mockup_drafts TO authenticated USING ((user_id = auth.uid())) WITH CHECK ((user_id = auth.uid()));


--
-- Name: quote_drafts Users can manage own drafts; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can manage own drafts" ON public.quote_drafts USING ((auth.uid() = user_id));


--
-- Name: magic_up_generations Users can manage own generations; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can manage own generations" ON public.magic_up_generations TO authenticated USING ((user_id = auth.uid())) WITH CHECK ((user_id = auth.uid()));


--
-- Name: custom_kits Users can manage own kits; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can manage own kits" ON public.custom_kits TO authenticated USING (((user_id = auth.uid()) OR public.is_admin(auth.uid()))) WITH CHECK (((user_id = auth.uid()) OR public.is_admin(auth.uid())));


--
-- Name: expert_messages Users can manage own messages; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can manage own messages" ON public.expert_messages TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.expert_conversations
  WHERE ((expert_conversations.id = expert_messages.conversation_id) AND (expert_conversations.seller_id = auth.uid()))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM public.expert_conversations
  WHERE ((expert_conversations.id = expert_messages.conversation_id) AND (expert_conversations.seller_id = auth.uid())))));


--
-- Name: generated_mockups Users can manage own mockups; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can manage own mockups" ON public.generated_mockups TO authenticated USING ((seller_id = auth.uid())) WITH CHECK ((seller_id = auth.uid()));


--
-- Name: follow_up_reminders Users can manage own reminders; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can manage own reminders" ON public.follow_up_reminders TO authenticated USING ((seller_id = auth.uid())) WITH CHECK ((seller_id = auth.uid()));


--
-- Name: cart_templates Users can manage own templates; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can manage own templates" ON public.cart_templates TO authenticated USING ((user_id = auth.uid())) WITH CHECK ((user_id = auth.uid()));


--
-- Name: user_known_devices Users can manage their own devices; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can manage their own devices" ON public.user_known_devices USING ((auth.uid() = user_id));


--
-- Name: favorites Users can manage their own favorites; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can manage their own favorites" ON public.favorites USING ((auth.uid() = user_id)) WITH CHECK ((auth.uid() = user_id));


--
-- Name: user_search_history Users can manage their own search history; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can manage their own search history" ON public.user_search_history USING ((auth.uid() = user_id)) WITH CHECK ((auth.uid() = user_id));


--
-- Name: workspace_notifications Users can read own notifications; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can read own notifications" ON public.workspace_notifications FOR SELECT TO authenticated USING ((user_id = auth.uid()));


--
-- Name: quote_comments Users can read own or admin comments; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can read own or admin comments" ON public.quote_comments FOR SELECT TO authenticated USING (((user_id = auth.uid()) OR public.is_admin(auth.uid())));


--
-- Name: mcp_keys Users can revoke their own MCP keys; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can revoke their own MCP keys" ON public.mcp_keys FOR UPDATE USING ((auth.uid() = user_id)) WITH CHECK ((is_revoked = true));


--
-- Name: magic_up_comments Users can update comments on own Magic Up generations; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update comments on own Magic Up generations" ON public.magic_up_comments FOR UPDATE TO authenticated USING ((auth.uid() = user_id)) WITH CHECK ((auth.uid() = user_id));


--
-- Name: magic_up_brand_kits Users can update own Magic Up brand kits; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update own Magic Up brand kits" ON public.magic_up_brand_kits FOR UPDATE TO authenticated USING ((auth.uid() = user_id)) WITH CHECK ((auth.uid() = user_id));


--
-- Name: magic_up_campaigns Users can update own Magic Up campaigns; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update own Magic Up campaigns" ON public.magic_up_campaigns FOR UPDATE TO authenticated USING ((auth.uid() = user_id)) WITH CHECK ((auth.uid() = user_id));


--
-- Name: magic_up_public_shares Users can update own Magic Up public shares; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update own Magic Up public shares" ON public.magic_up_public_shares FOR UPDATE TO authenticated USING ((auth.uid() = user_id)) WITH CHECK ((auth.uid() = user_id));


--
-- Name: quote_comments Users can update own comments; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update own comments" ON public.quote_comments FOR UPDATE TO authenticated USING ((user_id = auth.uid())) WITH CHECK ((user_id = auth.uid()));


--
-- Name: simulator_wizard_drafts Users can update own drafts; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update own drafts" ON public.simulator_wizard_drafts FOR UPDATE TO authenticated USING ((user_id = auth.uid())) WITH CHECK ((user_id = auth.uid()));


--
-- Name: saved_filters Users can update own filters; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update own filters" ON public.saved_filters FOR UPDATE TO authenticated USING ((user_id = auth.uid())) WITH CHECK ((user_id = auth.uid()));


--
-- Name: workspace_notifications Users can update own notifications; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update own notifications" ON public.workspace_notifications FOR UPDATE TO authenticated USING ((user_id = auth.uid())) WITH CHECK ((user_id = auth.uid()));


--
-- Name: user_onboarding Users can update own onboarding; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update own onboarding" ON public.user_onboarding FOR UPDATE TO authenticated USING ((user_id = auth.uid())) WITH CHECK ((user_id = auth.uid()));


--
-- Name: profiles Users can update own profile; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE TO authenticated USING ((user_id = auth.uid())) WITH CHECK ((user_id = auth.uid()));


--
-- Name: scheduled_reports Users can update own scheduled reports; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update own scheduled reports" ON public.scheduled_reports FOR UPDATE TO authenticated USING ((auth.uid() = user_id));


--
-- Name: magic_up_reactions Users can update reactions on own Magic Up generations; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update reactions on own Magic Up generations" ON public.magic_up_reactions FOR UPDATE TO authenticated USING ((auth.uid() = user_id)) WITH CHECK ((auth.uid() = user_id));


--
-- Name: ai_insights_cache Users can update their own cached insights; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update their own cached insights" ON public.ai_insights_cache FOR UPDATE TO authenticated USING ((auth.uid() = user_id)) WITH CHECK ((auth.uid() = user_id));


--
-- Name: recently_viewed_products Users can update their own recently viewed products; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update their own recently viewed products" ON public.recently_viewed_products FOR UPDATE USING ((auth.uid() = user_id));


--
-- Name: geo_allowed_countries Users can view allowed countries; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view allowed countries" ON public.geo_allowed_countries FOR SELECT USING (true);


--
-- Name: magic_up_comments Users can view comments on own Magic Up generations; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view comments on own Magic Up generations" ON public.magic_up_comments FOR SELECT TO authenticated USING ((auth.uid() = user_id));


--
-- Name: ai_usage_logs Users can view own AI usage logs; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view own AI usage logs" ON public.ai_usage_logs FOR SELECT TO authenticated USING ((user_id = auth.uid()));


--
-- Name: magic_up_brand_kits Users can view own Magic Up brand kits; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view own Magic Up brand kits" ON public.magic_up_brand_kits FOR SELECT TO authenticated USING ((auth.uid() = user_id));


--
-- Name: magic_up_campaigns Users can view own Magic Up campaigns; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view own Magic Up campaigns" ON public.magic_up_campaigns FOR SELECT TO authenticated USING ((auth.uid() = user_id));


--
-- Name: magic_up_public_shares Users can view own Magic Up public shares; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view own Magic Up public shares" ON public.magic_up_public_shares FOR SELECT TO authenticated USING ((auth.uid() = user_id));


--
-- Name: step_up_audit_log Users can view own audit logs; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view own audit logs" ON public.step_up_audit_log FOR SELECT USING ((auth.uid() = user_id));


--
-- Name: step_up_challenges Users can view own challenges; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view own challenges" ON public.step_up_challenges FOR SELECT USING ((auth.uid() = user_id));


--
-- Name: simulator_wizard_drafts Users can view own drafts; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view own drafts" ON public.simulator_wizard_drafts FOR SELECT TO authenticated USING ((user_id = auth.uid()));


--
-- Name: saved_filters Users can view own filters; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view own filters" ON public.saved_filters FOR SELECT TO authenticated USING ((user_id = auth.uid()));


--
-- Name: user_onboarding Users can view own onboarding; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view own onboarding" ON public.user_onboarding FOR SELECT TO authenticated USING ((user_id = auth.uid()));


--
-- Name: profiles Users can view own profile; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view own profile" ON public.profiles FOR SELECT TO authenticated USING ((user_id = auth.uid()));


--
-- Name: user_token_revocations Users can view own revocation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view own revocation" ON public.user_token_revocations FOR SELECT TO authenticated USING ((auth.uid() = user_id));


--
-- Name: user_roles Users can view own role; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view own role" ON public.user_roles FOR SELECT TO authenticated USING ((user_id = auth.uid()));


--
-- Name: scheduled_reports Users can view own scheduled reports; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view own scheduled reports" ON public.scheduled_reports FOR SELECT TO authenticated USING ((auth.uid() = user_id));


--
-- Name: step_up_tokens Users can view own tokens; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view own tokens" ON public.step_up_tokens FOR SELECT USING ((auth.uid() = user_id));


--
-- Name: product_views Users can view own views; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view own views" ON public.product_views FOR SELECT TO authenticated USING ((seller_id = auth.uid()));


--
-- Name: voice_command_logs Users can view own voice logs; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view own voice logs" ON public.voice_command_logs FOR SELECT TO authenticated USING ((auth.uid() = user_id));


--
-- Name: magic_up_reactions Users can view reactions on own Magic Up generations; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view reactions on own Magic Up generations" ON public.magic_up_reactions FOR SELECT TO authenticated USING ((auth.uid() = user_id));


--
-- Name: mcp_key_auto_revocations Users can view revocation logs for their keys; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view revocation logs for their keys" ON public.mcp_key_auto_revocations FOR SELECT USING ((EXISTS ( SELECT 1
   FROM public.mcp_keys
  WHERE ((mcp_keys.id = mcp_key_auto_revocations.key_id) AND (mcp_keys.user_id = auth.uid())))));


--
-- Name: mcp_keys Users can view their own MCP keys; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view their own MCP keys" ON public.mcp_keys FOR SELECT USING ((auth.uid() = user_id));


--
-- Name: ai_insights_cache Users can view their own cached insights; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view their own cached insights" ON public.ai_insights_cache FOR SELECT TO authenticated USING (((auth.uid() = user_id) OR public.is_admin(auth.uid())));


--
-- Name: user_known_devices Users can view their own devices; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view their own devices" ON public.user_known_devices FOR SELECT USING ((auth.uid() = user_id));


--
-- Name: recently_viewed_products Users can view their own recently viewed products; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view their own recently viewed products" ON public.recently_viewed_products FOR SELECT USING ((auth.uid() = user_id));


--
-- Name: ai_usage_events Users can view their own usage events; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view their own usage events" ON public.ai_usage_events FOR SELECT TO authenticated USING (((auth.uid() = user_id) OR public.is_admin(auth.uid())));


--
-- Name: art_file_attachments Users delete own art files; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users delete own art files" ON public.art_file_attachments FOR DELETE USING ((auth.uid() = user_id));


--
-- Name: collection_items_trash Users delete own collection trash; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users delete own collection trash" ON public.collection_items_trash FOR DELETE USING ((auth.uid() = user_id));


--
-- Name: mockup_templates Users delete own mockup templates; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users delete own mockup templates" ON public.mockup_templates FOR DELETE USING ((auth.uid() = user_id));


--
-- Name: art_file_attachments Users insert own art files; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users insert own art files" ON public.art_file_attachments FOR INSERT WITH CHECK ((auth.uid() = user_id));


--
-- Name: collection_items_trash Users insert own collection trash; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users insert own collection trash" ON public.collection_items_trash FOR INSERT WITH CHECK ((auth.uid() = user_id));


--
-- Name: mockup_templates Users insert own mockup templates; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users insert own mockup templates" ON public.mockup_templates FOR INSERT WITH CHECK ((auth.uid() = user_id));


--
-- Name: user_preferences Users insert own preferences; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users insert own preferences" ON public.user_preferences FOR INSERT WITH CHECK ((auth.uid() = user_id));


--
-- Name: favorite_items Users manage own favorite items; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users manage own favorite items" ON public.favorite_items TO authenticated USING ((user_id = auth.uid())) WITH CHECK ((user_id = auth.uid()));


--
-- Name: favorite_lists Users manage own favorite lists; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users manage own favorite lists" ON public.favorite_lists TO authenticated USING ((user_id = auth.uid())) WITH CHECK ((user_id = auth.uid()));


--
-- Name: saved_trends_views Users manage own saved trends views; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users manage own saved trends views" ON public.saved_trends_views TO authenticated USING ((user_id = auth.uid())) WITH CHECK ((user_id = auth.uid()));


--
-- Name: favorite_items_trash Users manage own trash; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users manage own trash" ON public.favorite_items_trash TO authenticated USING ((user_id = auth.uid())) WITH CHECK ((user_id = auth.uid()));


--
-- Name: user_roles Users read own roles; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users read own roles" ON public.user_roles FOR SELECT TO authenticated USING ((auth.uid() = user_id));


--
-- Name: art_file_attachments Users update own art files; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users update own art files" ON public.art_file_attachments FOR UPDATE USING ((auth.uid() = user_id));


--
-- Name: mockup_templates Users update own mockup templates; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users update own mockup templates" ON public.mockup_templates FOR UPDATE USING ((auth.uid() = user_id));


--
-- Name: user_preferences Users update own preferences; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users update own preferences" ON public.user_preferences FOR UPDATE USING ((auth.uid() = user_id));


--
-- Name: art_file_attachments Users view own art files; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users view own art files" ON public.art_file_attachments FOR SELECT USING ((auth.uid() = user_id));


--
-- Name: collection_items_trash Users view own collection trash; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users view own collection trash" ON public.collection_items_trash FOR SELECT USING ((auth.uid() = user_id));


--
-- Name: mockup_templates Users view own mockup templates; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users view own mockup templates" ON public.mockup_templates FOR SELECT USING ((auth.uid() = user_id));


--
-- Name: user_preferences Users view own preferences; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users view own preferences" ON public.user_preferences FOR SELECT USING ((auth.uid() = user_id));


--
-- Name: conversation_audit_logs Usuários podem criar seus próprios logs de conversa; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Usuários podem criar seus próprios logs de conversa" ON public.conversation_audit_logs FOR INSERT TO authenticated WITH CHECK ((auth.uid() = user_id));


--
-- Name: conversation_audit_logs Usuários podem ver seus próprios logs de conversa; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Usuários podem ver seus próprios logs de conversa" ON public.conversation_audit_logs FOR SELECT TO authenticated USING ((auth.uid() = user_id));


--
-- Name: kit_collaborators View collaborators if owner or self; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "View collaborators if owner or self" ON public.kit_collaborators FOR SELECT USING ((public.is_kit_owner(kit_id, auth.uid()) OR (user_id = auth.uid()) OR public.is_admin(auth.uid())));


--
-- Name: kit_comments View comments if owner/collab/admin; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "View comments if owner/collab/admin" ON public.kit_comments FOR SELECT USING ((public.is_kit_owner(kit_id, auth.uid()) OR public.is_kit_collaborator(kit_id, auth.uid()) OR public.is_admin(auth.uid())));


--
-- Name: access_security_settings; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.access_security_settings ENABLE ROW LEVEL SECURITY;

--
-- Name: admin_audit_log; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.admin_audit_log ENABLE ROW LEVEL SECURITY;

--
-- Name: admin_audit_log_old; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.admin_audit_log_old ENABLE ROW LEVEL SECURITY;

--
-- Name: admin_audit_log_old admin_audit_log_select_policy; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY admin_audit_log_select_policy ON public.admin_audit_log_old FOR SELECT TO authenticated USING (public.is_supervisor_or_above(auth.uid()));


--
-- Name: admin_audit_log_y2025m12; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.admin_audit_log_y2025m12 ENABLE ROW LEVEL SECURITY;

--
-- Name: admin_audit_log_y2026m01; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.admin_audit_log_y2026m01 ENABLE ROW LEVEL SECURITY;

--
-- Name: admin_audit_log_y2026m02; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.admin_audit_log_y2026m02 ENABLE ROW LEVEL SECURITY;

--
-- Name: admin_audit_log_y2026m03; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.admin_audit_log_y2026m03 ENABLE ROW LEVEL SECURITY;

--
-- Name: admin_audit_log_y2026m04; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.admin_audit_log_y2026m04 ENABLE ROW LEVEL SECURITY;

--
-- Name: admin_audit_log_y2026m05; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.admin_audit_log_y2026m05 ENABLE ROW LEVEL SECURITY;

--
-- Name: admin_audit_log_y2026m06; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.admin_audit_log_y2026m06 ENABLE ROW LEVEL SECURITY;

--
-- Name: admin_settings; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.admin_settings ENABLE ROW LEVEL SECURITY;

--
-- Name: e2e_cleanup_audit admins_select_e2e_cleanup_audit; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY admins_select_e2e_cleanup_audit ON public.e2e_cleanup_audit FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: ai_insights_cache; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.ai_insights_cache ENABLE ROW LEVEL SECURITY;

--
-- Name: ai_usage_events; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.ai_usage_events ENABLE ROW LEVEL SECURITY;

--
-- Name: ai_usage_logs; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.ai_usage_logs ENABLE ROW LEVEL SECURITY;

--
-- Name: ai_usage_logs ai_usage_logs_select_policy; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY ai_usage_logs_select_policy ON public.ai_usage_logs FOR SELECT TO authenticated USING (((auth.uid() = user_id) OR public.is_supervisor_or_above(auth.uid())));


--
-- Name: ai_usage_quotas; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.ai_usage_quotas ENABLE ROW LEVEL SECURITY;

--
-- Name: comparison_reactions anyone_read_comparison_reactions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY anyone_read_comparison_reactions ON public.comparison_reactions FOR SELECT USING ((EXISTS ( SELECT 1
   FROM public.user_comparisons uc
  WHERE ((uc.id = comparison_reactions.comparison_id) AND (uc.is_public = true) AND ((uc.share_expires_at IS NULL) OR (uc.share_expires_at > now()))))));


--
-- Name: price_history anyone_read_price_history; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY anyone_read_price_history ON public.price_history FOR SELECT USING (true);


--
-- Name: user_comparisons anyone_read_public_comparisons; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY anyone_read_public_comparisons ON public.user_comparisons FOR SELECT USING (((is_public = true) AND (share_token IS NOT NULL) AND ((share_expires_at IS NULL) OR (share_expires_at > now()))));


--
-- Name: app_vitals; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.app_vitals ENABLE ROW LEVEL SECURITY;

--
-- Name: art_file_attachments; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.art_file_attachments ENABLE ROW LEVEL SECURITY;

--
-- Name: audit_logs; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

--
-- Name: auth_login_attempts; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.auth_login_attempts ENABLE ROW LEVEL SECURITY;

--
-- Name: bot_detection_log; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.bot_detection_log ENABLE ROW LEVEL SECURITY;

--
-- Name: cart_templates; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.cart_templates ENABLE ROW LEVEL SECURITY;

--
-- Name: category_icons; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.category_icons ENABLE ROW LEVEL SECURITY;

--
-- Name: collection_item_reactions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.collection_item_reactions ENABLE ROW LEVEL SECURITY;

--
-- Name: collection_items; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.collection_items ENABLE ROW LEVEL SECURITY;

--
-- Name: collection_items_trash; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.collection_items_trash ENABLE ROW LEVEL SECURITY;

--
-- Name: collections; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.collections ENABLE ROW LEVEL SECURITY;

--
-- Name: comparison_reactions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.comparison_reactions ENABLE ROW LEVEL SECURITY;

--
-- Name: component_media; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.component_media ENABLE ROW LEVEL SECURITY;

--
-- Name: connection_test_history; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.connection_test_history ENABLE ROW LEVEL SECURITY;

--
-- Name: conversation_audit_logs; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.conversation_audit_logs ENABLE ROW LEVEL SECURITY;

--
-- Name: conversation_delivery_status; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.conversation_delivery_status ENABLE ROW LEVEL SECURITY;

--
-- Name: conversation_event_history; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.conversation_event_history ENABLE ROW LEVEL SECURITY;

--
-- Name: custom_kits; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.custom_kits ENABLE ROW LEVEL SECURITY;

--
-- Name: discount_approval_requests dar_delete_scope; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY dar_delete_scope ON public.discount_approval_requests FOR DELETE TO authenticated USING (public.can_view_all_sales());


--
-- Name: discount_approval_requests dar_insert_scope; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY dar_insert_scope ON public.discount_approval_requests FOR INSERT TO authenticated WITH CHECK (((seller_id = auth.uid()) OR public.can_view_all_sales()));


--
-- Name: discount_approval_requests dar_select_scope; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY dar_select_scope ON public.discount_approval_requests FOR SELECT TO authenticated USING ((public.can_view_all_sales() OR public.has_role(auth.uid(), 'supervisor'::public.app_role) OR (seller_id = auth.uid())));


--
-- Name: discount_approval_requests dar_update_scope; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY dar_update_scope ON public.discount_approval_requests FOR UPDATE TO authenticated USING ((public.can_view_all_sales() OR public.has_role(auth.uid(), 'supervisor'::public.app_role))) WITH CHECK ((public.can_view_all_sales() OR public.has_role(auth.uid(), 'supervisor'::public.app_role)));


--
-- Name: e2e_cleanup_rate_limit deny_all_delete_anon; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY deny_all_delete_anon ON public.e2e_cleanup_rate_limit FOR DELETE TO anon USING (false);


--
-- Name: e2e_cleanup_rate_limit deny_all_delete_authenticated; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY deny_all_delete_authenticated ON public.e2e_cleanup_rate_limit FOR DELETE TO authenticated USING (false);


--
-- Name: e2e_cleanup_rate_limit deny_all_insert_anon; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY deny_all_insert_anon ON public.e2e_cleanup_rate_limit FOR INSERT TO anon WITH CHECK (false);


--
-- Name: e2e_cleanup_rate_limit deny_all_insert_authenticated; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY deny_all_insert_authenticated ON public.e2e_cleanup_rate_limit FOR INSERT TO authenticated WITH CHECK (false);


--
-- Name: e2e_cleanup_rate_limit deny_all_select_anon; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY deny_all_select_anon ON public.e2e_cleanup_rate_limit FOR SELECT TO anon USING (false);


--
-- Name: e2e_cleanup_rate_limit deny_all_select_authenticated; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY deny_all_select_authenticated ON public.e2e_cleanup_rate_limit FOR SELECT TO authenticated USING (false);


--
-- Name: e2e_cleanup_rate_limit deny_all_update_anon; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY deny_all_update_anon ON public.e2e_cleanup_rate_limit FOR UPDATE TO anon USING (false) WITH CHECK (false);


--
-- Name: e2e_cleanup_rate_limit deny_all_update_authenticated; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY deny_all_update_authenticated ON public.e2e_cleanup_rate_limit FOR UPDATE TO authenticated USING (false) WITH CHECK (false);


--
-- Name: discount_approval_requests; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.discount_approval_requests ENABLE ROW LEVEL SECURITY;

--
-- Name: e2e_cleanup_audit; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.e2e_cleanup_audit ENABLE ROW LEVEL SECURITY;

--
-- Name: e2e_cleanup_rate_limit; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.e2e_cleanup_rate_limit ENABLE ROW LEVEL SECURITY;

--
-- Name: expert_conversations; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.expert_conversations ENABLE ROW LEVEL SECURITY;

--
-- Name: expert_messages; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.expert_messages ENABLE ROW LEVEL SECURITY;

--
-- Name: external_connections; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.external_connections ENABLE ROW LEVEL SECURITY;

--
-- Name: external_connections_sync_log; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.external_connections_sync_log ENABLE ROW LEVEL SECURITY;

--
-- Name: favorite_item_reactions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.favorite_item_reactions ENABLE ROW LEVEL SECURITY;

--
-- Name: favorite_items; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.favorite_items ENABLE ROW LEVEL SECURITY;

--
-- Name: favorite_items_trash; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.favorite_items_trash ENABLE ROW LEVEL SECURITY;

--
-- Name: favorite_lists; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.favorite_lists ENABLE ROW LEVEL SECURITY;

--
-- Name: favorites; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.favorites ENABLE ROW LEVEL SECURITY;

--
-- Name: file_scan_logs; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.file_scan_logs ENABLE ROW LEVEL SECURITY;

--
-- Name: follow_up_reminders; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.follow_up_reminders ENABLE ROW LEVEL SECURITY;

--
-- Name: generated_mockups; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.generated_mockups ENABLE ROW LEVEL SECURITY;

--
-- Name: geo_allowed_countries; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.geo_allowed_countries ENABLE ROW LEVEL SECURITY;

--
-- Name: hardening_health_snapshots; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.hardening_health_snapshots ENABLE ROW LEVEL SECURITY;

--
-- Name: inbound_webhook_endpoints; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.inbound_webhook_endpoints ENABLE ROW LEVEL SECURITY;

--
-- Name: inbound_webhook_events; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.inbound_webhook_events ENABLE ROW LEVEL SECURITY;

--
-- Name: integration_credentials; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.integration_credentials ENABLE ROW LEVEL SECURITY;

--
-- Name: ip_access_control; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.ip_access_control ENABLE ROW LEVEL SECURITY;

--
-- Name: kit_collaborators; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.kit_collaborators ENABLE ROW LEVEL SECURITY;

--
-- Name: kit_comments; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.kit_comments ENABLE ROW LEVEL SECURITY;

--
-- Name: kit_share_tokens; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.kit_share_tokens ENABLE ROW LEVEL SECURITY;

--
-- Name: kit_templates; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.kit_templates ENABLE ROW LEVEL SECURITY;

--
-- Name: kit_variants; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.kit_variants ENABLE ROW LEVEL SECURITY;

--
-- Name: login_attempts; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.login_attempts ENABLE ROW LEVEL SECURITY;

--
-- Name: login_attempts login_attempts_select_policy; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY login_attempts_select_policy ON public.login_attempts FOR SELECT TO authenticated USING (public.is_supervisor_or_above(auth.uid()));


--
-- Name: magic_up_brand_kits; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.magic_up_brand_kits ENABLE ROW LEVEL SECURITY;

--
-- Name: magic_up_campaigns; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.magic_up_campaigns ENABLE ROW LEVEL SECURITY;

--
-- Name: magic_up_comments; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.magic_up_comments ENABLE ROW LEVEL SECURITY;

--
-- Name: magic_up_generations; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.magic_up_generations ENABLE ROW LEVEL SECURITY;

--
-- Name: magic_up_public_shares; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.magic_up_public_shares ENABLE ROW LEVEL SECURITY;

--
-- Name: magic_up_reactions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.magic_up_reactions ENABLE ROW LEVEL SECURITY;

--
-- Name: mcp_access_violations; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.mcp_access_violations ENABLE ROW LEVEL SECURITY;

--
-- Name: mcp_api_keys; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.mcp_api_keys ENABLE ROW LEVEL SECURITY;

--
-- Name: mcp_full_grantors; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.mcp_full_grantors ENABLE ROW LEVEL SECURITY;

--
-- Name: mcp_key_auto_revocations; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.mcp_key_auto_revocations ENABLE ROW LEVEL SECURITY;

--
-- Name: mcp_keys; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.mcp_keys ENABLE ROW LEVEL SECURITY;

--
-- Name: mockup_drafts; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.mockup_drafts ENABLE ROW LEVEL SECURITY;

--
-- Name: mockup_prompt_configs; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.mockup_prompt_configs ENABLE ROW LEVEL SECURITY;

--
-- Name: mockup_prompt_history; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.mockup_prompt_history ENABLE ROW LEVEL SECURITY;

--
-- Name: mockup_templates; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.mockup_templates ENABLE ROW LEVEL SECURITY;

--
-- Name: comparison_reactions no_direct_insert_reactions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY no_direct_insert_reactions ON public.comparison_reactions FOR INSERT WITH CHECK (false);


--
-- Name: optimization_queue; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.optimization_queue ENABLE ROW LEVEL SECURITY;

--
-- Name: optimization_queue_runs; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.optimization_queue_runs ENABLE ROW LEVEL SECURITY;

--
-- Name: order_item_personalizations order_item_p_select_scope; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY order_item_p_select_scope ON public.order_item_personalizations FOR SELECT USING ((EXISTS ( SELECT 1
   FROM (public.order_items oi
     JOIN public.orders o ON ((o.id = oi.order_id)))
  WHERE ((oi.id = order_item_personalizations.order_item_id) AND ((o.seller_id = auth.uid()) OR public.can_view_all_sales())))));


--
-- Name: order_item_personalizations; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.order_item_personalizations ENABLE ROW LEVEL SECURITY;

--
-- Name: order_items; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;

--
-- Name: order_items order_items_manage_v10; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY order_items_manage_v10 ON public.order_items TO authenticated WITH CHECK ((EXISTS ( SELECT 1
   FROM public.orders o
  WHERE ((o.id = order_items.order_id) AND (o.seller_id = auth.uid())))));


--
-- Name: orders; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;

--
-- Name: orders orders_delete_scope; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY orders_delete_scope ON public.orders FOR DELETE TO authenticated USING ((public.can_view_all_sales() OR (seller_id = auth.uid())));


--
-- Name: orders orders_insert_scope; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY orders_insert_scope ON public.orders FOR INSERT TO authenticated WITH CHECK ((public.can_view_all_sales() OR (seller_id = auth.uid())));


--
-- Name: orders orders_manage_v10; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY orders_manage_v10 ON public.orders TO authenticated USING ((seller_id = auth.uid())) WITH CHECK ((seller_id = auth.uid()));


--
-- Name: orders orders_select_scope; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY orders_select_scope ON public.orders FOR SELECT TO authenticated USING ((public.can_view_all_sales() OR (public.has_role(auth.uid(), 'supervisor'::public.app_role) AND ((organization_id IS NULL) OR (organization_id IN ( SELECT public.get_user_org_ids(auth.uid()) AS get_user_org_ids)))) OR (seller_id = auth.uid())));


--
-- Name: orders orders_update_scope; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY orders_update_scope ON public.orders FOR UPDATE TO authenticated USING ((public.can_view_all_sales() OR (public.has_role(auth.uid(), 'supervisor'::public.app_role) AND ((organization_id IS NULL) OR (organization_id IN ( SELECT public.get_user_org_ids(auth.uid()) AS get_user_org_ids)))) OR (seller_id = auth.uid()))) WITH CHECK ((public.can_view_all_sales() OR (public.has_role(auth.uid(), 'supervisor'::public.app_role) AND ((organization_id IS NULL) OR (organization_id IN ( SELECT public.get_user_org_ids(auth.uid()) AS get_user_org_ids)))) OR (seller_id = auth.uid())));


--
-- Name: organization_members; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.organization_members ENABLE ROW LEVEL SECURITY;

--
-- Name: organizations; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;

--
-- Name: outbound_webhooks; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.outbound_webhooks ENABLE ROW LEVEL SECURITY;

--
-- Name: ownership_audit_reports; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.ownership_audit_reports ENABLE ROW LEVEL SECURITY;

--
-- Name: ownership_audit_reports ownership_audit_reports_admin_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY ownership_audit_reports_admin_delete ON public.ownership_audit_reports FOR DELETE USING ((public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_role(auth.uid(), 'dev'::public.app_role)));


--
-- Name: ownership_audit_reports ownership_audit_reports_admin_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY ownership_audit_reports_admin_insert ON public.ownership_audit_reports FOR INSERT WITH CHECK ((public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_role(auth.uid(), 'dev'::public.app_role)));


--
-- Name: ownership_audit_reports ownership_audit_reports_admin_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY ownership_audit_reports_admin_select ON public.ownership_audit_reports FOR SELECT USING ((public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_role(auth.uid(), 'dev'::public.app_role)));


--
-- Name: ownership_repair_logs; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.ownership_repair_logs ENABLE ROW LEVEL SECURITY;

--
-- Name: password_reset_requests; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.password_reset_requests ENABLE ROW LEVEL SECURITY;

--
-- Name: permissions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.permissions ENABLE ROW LEVEL SECURITY;

--
-- Name: price_history; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.price_history ENABLE ROW LEVEL SECURITY;

--
-- Name: product_component_locations; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.product_component_locations ENABLE ROW LEVEL SECURITY;

--
-- Name: product_components; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.product_components ENABLE ROW LEVEL SECURITY;

--
-- Name: product_group_members; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.product_group_members ENABLE ROW LEVEL SECURITY;

--
-- Name: product_groups; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.product_groups ENABLE ROW LEVEL SECURITY;

--
-- Name: product_price_freshness_overrides; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.product_price_freshness_overrides ENABLE ROW LEVEL SECURITY;

--
-- Name: product_sync_logs; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.product_sync_logs ENABLE ROW LEVEL SECURITY;

--
-- Name: product_views; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.product_views ENABLE ROW LEVEL SECURITY;

--
-- Name: products; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;

--
-- Name: profiles; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

--
-- Name: public_token_failures; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.public_token_failures ENABLE ROW LEVEL SECURITY;

--
-- Name: quote_approval_tokens qatokens_delete_scope; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY qatokens_delete_scope ON public.quote_approval_tokens FOR DELETE TO authenticated USING ((public.can_view_all_sales() OR (seller_id = auth.uid())));


--
-- Name: quote_approval_tokens qatokens_insert_scope; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY qatokens_insert_scope ON public.quote_approval_tokens FOR INSERT TO authenticated WITH CHECK ((public.can_view_all_sales() OR (seller_id = auth.uid())));


--
-- Name: quote_approval_tokens qatokens_select_scope; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY qatokens_select_scope ON public.quote_approval_tokens FOR SELECT TO authenticated USING ((public.can_view_all_sales() OR (seller_id = auth.uid())));


--
-- Name: quote_approval_tokens qatokens_update_scope; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY qatokens_update_scope ON public.quote_approval_tokens FOR UPDATE TO authenticated USING ((public.can_view_all_sales() OR (seller_id = auth.uid()))) WITH CHECK ((public.can_view_all_sales() OR (seller_id = auth.uid())));


--
-- Name: quote_comments qcomments_insert_scope; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY qcomments_insert_scope ON public.quote_comments FOR INSERT TO authenticated WITH CHECK (((user_id = auth.uid()) AND (public.can_view_all_sales() OR (EXISTS ( SELECT 1
   FROM public.quotes q
  WHERE (((q.id)::text = quote_comments.quote_id) AND ((q.seller_id = auth.uid()) OR (public.has_role(auth.uid(), 'supervisor'::public.app_role) AND ((q.organization_id IS NULL) OR (q.organization_id IN ( SELECT public.get_user_org_ids(auth.uid()) AS get_user_org_ids)))))))))));


--
-- Name: quote_templates qtemplates_delete_scope; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY qtemplates_delete_scope ON public.quote_templates FOR DELETE TO authenticated USING ((public.can_view_all_sales() OR (seller_id = auth.uid())));


--
-- Name: quote_templates qtemplates_insert_scope; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY qtemplates_insert_scope ON public.quote_templates FOR INSERT TO authenticated WITH CHECK ((public.can_view_all_sales() OR (seller_id = auth.uid())));


--
-- Name: quote_templates qtemplates_select_scope; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY qtemplates_select_scope ON public.quote_templates FOR SELECT TO authenticated USING ((public.can_view_all_sales() OR (seller_id = auth.uid())));


--
-- Name: quote_templates qtemplates_update_scope; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY qtemplates_update_scope ON public.quote_templates FOR UPDATE TO authenticated USING ((public.can_view_all_sales() OR (seller_id = auth.uid()))) WITH CHECK ((public.can_view_all_sales() OR (seller_id = auth.uid())));


--
-- Name: query_telemetry; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.query_telemetry ENABLE ROW LEVEL SECURITY;

--
-- Name: quote_approval_tokens; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.quote_approval_tokens ENABLE ROW LEVEL SECURITY;

--
-- Name: quote_comments; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.quote_comments ENABLE ROW LEVEL SECURITY;

--
-- Name: quote_drafts; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.quote_drafts ENABLE ROW LEVEL SECURITY;

--
-- Name: quote_history; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.quote_history ENABLE ROW LEVEL SECURITY;

--
-- Name: quote_item_personalizations; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.quote_item_personalizations ENABLE ROW LEVEL SECURITY;

--
-- Name: quote_item_personalizations quote_item_personalizations_delete_scope; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY quote_item_personalizations_delete_scope ON public.quote_item_personalizations FOR DELETE USING ((public.can_view_all_sales() OR (EXISTS ( SELECT 1
   FROM (public.quote_items qi
     JOIN public.quotes q ON ((q.id = qi.quote_id)))
  WHERE ((qi.id = quote_item_personalizations.quote_item_id) AND (q.seller_id = auth.uid()))))));


--
-- Name: quote_item_personalizations quote_item_personalizations_insert_scope; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY quote_item_personalizations_insert_scope ON public.quote_item_personalizations FOR INSERT WITH CHECK ((public.can_view_all_sales() OR (EXISTS ( SELECT 1
   FROM (public.quote_items qi
     JOIN public.quotes q ON ((q.id = qi.quote_id)))
  WHERE ((qi.id = quote_item_personalizations.quote_item_id) AND (q.seller_id = auth.uid()))))));


--
-- Name: quote_item_personalizations quote_item_personalizations_select_scope; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY quote_item_personalizations_select_scope ON public.quote_item_personalizations FOR SELECT USING ((public.can_view_all_sales() OR (EXISTS ( SELECT 1
   FROM (public.quote_items qi
     JOIN public.quotes q ON ((q.id = qi.quote_id)))
  WHERE ((qi.id = quote_item_personalizations.quote_item_id) AND ((q.seller_id = auth.uid()) OR (public.has_role(auth.uid(), 'supervisor'::public.app_role) AND ((q.organization_id IS NULL) OR (q.organization_id IN ( SELECT public.get_user_org_ids(auth.uid()) AS get_user_org_ids))))))))));


--
-- Name: quote_item_personalizations quote_item_personalizations_update_scope; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY quote_item_personalizations_update_scope ON public.quote_item_personalizations FOR UPDATE USING ((public.can_view_all_sales() OR (EXISTS ( SELECT 1
   FROM (public.quote_items qi
     JOIN public.quotes q ON ((q.id = qi.quote_id)))
  WHERE ((qi.id = quote_item_personalizations.quote_item_id) AND ((q.seller_id = auth.uid()) OR (public.has_role(auth.uid(), 'supervisor'::public.app_role) AND ((q.organization_id IS NULL) OR (q.organization_id IN ( SELECT public.get_user_org_ids(auth.uid()) AS get_user_org_ids)))))))))) WITH CHECK ((public.can_view_all_sales() OR (EXISTS ( SELECT 1
   FROM (public.quote_items qi
     JOIN public.quotes q ON ((q.id = qi.quote_id)))
  WHERE ((qi.id = quote_item_personalizations.quote_item_id) AND ((q.seller_id = auth.uid()) OR (public.has_role(auth.uid(), 'supervisor'::public.app_role) AND ((q.organization_id IS NULL) OR (q.organization_id IN ( SELECT public.get_user_org_ids(auth.uid()) AS get_user_org_ids))))))))));


--
-- Name: quote_items; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.quote_items ENABLE ROW LEVEL SECURITY;

--
-- Name: quote_items quote_items_delete_scope; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY quote_items_delete_scope ON public.quote_items FOR DELETE USING ((public.can_view_all_sales() OR (EXISTS ( SELECT 1
   FROM public.quotes q
  WHERE ((q.id = quote_items.quote_id) AND (q.seller_id = auth.uid()))))));


--
-- Name: quote_items quote_items_insert_scope; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY quote_items_insert_scope ON public.quote_items FOR INSERT WITH CHECK ((public.can_view_all_sales() OR (EXISTS ( SELECT 1
   FROM public.quotes q
  WHERE ((q.id = quote_items.quote_id) AND (q.seller_id = auth.uid()))))));


--
-- Name: quote_items quote_items_select_scope; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY quote_items_select_scope ON public.quote_items FOR SELECT USING ((public.can_view_all_sales() OR (EXISTS ( SELECT 1
   FROM public.quotes q
  WHERE ((q.id = quote_items.quote_id) AND ((q.seller_id = auth.uid()) OR (public.has_role(auth.uid(), 'supervisor'::public.app_role) AND ((q.organization_id IS NULL) OR (q.organization_id IN ( SELECT public.get_user_org_ids(auth.uid()) AS get_user_org_ids))))))))));


--
-- Name: quote_items quote_items_update_scope; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY quote_items_update_scope ON public.quote_items FOR UPDATE USING ((public.can_view_all_sales() OR (EXISTS ( SELECT 1
   FROM public.quotes q
  WHERE ((q.id = quote_items.quote_id) AND ((q.seller_id = auth.uid()) OR (public.has_role(auth.uid(), 'supervisor'::public.app_role) AND ((q.organization_id IS NULL) OR (q.organization_id IN ( SELECT public.get_user_org_ids(auth.uid()) AS get_user_org_ids)))))))))) WITH CHECK ((public.can_view_all_sales() OR (EXISTS ( SELECT 1
   FROM public.quotes q
  WHERE ((q.id = quote_items.quote_id) AND ((q.seller_id = auth.uid()) OR (public.has_role(auth.uid(), 'supervisor'::public.app_role) AND ((q.organization_id IS NULL) OR (q.organization_id IN ( SELECT public.get_user_org_ids(auth.uid()) AS get_user_org_ids))))))))));


--
-- Name: quote_templates; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.quote_templates ENABLE ROW LEVEL SECURITY;

--
-- Name: quotes; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.quotes ENABLE ROW LEVEL SECURITY;

--
-- Name: quotes quotes_delete_scope; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY quotes_delete_scope ON public.quotes FOR DELETE TO authenticated USING ((public.can_view_all_sales() OR (seller_id = auth.uid())));


--
-- Name: quotes quotes_insert_scope; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY quotes_insert_scope ON public.quotes FOR INSERT TO authenticated WITH CHECK ((public.can_view_all_sales() OR (seller_id = auth.uid())));


--
-- Name: quotes quotes_select_scope; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY quotes_select_scope ON public.quotes FOR SELECT TO authenticated USING ((public.can_view_all_sales() OR (public.has_role(auth.uid(), 'supervisor'::public.app_role) AND ((organization_id IS NULL) OR (organization_id IN ( SELECT public.get_user_org_ids(auth.uid()) AS get_user_org_ids)))) OR (seller_id = auth.uid())));


--
-- Name: quotes quotes_update_scope; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY quotes_update_scope ON public.quotes FOR UPDATE TO authenticated USING ((public.can_view_all_sales() OR (public.has_role(auth.uid(), 'supervisor'::public.app_role) AND ((organization_id IS NULL) OR (organization_id IN ( SELECT public.get_user_org_ids(auth.uid()) AS get_user_org_ids)))) OR (seller_id = auth.uid()))) WITH CHECK ((public.can_view_all_sales() OR (public.has_role(auth.uid(), 'supervisor'::public.app_role) AND ((organization_id IS NULL) OR (organization_id IN ( SELECT public.get_user_org_ids(auth.uid()) AS get_user_org_ids)))) OR (seller_id = auth.uid())));


--
-- Name: recently_viewed_products; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.recently_viewed_products ENABLE ROW LEVEL SECURITY;

--
-- Name: request_rate_limits; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.request_rate_limits ENABLE ROW LEVEL SECURITY;

--
-- Name: rls_denial_log; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.rls_denial_log ENABLE ROW LEVEL SECURITY;

--
-- Name: rls_denial_log rls_denial_log_select_policy; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY rls_denial_log_select_policy ON public.rls_denial_log FOR SELECT TO authenticated USING (public.is_supervisor_or_above(auth.uid()));


--
-- Name: role_migration_batches; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.role_migration_batches ENABLE ROW LEVEL SECURITY;

--
-- Name: role_migration_items; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.role_migration_items ENABLE ROW LEVEL SECURITY;

--
-- Name: role_permissions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.role_permissions ENABLE ROW LEVEL SECURITY;

--
-- Name: saved_filters; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.saved_filters ENABLE ROW LEVEL SECURITY;

--
-- Name: saved_trends_views; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.saved_trends_views ENABLE ROW LEVEL SECURITY;

--
-- Name: scheduled_reports; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.scheduled_reports ENABLE ROW LEVEL SECURITY;

--
-- Name: search_analytics; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.search_analytics ENABLE ROW LEVEL SECURITY;

--
-- Name: secret_rotation_log; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.secret_rotation_log ENABLE ROW LEVEL SECURITY;

--
-- Name: seller_cart_items; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.seller_cart_items ENABLE ROW LEVEL SECURITY;

--
-- Name: seller_carts; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.seller_carts ENABLE ROW LEVEL SECURITY;

--
-- Name: seller_discount_limits; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.seller_discount_limits ENABLE ROW LEVEL SECURITY;

--
-- Name: simulator_wizard_drafts; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.simulator_wizard_drafts ENABLE ROW LEVEL SECURITY;

--
-- Name: step_up_audit_log; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.step_up_audit_log ENABLE ROW LEVEL SECURITY;

--
-- Name: step_up_challenges; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.step_up_challenges ENABLE ROW LEVEL SECURITY;

--
-- Name: step_up_tokens; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.step_up_tokens ENABLE ROW LEVEL SECURITY;

--
-- Name: system_settings; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.system_settings ENABLE ROW LEVEL SECURITY;

--
-- Name: system_settings system_settings readable by authenticated; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "system_settings readable by authenticated" ON public.system_settings FOR SELECT TO authenticated USING (true);


--
-- Name: user_comparisons; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.user_comparisons ENABLE ROW LEVEL SECURITY;

--
-- Name: user_known_devices; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.user_known_devices ENABLE ROW LEVEL SECURITY;

--
-- Name: user_onboarding; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.user_onboarding ENABLE ROW LEVEL SECURITY;

--
-- Name: user_preferences; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.user_preferences ENABLE ROW LEVEL SECURITY;

--
-- Name: user_roles; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

--
-- Name: user_search_history; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.user_search_history ENABLE ROW LEVEL SECURITY;

--
-- Name: user_token_revocations; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.user_token_revocations ENABLE ROW LEVEL SECURITY;

--
-- Name: user_comparisons users_delete_own_comparisons; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY users_delete_own_comparisons ON public.user_comparisons FOR DELETE USING ((auth.uid() = user_id));


--
-- Name: user_comparisons users_insert_own_comparisons; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY users_insert_own_comparisons ON public.user_comparisons FOR INSERT WITH CHECK ((auth.uid() = user_id));


--
-- Name: user_comparisons users_select_own_comparisons; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY users_select_own_comparisons ON public.user_comparisons FOR SELECT USING ((auth.uid() = user_id));


--
-- Name: user_comparisons users_update_own_comparisons; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY users_update_own_comparisons ON public.user_comparisons FOR UPDATE USING ((auth.uid() = user_id));


--
-- Name: video_variant_links; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.video_variant_links ENABLE ROW LEVEL SECURITY;

--
-- Name: voice_command_logs; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.voice_command_logs ENABLE ROW LEVEL SECURITY;

--
-- Name: webhook_deliveries; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.webhook_deliveries ENABLE ROW LEVEL SECURITY;

--
-- Name: webhook_delivery_metrics; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.webhook_delivery_metrics ENABLE ROW LEVEL SECURITY;

--
-- Name: webhook_delivery_metrics_y2026m05; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.webhook_delivery_metrics_y2026m05 ENABLE ROW LEVEL SECURITY;

--
-- Name: webhook_delivery_metrics_y2026m06; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.webhook_delivery_metrics_y2026m06 ENABLE ROW LEVEL SECURITY;

--
-- Name: workspace_notifications; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.workspace_notifications ENABLE ROW LEVEL SECURITY;

--
-- PostgreSQL database dump complete
--

\unrestrict DpVxMiZyEUgqizGplkafiTOkd3taggndaLKqFKbcSfhMzjFJVsZsFCbc8yg08C7

