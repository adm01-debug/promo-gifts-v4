-- ============================================================================
-- Reconcile orphan functions from production (drift fix for clean replay)
-- ============================================================================
-- These functions exist in production but were created out-of-band (never
-- captured by a migration). Later hardening batches (t37a/t37b1/t37b2,
-- 20260513000001+) run ALTER FUNCTION ... SECURITY INVOKER on them, which fails
-- on a fresh replay (Supabase Preview branch / `supabase start`) because the
-- functions do not exist yet. This migration recreates them verbatim from prod
-- so the replay matches production and the subsequent ALTERs succeed.
--
-- check_function_bodies is disabled so SQL-language functions with forward
-- references (other functions / tables created in later migrations) load
-- without create-time validation, exactly as pg_dump does.
-- ============================================================================

SET check_function_bodies = false;

CREATE OR REPLACE FUNCTION public._get_user_primary_role(_user_id uuid)
 RETURNS text
 LANGUAGE plpgsql
 STABLE
 SET search_path TO 'public'
AS $function$
DECLARE v_role text;
BEGIN
  SELECT ur.role::text INTO v_role
  FROM public.user_roles ur
  WHERE ur.user_id = _user_id
  ORDER BY CASE ur.role::text
    WHEN 'dev' THEN 1
    WHEN 'admin' THEN 2
    WHEN 'supervisor' THEN 3
    WHEN 'manager' THEN 4
    WHEN 'agente' THEN 5
    ELSE 99
  END
  LIMIT 1;
  RETURN COALESCE(v_role, 'agente');
END;
$function$
;

-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.apply_transform(p_value text, p_transform_type character varying, p_transform_config jsonb DEFAULT NULL::jsonb)
 RETURNS text
 LANGUAGE plpgsql
 IMMUTABLE
 SET search_path TO 'public'
AS $function$
DECLARE
    v_numeric_value NUMERIC;
    v_factor NUMERIC;
    v_result TEXT;
    v_pattern TEXT;
    v_group INTEGER;
    v_matches TEXT[];
BEGIN
    IF p_value IS NULL THEN
        RETURN NULL;
    END IF;
    
    CASE LOWER(p_transform_type)
        WHEN 'direct' THEN
            RETURN p_value;
        
        WHEN 'multiply' THEN
            BEGIN
                v_numeric_value := p_value::NUMERIC;
                v_factor := (p_transform_config->>'factor')::NUMERIC;
                RETURN (v_numeric_value * v_factor)::TEXT;
            EXCEPTION WHEN OTHERS THEN
                RAISE WARNING 'Erro em multiply transform: %', SQLERRM;
                RETURN p_value;
            END;
        
        WHEN 'divide' THEN
            BEGIN
                v_numeric_value := p_value::NUMERIC;
                v_factor := (p_transform_config->>'factor')::NUMERIC;
                IF v_factor = 0 THEN
                    RAISE WARNING 'Tentativa de divisão por zero';
                    RETURN p_value;
                END IF;
                RETURN (v_numeric_value / v_factor)::TEXT;
            EXCEPTION WHEN OTHERS THEN
                RAISE WARNING 'Erro em divide transform: %', SQLERRM;
                RETURN p_value;
            END;
        
        WHEN 'prefix' THEN
            RETURN (p_transform_config->>'prefix') || p_value;
        
        WHEN 'suffix' THEN
            RETURN p_value || (p_transform_config->>'suffix');
        
        WHEN 'uppercase' THEN
            RETURN UPPER(p_value);
        
        WHEN 'lowercase' THEN
            RETURN LOWER(p_value);
        
        WHEN 'trim' THEN
            RETURN TRIM(p_value);
        
        WHEN 'replace' THEN
            RETURN REPLACE(
                p_value,
                p_transform_config->>'find',
                p_transform_config->>'replace'
            );
        
        WHEN 'regex_extract' THEN
            BEGIN
                v_pattern := p_transform_config->>'pattern';
                v_group := COALESCE((p_transform_config->>'group')::INTEGER, 1);
                v_matches := regexp_matches(p_value, v_pattern);
                IF array_length(v_matches, 1) >= v_group THEN
                    RETURN v_matches[v_group];
                ELSE
                    RETURN NULL;
                END IF;
            EXCEPTION WHEN OTHERS THEN
                RAISE WARNING 'Erro em regex_extract: %', SQLERRM;
                RETURN p_value;
            END;
        
        ELSE
            RAISE WARNING 'Transform type não suportado: %', p_transform_type;
            RETURN p_value;
    END CASE;
    
EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'Erro em apply_transform: %', SQLERRM;
    RETURN p_value;
END;
$function$
;

-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.block_ip_temp(_ip text, _reason text, _duration_minutes integer DEFAULT 60)
 RETURNS uuid
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
DECLARE v_id uuid;
BEGIN
  IF NOT public.is_supervisor_or_above(auth.uid()) THEN RAISE EXCEPTION 'Permission denied'; END IF;
  INSERT INTO public.ip_access_control (ip_address, list_type, reason, expires_at, created_by)
  VALUES (_ip::inet, 'blocklist', _reason, now() + (_duration_minutes || ' minutes')::interval, auth.uid())
  RETURNING id INTO v_id;
  RETURN v_id;
END $function$
;

-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.check_auth_throttling(_email text, _ip text)
 RETURNS TABLE(allowed boolean, remaining_seconds integer)
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
DECLARE
    recent_failures INT;
    last_failure_at TIMESTAMP WITH TIME ZONE;
    lockout_duration INT;
    elapsed_since_last INT;
BEGIN
    SELECT COUNT(*), MAX(created_at)
    INTO recent_failures, last_failure_at
    FROM auth_login_attempts
    WHERE (email = _email OR ip_address = _ip)
      AND success = false
      AND created_at > now() - INTERVAL '15 minutes';

    IF recent_failures < 5 THEN
        RETURN QUERY SELECT true, 0;
        RETURN;
    END IF;

    IF recent_failures < 10 THEN lockout_duration := 300; 
    ELSIF recent_failures < 15 THEN lockout_duration := 900;
    ELSE lockout_duration := 3600;
    END IF;

    elapsed_since_last := EXTRACT(EPOCH FROM (now() - last_failure_at))::INT;

    IF elapsed_since_last >= lockout_duration THEN
        RETURN QUERY SELECT true, 0;
    ELSE
        RETURN QUERY SELECT false, (lockout_duration - elapsed_since_last);
    END IF;
END;
$function$
;

-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.clear_user_token_revocations(_user_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT public.is_supervisor_or_above(auth.uid()) THEN RAISE EXCEPTION 'Permission denied'; END IF;
  DELETE FROM public.user_token_revocations WHERE user_id = _user_id;
END $function$
;

-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.compute_quote_snapshot_hash(_quote_id uuid)
 RETURNS text
 LANGUAGE plpgsql
 STABLE
 SET search_path TO 'public'
AS $function$
DECLARE
  _hash_input text;
  _quote_data text;
  _items_data text;
  _personalizations_data text;
BEGIN
  SELECT 
    COALESCE(client_id::text, '') || '|' ||
    COALESCE(client_name, '') || '|' ||
    COALESCE(subtotal::text, '0') || '|' ||
    COALESCE(discount_percent::text, '0') || '|' ||
    COALESCE(discount_amount::text, '0') || '|' ||
    COALESCE(negotiation_markup_percent::text, '0') || '|' ||
    COALESCE(total::text, '0')
  INTO _quote_data
  FROM public.quotes
  WHERE id = _quote_id;
  
  SELECT COALESCE(string_agg(
    COALESCE(qi.id::text, '') || ':' ||
    COALESCE(qi.product_id::text, '') || ':' ||
    COALESCE(qi.quantity::text, '0') || ':' ||
    COALESCE(qi.unit_price::text, '0') || ':' ||
    COALESCE(qi.subtotal::text, '0'),
    '|' ORDER BY qi.id
  ), '') INTO _items_data
  FROM public.quote_items qi
  WHERE qi.quote_id = _quote_id;
  
  SELECT COALESCE(string_agg(
    COALESCE(qip.id::text, '') || ':' ||
    COALESCE(qip.technique_id::text, '') || ':' ||
    COALESCE(qip.colors_count::text, '0') || ':' ||
    COALESCE(qip.positions_count::text, '0') || ':' ||
    COALESCE(qip.total_cost::text, '0'),
    '|' ORDER BY qip.id
  ), '') INTO _personalizations_data
  FROM public.quote_item_personalizations qip
  JOIN public.quote_items qi ON qi.id = qip.quote_item_id
  WHERE qi.quote_id = _quote_id;
  
  _hash_input := COALESCE(_quote_data, '') || '||' || 
                 COALESCE(_items_data, '') || '||' || 
                 COALESCE(_personalizations_data, '');
  
  RETURN encode(extensions.digest(_hash_input, 'sha1'), 'hex');
END;
$function$
;

-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.convert_quote_to_order(p_quote_id uuid, p_seller_id uuid, p_organization_id uuid DEFAULT NULL::uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
DECLARE
    v_quote RECORD;
    v_order_id UUID;
    v_order_number TEXT;
    v_item RECORD;
    v_new_item_id UUID;
BEGIN
    SELECT * INTO v_quote FROM public.quotes WHERE id = p_quote_id;
    IF NOT FOUND THEN RAISE EXCEPTION 'Orçamento não encontrado'; END IF;
    IF v_quote.status != 'approved' THEN RAISE EXCEPTION 'Apenas orçamentos aprovados podem ser convertidos'; END IF;
    IF EXISTS (SELECT 1 FROM public.orders WHERE quote_id = p_quote_id) THEN
        RAISE EXCEPTION 'Este orçamento já foi convertido em pedido';
    END IF;

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

        INSERT INTO public.order_item_personalizations (
            order_item_id, technique_id, technique_name, location_id, 
            location_name, image_url, personalization_text, price_adjustment
        )
        SELECT v_new_item_id, technique_id, technique_name, location_id, 
            location_name, image_url, personalization_text, price_adjustment
        FROM public.quote_item_personalizations
        WHERE quote_item_id = v_item.id;
    END LOOP;

    UPDATE public.quotes SET status = 'converted' WHERE id = p_quote_id;

    RETURN jsonb_build_object('id', v_order_id, 'order_number', v_order_number, 'status', 'confirmed');
END;
$function$
;

-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.enable_step_up_for_user(_user_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT public.is_supervisor_or_above(auth.uid()) THEN RAISE EXCEPTION 'Permission denied'; END IF;
  PERFORM public.step_up_user_settings_set('{"enabled": true}'::jsonb, _user_id);
END $function$
;

-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.expert_chat_create_conversation(_title text DEFAULT 'Nova Conversa'::text, _client_id text DEFAULT NULL::text)
 RETURNS uuid
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
DECLARE v_id uuid;
BEGIN
  INSERT INTO public.expert_conversations (seller_id, title, client_id)
  VALUES (auth.uid(), _title, _client_id) RETURNING id INTO v_id;
  RETURN v_id;
END $function$
;

-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.expert_chat_log_event(_conv_id uuid, _event_type text, _role text, _content text DEFAULT NULL::text, _media_url text DEFAULT NULL::text, _tokens integer DEFAULT 0)
 RETURNS uuid
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
DECLARE v_id uuid;
BEGIN
  INSERT INTO public.conversation_event_history (
    conversation_id, role, event_type, content, media_url, tokens_estimated
  ) VALUES (
    _conv_id, _role, _event_type::public.conversation_event_type, _content, _media_url, _tokens
  ) RETURNING id INTO v_id;
  RETURN v_id;
END $function$
;

-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.expert_chat_send_message(_conv_id uuid, _role text, _content text)
 RETURNS uuid
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
DECLARE v_id uuid;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.expert_conversations WHERE id = _conv_id AND seller_id = auth.uid()) THEN
    RAISE EXCEPTION 'Conversation not found or access denied';
  END IF;
  INSERT INTO public.expert_messages (conversation_id, role, content)
  VALUES (_conv_id, _role, _content) RETURNING id INTO v_id;
  UPDATE public.expert_conversations SET updated_at = now() WHERE id = _conv_id;
  RETURN v_id;
END $function$
;

-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.expert_chat_update_status(_session_id text, _status text)
 RETURNS void
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
BEGIN
  UPDATE public.conversation_audit_logs SET status = _status,
    ended_at = CASE WHEN _status IN ('completed','failed') THEN now() ELSE ended_at END
  WHERE session_id = _session_id AND user_id = auth.uid();
END $function$
;

-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.extract_json_value(p_data jsonb, p_path character varying)
 RETURNS text
 LANGUAGE plpgsql
 IMMUTABLE
 SET search_path TO 'public'
AS $function$
DECLARE
    v_result JSONB;
    v_text TEXT;
BEGIN
    IF p_data IS NULL OR p_path IS NULL THEN
        RETURN NULL;
    END IF;
    
    BEGIN
        v_result := jsonb_path_query_first(p_data, p_path::jsonpath);
    EXCEPTION WHEN OTHERS THEN
        RAISE WARNING 'JSONPath inválido: % | Erro: %', p_path, SQLERRM;
        RETURN NULL;
    END;
    
    IF v_result IS NULL THEN
        RETURN NULL;
    END IF;
    
    CASE jsonb_typeof(v_result)
        WHEN 'string' THEN
            v_text := v_result #>> '{}';
        WHEN 'number' THEN
            v_text := v_result::TEXT;
        WHEN 'boolean' THEN
            v_text := v_result::TEXT;
        WHEN 'null' THEN
            v_text := NULL;
        ELSE
            v_text := v_result::TEXT;
    END CASE;
    
    RETURN v_text;
    
EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'Erro em extract_json_value: %', SQLERRM;
    RETURN NULL;
END;
$function$
;

-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.fn_audit_role_changes()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$ BEGIN RETURN COALESCE(NEW, OLD); END; $function$
;

-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.fn_calculate_health_score()
 RETURNS TABLE(score numeric, grade text, pontos_positivos jsonb, pontos_atencao jsonb, calculated_at timestamp with time zone)
 LANGUAGE plpgsql
 STABLE
 SET search_path TO 'public'
AS $function$
DECLARE
  v_score numeric := 100;
  v_positivos jsonb := '[]'::jsonb;
  v_atencao jsonb := '[]'::jsonb;
  
  v_cron_failed integer;
  v_critical_alerts integer;
  v_warning_alerts integer;
  v_products_no_ncm integer;
  v_products_no_image_not_queued integer;
  v_tests_passed integer;
  v_tests_total integer;
  v_active_products integer;
  v_docs integer;
  v_orphans integer;
BEGIN
  -- Fatores de integridade
  SELECT COUNT(*) INTO v_cron_failed FROM cron.job_run_details 
    WHERE status='failed' AND start_time > now() - interval '1 hour';
  
  SELECT 
    COUNT(*) FILTER (WHERE severidade='critical'),
    COUNT(*) FILTER (WHERE severidade='warning')
  INTO v_critical_alerts, v_warning_alerts FROM v_system_alerts;
  
  SELECT COUNT(*) INTO v_products_no_ncm FROM products 
    WHERE is_active=true AND ncm_id IS NULL;
  
  -- Produtos sem imagem QUE NÃO ESTÃO enfileirados são problema real
  SELECT COUNT(*) INTO v_products_no_image_not_queued
  FROM products p
  WHERE p.is_active = true AND p.primary_image_url IS NULL
    AND NOT EXISTS(
      SELECT 1 FROM media_sync_queue q 
      WHERE q.product_id = p.id AND q.status IN ('pending','processing')
    );
  
  SELECT COUNT(*) INTO v_active_products FROM products WHERE is_active=true;
  SELECT COUNT(*) INTO v_docs FROM system_documentation;
  
  -- Smoke tests
  BEGIN
    SELECT 
      COUNT(*) FILTER (WHERE result LIKE '✅%'),
      COUNT(*)
    INTO v_tests_passed, v_tests_total
    FROM fn_run_smoke_tests();
  EXCEPTION WHEN OTHERS THEN
    v_tests_passed := 0;
    v_tests_total := 0;
  END;
  
  -- Orphans
  SELECT COUNT(*) INTO v_orphans FROM product_variants pv
    WHERE NOT EXISTS (SELECT 1 FROM products p WHERE p.id = pv.product_id);
  
  -- DEDUÇÕES
  IF v_cron_failed > 0 THEN
    v_score := v_score - LEAST(20, v_cron_failed * 5);
    v_atencao := v_atencao || jsonb_build_object('cron_failures_1h', v_cron_failed);
  END IF;
  
  IF v_critical_alerts > 0 THEN
    v_score := v_score - (v_critical_alerts * 15);
    v_atencao := v_atencao || jsonb_build_object('critical_alerts', v_critical_alerts);
  END IF;
  
  IF v_warning_alerts > 0 THEN
    v_score := v_score - (v_warning_alerts * 2);
    v_atencao := v_atencao || jsonb_build_object('warning_alerts', v_warning_alerts);
  END IF;
  
  IF v_products_no_ncm > 0 THEN
    v_score := v_score - LEAST(10, v_products_no_ncm * 0.5);
    v_atencao := v_atencao || jsonb_build_object('products_no_ncm', v_products_no_ncm);
  END IF;
  
  IF v_products_no_image_not_queued > 0 THEN
    v_score := v_score - LEAST(5, v_products_no_image_not_queued * 0.2);
    v_atencao := v_atencao || jsonb_build_object('products_no_image_not_queued', v_products_no_image_not_queued);
  END IF;
  
  IF v_orphans > 0 THEN
    v_score := v_score - LEAST(10, v_orphans * 1);
    v_atencao := v_atencao || jsonb_build_object('orphan_variants', v_orphans);
  END IF;
  
  -- Testes que falham deduzem
  IF v_tests_total > 0 AND v_tests_passed < v_tests_total THEN
    v_score := v_score - ((v_tests_total - v_tests_passed) * 2);
    v_atencao := v_atencao || jsonb_build_object(
      'smoke_tests_failed', v_tests_total - v_tests_passed
    );
  END IF;
  
  -- PONTOS POSITIVOS
  IF v_cron_failed = 0 THEN
    v_positivos := v_positivos || jsonb_build_object(
      'feature', 'cron_health', 'detail', 'Zero falhas de cron na última hora');
  END IF;
  
  IF v_products_no_ncm = 0 THEN
    v_positivos := v_positivos || jsonb_build_object(
      'feature', 'fiscal_integrity', 'detail', '100% produtos ativos com NCM');
  END IF;
  
  IF v_orphans = 0 THEN
    v_positivos := v_positivos || jsonb_build_object(
      'feature', 'referential_integrity', 'detail', 'Zero órfãos em relações críticas');
  END IF;
  
  IF v_tests_total > 0 AND v_tests_passed = v_tests_total THEN
    v_positivos := v_positivos || jsonb_build_object(
      'feature', 'smoke_tests', 'detail', v_tests_passed || '/' || v_tests_total || ' testes passando');
  END IF;
  
  v_positivos := v_positivos || jsonb_build_object(
    'feature', 'catalog_scale', 'detail', v_active_products || ' produtos ativos');
  
  v_positivos := v_positivos || jsonb_build_object(
    'feature', 'rls_coverage', 'detail', 
    (SELECT COUNT(*) FROM pg_policies WHERE schemaname='public')::text || ' políticas RLS');
  
  v_positivos := v_positivos || jsonb_build_object(
    'feature', 'indexing', 'detail',
    (SELECT COUNT(*) FROM pg_indexes WHERE schemaname='public')::text || ' índices');
  
  v_positivos := v_positivos || jsonb_build_object(
    'feature', 'realtime', 'detail',
    (SELECT COUNT(*) FROM pg_publication_tables WHERE pubname='supabase_realtime')::text || ' tabelas em realtime');
  
  v_positivos := v_positivos || jsonb_build_object(
    'feature', 'documentation', 'detail', v_docs || ' entradas de auto-documentação');
  
  v_positivos := v_positivos || jsonb_build_object(
    'feature', 'check_constraints', 'detail',
    (SELECT COUNT(*) FROM pg_constraint WHERE contype='c' AND connamespace='public'::regnamespace)::text || ' CHECK constraints');
  
  v_positivos := v_positivos || jsonb_build_object(
    'feature', 'backlog_management', 'detail',
    'Fila IA (' || (SELECT COUNT(*) FROM ai_description_queue WHERE status='pending')::text || 
    ') + Fila Mídia (' || (SELECT COUNT(*) FROM media_sync_queue WHERE status='pending')::text || 
    ') organizadas');
  
  -- BÔNUS por excelência
  IF v_critical_alerts = 0 AND v_warning_alerts = 0 AND v_tests_passed = v_tests_total THEN
    v_score := v_score + 0; -- já 100
    v_positivos := v_positivos || jsonb_build_object(
      'feature', '🏆 EXCELLENCE_BONUS', 'detail', 'Zero issues + 100% testes = sistema impecável');
  END IF;
  
  v_score := GREATEST(0, LEAST(100, v_score));
  
  RETURN QUERY SELECT 
    ROUND(v_score, 1),
    CASE 
      WHEN v_score >= 98 THEN '🏆 A++ PERFEITO'
      WHEN v_score >= 95 THEN 'A+ EXCELENTE'
      WHEN v_score >= 90 THEN 'A ÓTIMO'
      WHEN v_score >= 80 THEN 'B BOM'
      WHEN v_score >= 70 THEN 'C REGULAR'
      WHEN v_score >= 60 THEN 'D ATENÇÃO'
      ELSE 'F CRÍTICO'
    END,
    v_positivos,
    v_atencao,
    now();
END;
$function$
;

-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.fn_capacity_forecast(p_days_ahead integer DEFAULT 90)
 RETURNS TABLE(metric text, current_value bigint, growth_per_day numeric, projected_value bigint, projection_date date, status text)
 LANGUAGE plpgsql
 STABLE
 SET search_path TO 'public'
AS $function$
DECLARE
  v_products_growth numeric;
  v_variants_growth numeric;
  v_images_growth numeric;
  v_snapshots_growth numeric;
  v_db_size bigint;
BEGIN
  SELECT COALESCE(COUNT(*) FILTER (WHERE created_at > now() - interval '30 days')::numeric / 30, 0)
    INTO v_products_growth FROM products;
  SELECT COALESCE(COUNT(*) FILTER (WHERE created_at > now() - interval '30 days')::numeric / 30, 0)
    INTO v_variants_growth FROM product_variants;
  SELECT COALESCE(COUNT(*) FILTER (WHERE created_at > now() - interval '30 days')::numeric / 30, 0)
    INTO v_images_growth FROM product_images;
  SELECT COALESCE(COUNT(*) FILTER (WHERE captured_at > now() - interval '7 days')::numeric / 7, 0)
    INTO v_snapshots_growth FROM stock_snapshots;
  SELECT pg_database_size(current_database()) INTO v_db_size;

  RETURN QUERY SELECT 'products'::text, (SELECT COUNT(*) FROM products)::bigint, v_products_growth,
    ((SELECT COUNT(*) FROM products) + (v_products_growth * p_days_ahead))::bigint,
    (CURRENT_DATE + (p_days_ahead || ' days')::interval)::date,
    CASE WHEN (SELECT COUNT(*) FROM products) + (v_products_growth * p_days_ahead) > 100000 
      THEN '⚠️ Considere particionamento' ELSE '✅ OK' END;

  RETURN QUERY SELECT 'product_variants'::text, (SELECT COUNT(*) FROM product_variants)::bigint, v_variants_growth,
    ((SELECT COUNT(*) FROM product_variants) + (v_variants_growth * p_days_ahead))::bigint,
    (CURRENT_DATE + (p_days_ahead || ' days')::interval)::date,
    CASE WHEN (SELECT COUNT(*) FROM product_variants) + (v_variants_growth * p_days_ahead) > 500000 
      THEN '⚠️ Considere particionamento' ELSE '✅ OK' END;

  RETURN QUERY SELECT 'product_images'::text, (SELECT COUNT(*) FROM product_images)::bigint, v_images_growth,
    ((SELECT COUNT(*) FROM product_images) + (v_images_growth * p_days_ahead))::bigint,
    (CURRENT_DATE + (p_days_ahead || ' days')::interval)::date,
    CASE WHEN (SELECT COUNT(*) FROM product_images) + (v_images_growth * p_days_ahead) > 1000000 
      THEN '⚠️ Considere particionamento' ELSE '✅ OK' END;

  RETURN QUERY SELECT 'stock_snapshots'::text, (SELECT COUNT(*) FROM stock_snapshots)::bigint, v_snapshots_growth,
    ((SELECT COUNT(*) FROM stock_snapshots) + (v_snapshots_growth * p_days_ahead))::bigint,
    (CURRENT_DATE + (p_days_ahead || ' days')::interval)::date,
    CASE WHEN v_snapshots_growth > 1000 
      THEN '💡 Purge 14d já ativo via cron' ELSE '✅ OK' END;

  RETURN QUERY SELECT 'database_size_mb'::text, (v_db_size / 1024 / 1024)::bigint, 0.0::numeric, 0::bigint,
    CURRENT_DATE, '💾 ' || pg_size_pretty(v_db_size);
END;
$function$
;

-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.fn_check_geo_access(p_country_code text)
 RETURNS boolean
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
DECLARE
    v_enabled BOOLEAN;
    v_is_allowed BOOLEAN;
BEGIN
    SELECT (setting_value->>'enabled')::BOOLEAN INTO v_enabled FROM public.security_settings WHERE setting_key = 'geo_blocking';
    IF v_enabled IS NOT TRUE THEN RETURN true; END IF;
    
    SELECT EXISTS(SELECT 1 FROM public.geo_allowed_countries WHERE country_code = UPPER(p_country_code) AND is_active = true) INTO v_is_allowed;
    RETURN v_is_allowed;
EXCEPTION WHEN OTHERS THEN
    RETURN true;
END;
$function$
;

-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.fn_create_quote_v3(p_quote_data jsonb, p_items_data jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
DECLARE
    v_quote_id UUID;
    v_item RECORD;
    v_pers RECORD;
    v_new_item_id UUID;
    v_seller_id UUID := auth.uid();
    v_quote_number TEXT;
BEGIN
    IF v_seller_id IS NULL THEN RAISE EXCEPTION 'Unauthorized'; END IF;

    INSERT INTO public.quotes (
        seller_id, client_id, client_name, client_email, client_phone, client_company, client_cnpj,
        status, subtotal, discount_percent, discount_amount, total,
        notes, internal_notes, valid_until, payment_terms, delivery_time,
        shipping_type, shipping_cost, negotiation_markup_percent, organization_id
    ) VALUES (
        v_seller_id,
        (p_quote_data->>'client_id')::uuid,
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

    FOR v_item IN SELECT * FROM jsonb_array_elements(p_items_data) LOOP
        INSERT INTO public.quote_items (
            quote_id, product_id, product_name, product_sku, product_image_url,
            quantity, unit_price, subtotal, color_name, color_hex,
            size_code, gender, bitrix_product_id, sort_order, notes
        ) VALUES (
            v_quote_id,
            (v_item.value->>'product_id')::uuid,
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

        IF v_item.value ? 'personalizations' THEN
            FOR v_pers IN SELECT * FROM jsonb_array_elements(v_item.value->'personalizations') LOOP
                INSERT INTO public.quote_item_personalizations (
                    quote_item_id, technique_id, technique_name,
                    colors_count, positions_count, area_cm2, width_cm, height_cm,
                    setup_cost, unit_cost, total_cost, notes
                ) VALUES (
                    v_new_item_id,
                    (v_pers.value->>'technique_id')::uuid,
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

    INSERT INTO public.quote_history (quote_id, user_id, action, description)
    VALUES (v_quote_id, v_seller_id, 'created_v3', 'Orçamento criado via RPC atômico');

    RETURN jsonb_build_object('id', v_quote_id, 'quote_number', v_quote_number);
END;
$function$
;

-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.fn_dar_set_snapshot_hash()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
BEGIN
  IF TG_OP = 'INSERT' THEN
    NEW.quote_snapshot_hash := public.compute_quote_snapshot_hash(NEW.quote_id);
  END IF;
  RETURN NEW;
END;
$function$
;

-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.fn_force_user_logout()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$ BEGIN RETURN NEW; END; $function$
;

-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.fn_get_customization_price(p_area_id uuid, p_quantidade integer, p_num_cores integer DEFAULT 1, p_largura_cm numeric DEFAULT NULL::numeric, p_altura_cm numeric DEFAULT NULL::numeric, p_num_pontos integer DEFAULT 0)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
DECLARE
  v_tabela_id UUID;
  v_codigo_tabela TEXT;
  v_nome_tabela TEXT;
  v_grupo_tecnica TEXT;
  v_cobra_por_cor BOOLEAN;
  v_max_cores INT;
  v_custo_setup NUMERIC;
  v_custo_setup_por_cor BOOLEAN;
  v_custo_aplicacao NUMERIC;
  v_desconto_2cor NUMERIC;
  v_desconto_3cor NUMERIC;
  v_is_curved BOOLEAN;
  v_usa_faixa_dimensional BOOLEAN;
  v_max_width NUMERIC;
  v_max_height NUMERIC;
  v_preco_base NUMERIC;
  v_preco_venda NUMERIC;
  v_setup_total NUMERIC;
  v_setup_total_markup NUMERIC;
  v_valor_gravacao NUMERIC;
  v_valor_gravacao_markup NUMERIC;
  v_total_cobrado NUMERIC;
  v_total_cobrado_markup NUMERIC;
  v_pico_anterior NUMERIC;
  v_pico_anterior_markup NUMERIC;
  v_faixa_id UUID;
  v_faixa_info JSONB;
  v_markup_pct NUMERIC;
  v_preco_min_unit NUMERIC;
  v_opcoes JSONB;
  v_mult_cor NUMERIC;
  v_foto_a3 NUMERIC;
  v_regra_ativada TEXT;
BEGIN
  -- VALIDAÇÃO 1: Quantidade > 0
  IF p_quantidade IS NULL OR p_quantidade <= 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Quantidade deve ser maior que zero', 'quantidade', p_quantidade);
  END IF;

  -- VALIDAÇÃO 2: Dimensões > 0 (quando informadas)
  IF (p_largura_cm IS NOT NULL AND p_largura_cm <= 0) OR (p_altura_cm IS NOT NULL AND p_altura_cm <= 0) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Dimensões devem ser maiores que zero', 'largura', p_largura_cm, 'altura', p_altura_cm);
  END IF;

  -- PASSO 1: Resolver área
  SELECT pat.tabela_preco_id, pat.is_curved, pat.max_width, pat.max_height
    INTO v_tabela_id, v_is_curved, v_max_width, v_max_height
  FROM print_area_techniques pat
  WHERE pat.id = p_area_id AND pat.is_active = true;

  IF v_tabela_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Technique não encontrada', 'technique_id', p_area_id);
  END IF;

  -- PASSO 2: Carregar config
  SELECT
    t.codigo_tabela, t.nome, t.grupo_tecnica,
    t.cobra_por_cor, COALESCE(t.max_cores, 1),
    COALESCE(t.custo_setup, 0), COALESCE(t.custo_setup_por_cor, false),
    COALESCE(t.custo_aplicacao, 0),
    COALESCE(t.desconto_segunda_cor, 10), COALESCE(t.desconto_terceira_cor, 15),
    COALESCE(t.usa_faixa_dimensional, false),
    COALESCE(t.markup_percent, 0),
    COALESCE(t.preco_minimo_unitario, 0),
    t.opcoes_modificadores
    INTO
    v_codigo_tabela, v_nome_tabela, v_grupo_tecnica,
    v_cobra_por_cor, v_max_cores,
    v_custo_setup, v_custo_setup_por_cor,
    v_custo_aplicacao,
    v_desconto_2cor, v_desconto_3cor,
    v_usa_faixa_dimensional,
    v_markup_pct, v_preco_min_unit,
    v_opcoes
  FROM tabela_preco_gravacao_oficial t
  WHERE t.id = v_tabela_id AND t.ativo = true;

  IF v_codigo_tabela IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Tabela de preço inativa ou não encontrada', 'tabela_id', v_tabela_id);
  END IF;

  -- VALIDAÇÃO 3: max_cores
  IF p_num_cores > v_max_cores THEN
    RETURN jsonb_build_object('success', false, 'error', format('Máximo de %s cor(es) para técnica %s', v_max_cores, v_codigo_tabela),
      'max_cores', v_max_cores, 'solicitado', p_num_cores, 'tabela', v_codigo_tabela);
  END IF;

  -- VALIDAÇÃO 4: Dimensão obrigatória
  IF v_usa_faixa_dimensional AND (p_largura_cm IS NULL OR p_altura_cm IS NULL) THEN
    RETURN jsonb_build_object('success', false, 'error', format('Dimensões obrigatórias para técnica %s (usa faixa dimensional)', v_codigo_tabela),
      'tabela', v_codigo_tabela, 'usa_faixa_dimensional', true);
  END IF;

  -- VALIDAÇÃO 5: Dimensão vs limite
  IF p_largura_cm IS NOT NULL AND v_max_width IS NOT NULL AND p_largura_cm > v_max_width THEN
    RETURN jsonb_build_object('success', false, 'error', format('Largura %s cm excede limite máximo de %s cm', ROUND(p_largura_cm,1), ROUND(v_max_width,1)),
      'largura_solicitada', p_largura_cm, 'largura_maxima', v_max_width, 'tabela', v_codigo_tabela);
  END IF;
  IF p_altura_cm IS NOT NULL AND v_max_height IS NOT NULL AND p_altura_cm > v_max_height THEN
    RETURN jsonb_build_object('success', false, 'error', format('Altura %s cm excede limite máximo de %s cm', ROUND(p_altura_cm,1), ROUND(v_max_height,1)),
      'altura_solicitada', p_altura_cm, 'altura_maxima', v_max_height, 'tabela', v_codigo_tabela);
  END IF;

  -- BUG 2 FIX: extrair foto_a3 e mult_cor do JSONB
  v_foto_a3 := COALESCE((v_opcoes->>'adicional_fotolito_por_cor')::numeric, 0);
  v_mult_cor := COALESCE((v_opcoes->'multiplicador_cor'->>p_num_cores::text)::numeric, 1.0);

  -- PASSO 3: Encontrar faixa de preço
  -- BUG 3 FIX: substituir BETWEEN por comparação que aceita quantidade_maxima IS NULL
  IF p_largura_cm IS NOT NULL AND p_altura_cm IS NOT NULL AND v_usa_faixa_dimensional THEN
    SELECT f.id, jsonb_build_object(
      'faixa_id', f.id, 'qtd_min', f.quantidade_minima, 'qtd_max', f.quantidade_maxima,
      'larg_min', f.largura_min, 'larg_max', f.largura_max,
      'alt_min', f.altura_min, 'alt_max', f.altura_max, 'preco', f.preco_unitario
    )
    INTO v_faixa_id, v_faixa_info
    FROM tabela_preco_gravacao_oficial_faixa f
    WHERE f.tabela_preco_gravacao_id = v_tabela_id
      AND p_quantidade >= f.quantidade_minima
      AND (f.quantidade_maxima IS NULL OR p_quantidade <= f.quantidade_maxima)
      AND f.largura_min IS NOT NULL
      AND p_largura_cm BETWEEN f.largura_min AND f.largura_max
      AND p_altura_cm BETWEEN f.altura_min AND f.altura_max
    ORDER BY f.preco_unitario ASC LIMIT 1;
  END IF;

  IF v_faixa_id IS NULL THEN
    SELECT f.id, jsonb_build_object(
      'faixa_id', f.id, 'qtd_min', f.quantidade_minima, 'qtd_max', f.quantidade_maxima, 'preco', f.preco_unitario
    )
    INTO v_faixa_id, v_faixa_info
    FROM tabela_preco_gravacao_oficial_faixa f
    WHERE f.tabela_preco_gravacao_id = v_tabela_id
      AND p_quantidade >= f.quantidade_minima
      AND (f.quantidade_maxima IS NULL OR p_quantidade <= f.quantidade_maxima)
      AND f.largura_min IS NULL
    ORDER BY f.preco_unitario ASC LIMIT 1;
  END IF;

  IF v_faixa_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Nenhuma faixa de preço encontrada',
      'tabela', v_codigo_tabela, 'quantidade', p_quantidade, 'largura', p_largura_cm, 'altura', p_altura_cm);
  END IF;

  v_preco_base := (v_faixa_info->>'preco')::NUMERIC;

  -- PASSO 4: GRAVAÇÃO NATURAL por grupo_tecnica (alinhado com v11)
  v_valor_gravacao := CASE 
    WHEN v_grupo_tecnica = 'SERIGRAFIA' THEN p_quantidade * v_preco_base * v_mult_cor + v_foto_a3 * p_num_cores
    WHEN v_grupo_tecnica = 'TAMPOGRAFIA' THEN p_quantidade * v_preco_base * v_mult_cor
    WHEN v_grupo_tecnica = 'TRANSFER_DIGITAL' THEN 
      p_quantidade * (COALESCE(p_largura_cm, 0) * COALESCE(p_altura_cm, 0) / 10000.0 * v_preco_base + v_custo_aplicacao)
    WHEN v_grupo_tecnica = 'SUBLIMACAO' THEN p_quantidade * (v_preco_base + v_custo_aplicacao)
    WHEN v_grupo_tecnica IN ('LASER','LASER_CO2','UV_DIGITAL') THEN p_quantidade * v_preco_base
    WHEN v_grupo_tecnica = 'BORDADO' THEN p_quantidade * v_preco_base
    ELSE p_quantidade * v_preco_base
  END;

  -- BUG 1 FIX: pico_anterior (regra anti-paradoxo) — alinhado com v11
  SELECT COALESCE(MAX(
    CASE 
      WHEN v_grupo_tecnica = 'SERIGRAFIA' THEN fa.quantidade_maxima * fa.preco_unitario * v_mult_cor + v_foto_a3 * p_num_cores
      WHEN v_grupo_tecnica = 'TAMPOGRAFIA' THEN fa.quantidade_maxima * fa.preco_unitario * v_mult_cor
      WHEN v_grupo_tecnica = 'SUBLIMACAO' THEN fa.quantidade_maxima * (fa.preco_unitario + v_custo_aplicacao)
      WHEN v_grupo_tecnica IN ('LASER','LASER_CO2','UV_DIGITAL') THEN fa.quantidade_maxima * fa.preco_unitario
      WHEN v_grupo_tecnica = 'BORDADO' THEN fa.quantidade_maxima * fa.preco_unitario
      ELSE 0
    END
  ), 0)
  INTO v_pico_anterior
  FROM tabela_preco_gravacao_oficial_faixa fa
  WHERE fa.tabela_preco_gravacao_id = v_tabela_id
    AND fa.quantidade_maxima IS NOT NULL
    AND fa.quantidade_maxima < p_quantidade;

  -- PASSO 5: Setup (piso comercial, com setup_por_cor)
  v_setup_total := CASE WHEN v_custo_setup_por_cor THEN v_custo_setup * p_num_cores ELSE v_custo_setup END;

  -- PASSO 6: Total = MAX(gravação, pico_anterior, setup)
  v_total_cobrado := GREATEST(v_valor_gravacao, v_pico_anterior, v_setup_total);

  -- Determinar regra ativada
  v_regra_ativada := CASE 
    WHEN GREATEST(v_valor_gravacao, v_pico_anterior) < v_setup_total THEN 'PISO_SETUP'
    WHEN v_pico_anterior > v_valor_gravacao THEN 'ANTI_PARADOXO'
    ELSE 'natural'
  END;

  -- Aplicar markup em todos os componentes (compatibilidade com formato antigo)
  v_valor_gravacao_markup := v_valor_gravacao * (1 + v_markup_pct / 100.0);
  v_setup_total_markup := v_setup_total * (1 + v_markup_pct / 100.0);
  v_pico_anterior_markup := v_pico_anterior * (1 + v_markup_pct / 100.0);
  v_total_cobrado_markup := v_total_cobrado * (1 + v_markup_pct / 100.0);

  -- Preço unitário com markup (mantém compat: representa preço por peça da faixa)
  v_preco_venda := v_preco_base * (1 + v_markup_pct / 100.0);
  v_preco_venda := GREATEST(v_preco_venda, v_preco_min_unit);

  RETURN jsonb_build_object(
    'success', true,
    'tabela', v_codigo_tabela,
    'nome_tabela', v_nome_tabela,
    'grupo_tecnica', v_grupo_tecnica,
    'faixa', v_faixa_info,
    'preco_unitario', ROUND(v_preco_venda, 4),
    'quantidade', p_quantidade,
    'num_cores', p_num_cores,
    'valor_gravacao', ROUND(v_valor_gravacao_markup, 2),
    'setup_total', ROUND(v_setup_total_markup, 2),
    'total_cobrado', ROUND(v_total_cobrado_markup, 2),
    'preco_por_unidade', ROUND(v_total_cobrado_markup / p_quantidade, 4),
    'regra_ativada', v_regra_ativada,
    'pico_anterior', ROUND(v_pico_anterior_markup, 2),
    'detalhes', jsonb_build_object(
      'cobra_por_cor', v_cobra_por_cor,
      'max_cores', v_max_cores,
      'desconto_2cor', v_desconto_2cor,
      'desconto_3cor', v_desconto_3cor,
      'is_curved', v_is_curved,
      'foto_a3', v_foto_a3,
      'mult_cor', v_mult_cor,
      'custo_aplicacao', v_custo_aplicacao
    ),
    'markup', jsonb_build_object(
      'markup_pct', v_markup_pct,
      'preco_min_unit', v_preco_min_unit,
      'custo_unitario', ROUND(v_preco_base, 4),
      'custo_setup_tabela', v_custo_setup
    ),
    'bugfix_version', '2026-04-25-BUGFIX-01'
  );
END;
$function$
;

-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.fn_get_product_customization_options(p_product_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
DECLARE
    v_result JSONB;
BEGIN
    SELECT jsonb_build_object(
        'product_id', p_product_id,
        'locations', COALESCE(jsonb_agg(loc_data ORDER BY loc_order), '[]'::jsonb)
    )
    INTO v_result
    FROM (
        SELECT
            pat.location_code,
            pat.location_name,
            pat.location_order AS loc_order,
            jsonb_build_object(
                'location_code', pat.location_code,
                'location_name', pat.location_name,
                'location_order', pat.location_order,
                'options', (
                    SELECT COALESCE(jsonb_agg(
                        jsonb_build_object(
                            'technique_id', p2.id,
                            'grupo_tecnica', t.grupo_tecnica,
                            'tecnica_nome', t.nome,
                            'variacao_label', t.nome,
                            'codigo_tabela', t.codigo_tabela,
                            'cobra_por_cor', t.cobra_por_cor,
                            'max_cores', COALESCE(t.max_cores, 1),
                            'custo_setup', COALESCE(t.custo_setup, 0),
                            'max_width', p2.max_width,
                            'max_height', p2.max_height,
                            -- Mantém chaves JSON para compatibilidade frontend
                            'gravacao_largura_max', p2.max_width,
                            'gravacao_altura_max', p2.max_height,
                            'is_curved', p2.is_curved,
                            'shape', p2.shape,
                            'usa_dimensao', COALESCE(t.usa_faixa_dimensional, false),
                            'efetiva_largura_max', p2.max_width,
                            'efetiva_altura_max', p2.max_height
                        )
                    ORDER BY t.grupo_tecnica, t.codigo_tabela), '[]'::jsonb)
                    FROM print_area_techniques p2
                    JOIN tabela_preco_gravacao_oficial t ON t.id = p2.tabela_preco_id
                    WHERE p2.product_id = p_product_id
                      AND p2.location_code = pat.location_code
                      AND p2.is_active = true
                      AND t.ativo = true
                )
            ) AS loc_data
        FROM (
            SELECT DISTINCT location_code, location_name, location_order
            FROM print_area_techniques
            WHERE product_id = p_product_id
              AND is_active = true
        ) pat
        ORDER BY pat.location_order
    ) sub;

    RETURN v_result;
END;
$function$
;

-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.fn_log_login_attempt()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$ BEGIN RETURN NEW; END; $function$
;

-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.fn_log_step_up_event()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$ BEGIN RETURN NEW; END; $function$
;

-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.fn_product_market_intelligence(p_product_id uuid, p_days integer DEFAULT 30)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE
 SET search_path TO 'pg_catalog', 'public', 'analytics'
AS $function$
DECLARE
  v_result jsonb;
  v_kpis jsonb;
  v_chart jsonb;
  v_suppliers jsonb;
  v_price_alerts jsonb;
  v_avg_depletion numeric;
  v_trend numeric;
  v_total_stock bigint;
  v_supplier_count bigint;
  v_demand_label text;
  v_classification text;
  v_turnover_score numeric;
BEGIN

  -- ═══════════════════════════════════
  -- KPIs PRINCIPAIS (período dinâmico)
  -- ═══════════════════════════════════
  WITH period_data AS (
    SELECT
      sd.supplier_id,
      SUM(sd.units_depleted) AS total_depleted,
      COUNT(*) FILTER (WHERE sd.sync_count > 0) AS active_days,
      MIN(sd.stock_close) AS min_stock,
      MAX(sd.stock_close) AS max_stock
    FROM stock_daily_summary sd
    WHERE sd.product_id = p_product_id
      AND sd.summary_date >= CURRENT_DATE - p_days
    GROUP BY sd.supplier_id
  ),
  -- Período recente (últimos 7 dias) pra calcular velocidade atual
  recent_data AS (
    SELECT
      SUM(sd.units_depleted) AS depleted_7d,
      COUNT(*) FILTER (WHERE sd.sync_count > 0) AS active_days_7d
    FROM stock_daily_summary sd
    WHERE sd.product_id = p_product_id
      AND sd.summary_date >= CURRENT_DATE - 7
  ),
  -- Estoque atual de cada fornecedor
  current_stock AS (
    SELECT 
      COUNT(DISTINCT vss.supplier_id) AS supplier_count,
      SUM(vss.stock_main_warehouse + vss.stock_other_warehouses) AS total_stock
    FROM variant_supplier_sources vss
    JOIN product_variants pv ON pv.id = vss.variant_id
    WHERE pv.product_id = p_product_id
      AND (vss.stock_main_warehouse + vss.stock_other_warehouses) > 0
  )
  SELECT INTO v_avg_depletion, v_total_stock, v_supplier_count
    COALESCE(
      (SELECT depleted_7d::numeric / NULLIF(active_days_7d, 0) FROM recent_data),
      COALESCE(SUM(pd.total_depleted)::numeric / NULLIF(SUM(pd.active_days), 0), 0)
    ),
    COALESCE(cs.total_stock, 0),
    COALESCE(cs.supplier_count, 0)
  FROM current_stock cs
  LEFT JOIN period_data pd ON true
  GROUP BY cs.total_stock, cs.supplier_count;

  -- Defaults se não houver dados
  v_avg_depletion := COALESCE(v_avg_depletion, 0);
  v_total_stock := COALESCE(v_total_stock, 0);
  v_supplier_count := COALESCE(v_supplier_count, 0);

  -- Tendência: comparar primeira metade vs segunda metade do período
  SELECT INTO v_trend
    CASE 
      WHEN COALESCE(first_half, 0) > 0 
      THEN ROUND(((second_half::numeric / NULLIF(first_half, 0)) - 1) * 100, 0)
      ELSE 0
    END
  FROM (
    SELECT
      SUM(CASE WHEN sd.summary_date < CURRENT_DATE - (p_days / 2) THEN sd.units_depleted ELSE 0 END) AS first_half,
      SUM(CASE WHEN sd.summary_date >= CURRENT_DATE - (p_days / 2) THEN sd.units_depleted ELSE 0 END) AS second_half
    FROM stock_daily_summary sd
    WHERE sd.product_id = p_product_id
      AND sd.summary_date >= CURRENT_DATE - p_days
  ) halves;

  v_trend := COALESCE(v_trend, 0);

  -- Classificação de demanda
  v_demand_label := CASE
    WHEN v_avg_depletion >= 10 AND v_trend > 10 THEN 'Muito Alta'
    WHEN v_avg_depletion >= 5 OR v_trend > 20 THEN 'Alta'
    WHEN v_avg_depletion >= 1 THEN 'Normal'
    WHEN v_avg_depletion > 0 THEN 'Baixa'
    ELSE 'Sem dados'
  END;

  -- Classificação do produto
  SELECT INTO v_classification, v_turnover_score
    CASE
      WHEN pi.is_hot_product THEN 'Quente'
      WHEN pi.is_stockout_risk THEN 'Risco de Ruptura'
      WHEN pi.is_stagnant THEN 'Estagnado'
      WHEN pi.is_negotiation_opportunity THEN 'Oportunidade'
      ELSE 'Normal'
    END,
    COALESCE(pi.turnover_score, 0)
  FROM mv_product_intelligence pi
  WHERE pi.product_id = p_product_id;

  v_classification := COALESCE(v_classification, 'Sem dados');
  v_turnover_score := COALESCE(v_turnover_score, 0);

  v_kpis := jsonb_build_object(
    'vendas_dia_media', ROUND(v_avg_depletion, 1),
    'demanda', v_demand_label,
    'demanda_crescendo', v_trend > 0,
    'tendencia_pct', v_trend,
    'disponivel_total', v_total_stock,
    'fornecedores_count', v_supplier_count,
    'potencial', v_turnover_score,
    'classificacao', v_classification,
    'dias_ate_ruptura', (
      SELECT ROUND(MIN(sv.days_to_stockout), 0)
      FROM mv_stock_velocity sv 
      WHERE sv.product_id = p_product_id
    )
  );

  -- ═══════════════════════════════════
  -- DADOS DO GRÁFICO (série temporal)
  -- ═══════════════════════════════════
  SELECT INTO v_chart
    COALESCE(jsonb_agg(
      jsonb_build_object(
        'data', dia.summary_date,
        'disponivel', dia.disponivel,
        'compras_mercado', dia.compras,
        'reposicao', dia.reposicao
      ) ORDER BY dia.summary_date
    ), '[]'::jsonb)
  FROM (
    SELECT
      sd.summary_date,
      SUM(sd.stock_close) AS disponivel,
      SUM(sd.units_depleted) AS compras,
      SUM(CASE WHEN sd.restock_detected THEN sd.restock_quantity ELSE 0 END) AS reposicao
    FROM stock_daily_summary sd
    WHERE sd.product_id = p_product_id
      AND sd.summary_date >= CURRENT_DATE - p_days
    GROUP BY sd.summary_date
  ) dia;

  -- ═══════════════════════════════════
  -- COMPARATIVO POR FORNECEDOR
  -- ═══════════════════════════════════
  SELECT INTO v_suppliers
    COALESCE(jsonb_agg(
      jsonb_build_object(
        'fornecedor', sup.name,
        'supplier_id', sup.supplier_id,
        'saida_dia', sup.saida_dia,
        'estoque', sup.estoque,
        'tendencia_pct', sup.tendencia_pct,
        'maior_saida', sup.ranking = 1,
        'preco_atual', sup.preco_atual,
        'dias_ate_ruptura', sup.dias_ruptura
      ) ORDER BY sup.saida_dia DESC NULLS LAST
    ), '[]'::jsonb)
  FROM (
    SELECT 
      s.name,
      sv.supplier_id,
      sv.avg_daily_depletion_7d AS saida_dia,
      sv.current_stock AS estoque,
      ROUND((COALESCE(sv.velocity_trend, 1) - 1) * 100, 0) AS tendencia_pct,
      sv.current_price AS preco_atual,
      ROUND(sv.days_to_stockout, 0) AS dias_ruptura,
      RANK() OVER (ORDER BY sv.avg_daily_depletion_7d DESC NULLS LAST) AS ranking
    FROM mv_stock_velocity sv
    JOIN suppliers s ON s.id = sv.supplier_id
    WHERE sv.product_id = p_product_id
  ) sup;

  -- ═══════════════════════════════════
  -- ALERTAS DE PREÇO
  -- ═══════════════════════════════════
  SELECT INTO v_price_alerts
    COALESCE(jsonb_agg(
      jsonb_build_object(
        'fornecedor', s.name,
        'mudancas_preco_30d', sv.price_changes_30d
      )
    ), '[]'::jsonb)
  FROM mv_stock_velocity sv
  JOIN suppliers s ON s.id = sv.supplier_id
  WHERE sv.product_id = p_product_id
    AND sv.price_changes_30d > 0;

  -- ═══════════════════════════════════
  -- RESULTADO FINAL
  -- ═══════════════════════════════════
  v_result := jsonb_build_object(
    'product_id', p_product_id,
    'periodo_dias', p_days,
    'kpis', v_kpis,
    'grafico', v_chart,
    'fornecedores', v_suppliers,
    'alertas_preco', v_price_alerts,
    'gerado_em', now()
  );

  RETURN v_result;
END;
$function$
;

-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.fn_save_quote_draft(p_data jsonb)
 RETURNS uuid
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
DECLARE v_draft_id UUID;
BEGIN
    INSERT INTO public.quote_drafts (user_id, data, last_saved_at)
    VALUES (auth.uid(), p_data, now())
    ON CONFLICT (user_id) DO UPDATE SET data = EXCLUDED.data, last_saved_at = now()
    RETURNING id INTO v_draft_id;
    RETURN v_draft_id;
END;
$function$
;

-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.fn_validate_role_change()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$ BEGIN RETURN NEW; END; $function$
;

-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.force_user_logout(_user_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT public.is_supervisor_or_above(auth.uid()) THEN RAISE EXCEPTION 'Permission denied'; END IF;
  INSERT INTO public.user_token_revocations (user_id) VALUES (_user_id)
  ON CONFLICT (user_id) DO UPDATE SET revoked_at = now();
  INSERT INTO public.admin_audit_log (user_id, action, resource_type, resource_id, source)
  VALUES (auth.uid(), 'user.force_logout', 'user', _user_id::text, 'rpc');
END $function$
;

-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.generate_step_up_challenge(_action step_up_action, _target_ref text DEFAULT NULL::text)
 RETURNS uuid
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
DECLARE v_id uuid; v_otp text;
BEGIN
  v_otp := lpad((floor(random()*1000000))::text, 6, '0');
  INSERT INTO public.step_up_challenges (user_id, action, target_ref, otp_hash)
  VALUES (auth.uid(), _action, _target_ref, crypt(v_otp, gen_salt('bf')))
  RETURNING id INTO v_id;
  RETURN v_id;
END $function$
;

-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_active_commemorative_dates()
 RETURNS TABLE(id uuid, name text, slug text, date_day integer, date_month integer, formatted_date text, category text, icon_name text, color_hex text, days_until integer, campaign_start_days integer, is_featured boolean, color_count bigint, product_count bigint)
 LANGUAGE plpgsql
 STABLE
 SET search_path TO 'public'
AS $function$
DECLARE
    v_day INT := EXTRACT(DAY FROM CURRENT_DATE);
    v_month INT := EXTRACT(MONTH FROM CURRENT_DATE);
    v_year INT := EXTRACT(YEAR FROM CURRENT_DATE);
BEGIN
    RETURN QUERY
    SELECT 
        cd.id,
        cd.name,
        cd.slug,
        cd.date_day,
        cd.date_month,
        CASE 
            WHEN cd.is_fixed_date AND cd.date_day IS NOT NULL 
            THEN LPAD(cd.date_day::TEXT, 2, '0') || '/' || LPAD(cd.date_month::TEXT, 2, '0')
            ELSE cd.variable_date_rule
        END,
        cd.category,
        cd.icon_name,
        cd.color_hex,
        CASE 
            WHEN cd.is_fixed_date AND cd.date_day IS NOT NULL THEN
                (make_date(
                    CASE WHEN cd.date_month < v_month OR (cd.date_month = v_month AND cd.date_day < v_day)
                    THEN v_year + 1 ELSE v_year END, cd.date_month, cd.date_day
                ) - CURRENT_DATE)::INT
            ELSE NULL
        END,
        cd.campaign_start_days,
        cd.is_featured,
        (SELECT COUNT(*) FROM commemorative_date_colors cdc WHERE cdc.commemorative_date_id = cd.id),
        0::BIGINT AS product_count
    FROM commemorative_dates cd
    WHERE cd.is_active = TRUE
      AND (
          cd.is_fixed_date = FALSE
          OR (make_date(
              CASE WHEN cd.date_month < v_month OR (cd.date_month = v_month AND cd.date_day < v_day)
                   THEN v_year + 1 ELSE v_year END,
              cd.date_month, cd.date_day
          ) - CURRENT_DATE)::INT <= cd.campaign_start_days
      )
    ORDER BY cd.date_month, cd.date_day NULLS LAST;
END;
$function$
;

-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_app_setting(p_key character varying)
 RETURNS text
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
DECLARE
    v_value TEXT;
BEGIN
    SELECT value INTO v_value
    FROM app_settings
    WHERE key = p_key;
    
    RETURN v_value;
END;
$function$
;

-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_best_supplier_for_quantity(p_variant_id uuid, p_quantity integer, p_criteria character varying DEFAULT 'stock'::character varying)
 RETURNS TABLE(supplier_id uuid, supplier_name text, supplier_code text, supplier_sku character varying, available_quantity integer, unit_cost numeric, lead_time_days integer, can_fulfill boolean, recommendation_reason text)
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
BEGIN
    RETURN QUERY
    WITH supplier_analysis AS (
        SELECT 
            vss.supplier_id,
            s.name::TEXT AS supplier_name,
            s.code::TEXT AS supplier_code,
            vss.supplier_sku,
            (COALESCE(vss.quantity, 0) - COALESCE(vss.reserved_quantity, 0))::INTEGER AS available_qty,
            -- Calcular preço para a quantidade solicitada
            CASE 
                WHEN p_quantity >= COALESCE(vss.min_qty_5, 2147483647) THEN vss.cost_price_5
                WHEN p_quantity >= COALESCE(vss.min_qty_4, 2147483647) THEN vss.cost_price_4
                WHEN p_quantity >= COALESCE(vss.min_qty_3, 2147483647) THEN vss.cost_price_3
                WHEN p_quantity >= COALESCE(vss.min_qty_2, 2147483647) THEN vss.cost_price_2
                WHEN p_quantity >= COALESCE(vss.min_qty_1, 1) THEN vss.cost_price_1
                ELSE vss.cost_price
            END AS calculated_cost,
            vss.lead_time_days AS lead_time,
            vss.priority,
            COALESCE(vss.is_preferred, FALSE) AS is_preferred
        FROM variant_supplier_sources vss
        INNER JOIN suppliers s ON s.id = vss.supplier_id
        WHERE vss.variant_id = p_variant_id
        AND vss.is_active = TRUE
        AND COALESCE(vss.removed_from_api, FALSE) = FALSE
    )
    SELECT 
        sa.supplier_id,
        sa.supplier_name,
        sa.supplier_code,
        sa.supplier_sku,
        sa.available_qty AS available_quantity,
        sa.calculated_cost AS unit_cost,
        sa.lead_time AS lead_time_days,
        sa.available_qty >= p_quantity AS can_fulfill,
        CASE 
            WHEN sa.available_qty >= p_quantity THEN
                CASE p_criteria
                    WHEN 'stock' THEN 'Maior estoque disponível'
                    WHEN 'cost' THEN 'Menor custo unitário'
                    WHEN 'lead_time' THEN 'Menor prazo de entrega'
                    ELSE 'Recomendado'
                END
            WHEN sa.available_qty > 0 THEN 
                'Estoque parcial: ' || sa.available_qty || ' de ' || p_quantity
            ELSE 
                'Sem estoque disponível'
        END AS recommendation_reason
    FROM supplier_analysis sa
    ORDER BY 
        -- Primeiro: pode atender a quantidade?
        CASE WHEN sa.available_qty >= p_quantity THEN 0 ELSE 1 END,
        -- Segundo: critério escolhido
        CASE p_criteria
            WHEN 'stock' THEN -sa.available_qty
            WHEN 'cost' THEN COALESCE(sa.calculated_cost, 999999)
            WHEN 'lead_time' THEN COALESCE(sa.lead_time, 999)
            ELSE -sa.available_qty
        END,
        -- Terceiro: prioridade
        sa.priority ASC;
END;
$function$
;

-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_cloudflare_stats()
 RETURNS TABLE(total_images bigint, images_with_cloudflare bigint, images_pending bigint, total_videos bigint, videos_with_cloudflare bigint, videos_pending bigint, total_sync_logs bigint, sync_success bigint, sync_errors bigint, last_sync_at timestamp with time zone)
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
BEGIN
    RETURN QUERY
    SELECT
        -- Imagens
        (SELECT COUNT(*) FROM product_images)::BIGINT,
        (SELECT COUNT(*) FROM product_images WHERE cloudflare_image_id IS NOT NULL AND cloudflare_image_id NOT LIKE 'cf-img-%')::BIGINT,
        (SELECT COUNT(*) FROM product_images WHERE cloudflare_image_id IS NULL OR cloudflare_image_id LIKE 'cf-img-%')::BIGINT,
        
        -- Vídeos
        (SELECT COUNT(*) FROM product_videos)::BIGINT,
        (SELECT COUNT(*) FROM product_videos WHERE cloudflare_video_id IS NOT NULL AND cloudflare_video_id NOT LIKE 'cf-vid-%')::BIGINT,
        (SELECT COUNT(*) FROM product_videos WHERE cloudflare_video_id IS NULL OR cloudflare_video_id LIKE 'cf-vid-%')::BIGINT,
        
        -- Logs
        (SELECT COUNT(*) FROM media_sync_log)::BIGINT,
        (SELECT COUNT(*) FROM media_sync_log WHERE status = 'success')::BIGINT,
        (SELECT COUNT(*) FROM media_sync_log WHERE status = 'error')::BIGINT,
        (SELECT MAX(created_at) FROM media_sync_log)::TIMESTAMPTZ;
END;
$function$
;

-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_pending_images_for_sync(p_limit integer DEFAULT 100)
 RETURNS TABLE(id uuid, product_id uuid, url_original text, image_type character varying, variant_id uuid, color_id uuid)
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
BEGIN
    RETURN QUERY
    SELECT 
        pi.id,
        pi.product_id,
        pi.url_original,
        pi.image_type,
        pi.variant_id,
        pi.color_id
    FROM product_images pi
    WHERE pi.is_active = true
      AND pi.url_original IS NOT NULL
      AND pi.url_original != ''
      AND (pi.cloudflare_image_id IS NULL OR pi.cloudflare_image_id LIKE 'cf-img-%')
    ORDER BY pi.created_at ASC
    LIMIT p_limit;
END;
$function$
;

-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_pending_videos_for_sync(p_limit integer DEFAULT 50)
 RETURNS TABLE(id uuid, product_id uuid, url_original text, source_youtube_id character varying, title character varying, video_type character varying)
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
BEGIN
    RETURN QUERY
    SELECT 
        pv.id,
        pv.product_id,
        pv.url_original,
        pv.source_youtube_id,
        pv.title,
        pv.video_type
    FROM product_videos pv
    WHERE pv.is_active = true
      AND (pv.url_original IS NOT NULL OR pv.source_youtube_id IS NOT NULL)
      AND (pv.cloudflare_video_id IS NULL OR pv.cloudflare_video_id LIKE 'cf-vid-%')
    ORDER BY pv.created_at ASC
    LIMIT p_limit;
END;
$function$
;

-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_upcoming_commemorative_dates(p_days_ahead integer DEFAULT 60)
 RETURNS TABLE(id uuid, name text, slug text, date_day integer, date_month integer, is_fixed_date boolean, category text, target_audience text, icon_name text, color_hex text, campaign_start_days integer, days_until integer, is_in_campaign boolean)
 LANGUAGE plpgsql
 STABLE
 SET search_path TO 'public'
AS $function$
DECLARE
    current_day INT := EXTRACT(DAY FROM CURRENT_DATE);
    current_month INT := EXTRACT(MONTH FROM CURRENT_DATE);
    current_year INT := EXTRACT(YEAR FROM CURRENT_DATE);
BEGIN
    RETURN QUERY
    SELECT 
        cd.id,
        cd.name,
        cd.slug,
        cd.date_day,
        cd.date_month,
        cd.is_fixed_date,
        cd.category,
        cd.target_audience,
        cd.icon_name,
        cd.color_hex,
        cd.campaign_start_days,
        -- Calcular dias até a data
        CASE 
            WHEN cd.is_fixed_date AND cd.date_day IS NOT NULL THEN
                (make_date(
                    CASE 
                        WHEN cd.date_month < current_month OR 
                             (cd.date_month = current_month AND cd.date_day < current_day)
                        THEN current_year + 1 
                        ELSE current_year 
                    END,
                    cd.date_month,
                    cd.date_day
                ) - CURRENT_DATE)::INT
            ELSE NULL
        END AS days_until,
        -- Verificar se está no período de campanha
        CASE 
            WHEN cd.is_fixed_date AND cd.date_day IS NOT NULL THEN
                (make_date(
                    CASE 
                        WHEN cd.date_month < current_month OR 
                             (cd.date_month = current_month AND cd.date_day < current_day)
                        THEN current_year + 1 
                        ELSE current_year 
                    END,
                    cd.date_month,
                    cd.date_day
                ) - CURRENT_DATE)::INT <= cd.campaign_start_days
            ELSE FALSE
        END AS is_in_campaign
    FROM commemorative_dates cd
    WHERE cd.is_active = TRUE
    ORDER BY 
        CASE 
            WHEN cd.date_month >= current_month THEN cd.date_month
            ELSE cd.date_month + 12
        END,
        cd.date_day NULLS LAST;
END;
$function$
;

-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.grant_mcp_full_to_user(_target_user_id uuid, _reason text)
 RETURNS uuid
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT public.can_grant_mcp_full_to_user(_target_user_id) THEN
    RAISE EXCEPTION 'Permission denied: only admins can grant MCP full to other users';
  END IF;
  INSERT INTO public.mcp_full_grantors (user_id, granted_by, reason)
  VALUES (_target_user_id, auth.uid(), _reason)
  ON CONFLICT (user_id) DO UPDATE SET granted_by = EXCLUDED.granted_by, reason = EXCLUDED.reason, granted_at = now();
  RETURN _target_user_id;
END $function$
;

-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.limit_recently_viewed_products()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$ BEGIN RETURN NEW; END; $function$
;

-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.log_audit(_action text, _resource_type text, _resource_id text, _details jsonb DEFAULT '{}'::jsonb)
 RETURNS uuid
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
DECLARE v_id uuid;
BEGIN
  INSERT INTO public.admin_audit_log (user_id, action, resource_type, resource_id, details)
  VALUES (auth.uid(), _action, _resource_type, _resource_id, _details) RETURNING id INTO v_id;
  RETURN v_id;
END $function$
;

-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.log_login_attempt(_email text, _success boolean, _user_id uuid DEFAULT NULL::uuid, _ip text DEFAULT NULL::text, _user_agent text DEFAULT NULL::text, _failure_reason text DEFAULT NULL::text)
 RETURNS uuid
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
DECLARE v_id uuid;
BEGIN
  INSERT INTO public.login_attempts (email, user_id, ip_address, user_agent, success, failure_reason)
  VALUES (_email, _user_id, _ip, _user_agent, _success, _failure_reason)
  RETURNING id INTO v_id;
  RETURN v_id;
EXCEPTION WHEN OTHERS THEN RETURN NULL;
END $function$
;

-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.log_step_up_audit(_event_type text, _action step_up_action DEFAULT NULL::step_up_action, _metadata jsonb DEFAULT '{}'::jsonb)
 RETURNS uuid
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
DECLARE v_id uuid;
BEGIN
  INSERT INTO public.step_up_audit_log (user_id, event_type, action, metadata)
  VALUES (auth.uid(), _event_type, _action, _metadata) RETURNING id INTO v_id;
  RETURN v_id;
EXCEPTION WHEN OTHERS THEN RETURN NULL;
END $function$
;

-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.log_voice_command(_transcript text, _action text DEFAULT NULL::text, _success boolean DEFAULT true, _data jsonb DEFAULT '{}'::jsonb)
 RETURNS uuid
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
DECLARE v_id uuid;
BEGIN
  INSERT INTO public.voice_command_logs (user_id, transcript, action, success, data)
  VALUES (auth.uid(), _transcript, _action, _success, _data)
  RETURNING id INTO v_id;
  RETURN v_id;
END $function$
;

-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.magic_up_audit_changes()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$ BEGIN RETURN NEW; END; $function$
;

-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.magic_up_calculate_score(_generation_id uuid)
 RETURNS numeric
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
DECLARE v_score numeric;
BEGIN
  -- A edge function magic-up-score implementa lógica detalhada; aqui só retorna o quality_score salvo
  SELECT quality_score INTO v_score FROM public.magic_up_generations WHERE id = _generation_id;
  RETURN COALESCE(v_score, 0);
END $function$
;

-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.magic_up_create_brand_kit(_data jsonb)
 RETURNS uuid
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
DECLARE v_id uuid;
BEGIN
  INSERT INTO public.magic_up_brand_kits (
    user_id, client_id, client_name, logo_urls, primary_color, secondary_color,
    tone_of_voice, visual_style, required_words, forbidden_words, notes, metadata
  )
  VALUES (
    auth.uid(),
    _data->>'client_id',
    _data->>'client_name',
    COALESCE(_data->'logo_urls','[]'::jsonb),
    _data->>'primary_color',
    _data->>'secondary_color',
    _data->>'tone_of_voice',
    _data->>'visual_style',
    COALESCE(_data->'required_words','[]'::jsonb),
    COALESCE(_data->'forbidden_words','[]'::jsonb),
    _data->>'notes',
    COALESCE(_data->'metadata','{}'::jsonb)
  )
  RETURNING id INTO v_id;
  RETURN v_id;
END $function$
;

-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.magic_up_create_campaign(_data jsonb)
 RETURNS uuid
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
DECLARE v_id uuid;
BEGIN
  INSERT INTO public.magic_up_campaigns (
    user_id, client_id, client_name, title, objective, channel, audience, tone, cta, occasion, status, metadata
  )
  VALUES (
    auth.uid(),
    _data->>'client_id',
    _data->>'client_name',
    COALESCE(_data->>'title', 'Campaign'),
    _data->>'objective',
    _data->>'channel',
    _data->>'audience',
    _data->>'tone',
    _data->>'cta',
    _data->>'occasion',
    COALESCE(_data->>'status', 'draft'),
    COALESCE(_data->'metadata','{}'::jsonb)
  )
  RETURNING id INTO v_id;
  RETURN v_id;
END $function$
;

-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.magic_up_increment_metric(_kit_id uuid, _metric text)
 RETURNS void
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
BEGIN
  UPDATE public.magic_up_brand_kits
  SET metadata = jsonb_set(COALESCE(metadata,'{}'::jsonb), ARRAY['metrics', _metric], 
    to_jsonb(COALESCE((metadata->'metrics'->>_metric)::int, 0) + 1))
  WHERE id = _kit_id AND user_id = auth.uid();
END $function$
;

-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.magic_up_save_generation(_data jsonb)
 RETURNS uuid
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
DECLARE v_id uuid;
BEGIN
  INSERT INTO public.magic_up_generations (
    user_id, product_name, scene_title, scene_category, client_name, generated_image_url,
    campaign_id, product_id, product_sku, prompt_text, model, channel, aspect_ratio,
    quality_score, status, tags, metadata, copy_pack, export_presets
  )
  VALUES (
    auth.uid(),
    _data->>'product_name',
    _data->>'scene_title',
    _data->>'scene_category',
    _data->>'client_name',
    _data->>'generated_image_url',
    (_data->>'campaign_id')::uuid,
    _data->>'product_id',
    _data->>'product_sku',
    _data->>'prompt_text',
    _data->>'model',
    _data->>'channel',
    _data->>'aspect_ratio',
    COALESCE((_data->>'quality_score')::numeric, 0),
    COALESCE(_data->>'status','generated'),
    COALESCE(_data->'tags','[]'::jsonb),
    COALESCE(_data->'metadata','{}'::jsonb),
    COALESCE(_data->'copy_pack','{}'::jsonb),
    COALESCE(_data->'export_presets','[]'::jsonb)
  )
  RETURNING id INTO v_id;
  RETURN v_id;
END $function$
;

-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.mcp_audit_violation(_key_id uuid, _reason text, _details jsonb DEFAULT '{}'::jsonb)
 RETURNS uuid
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
DECLARE v_id uuid;
BEGIN
  INSERT INTO public.mcp_access_violations (user_id, target_key_id, reason, source, details)
  VALUES (auth.uid(), _key_id, _reason, 'rpc', _details) RETURNING id INTO v_id;
  RETURN v_id;
EXCEPTION WHEN OTHERS THEN RETURN NULL;
END $function$
;

-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.move_favorites_to_trash(_item_ids uuid[])
 RETURNS integer
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
DECLARE v_count int;
BEGIN
  WITH deleted AS (
    DELETE FROM public.favorite_items
    WHERE id = ANY(_item_ids) AND user_id = auth.uid()
    RETURNING *
  ),
  inserted AS (
    INSERT INTO public.favorite_items_trash (id, list_id, user_id, product_id, variant_id, variant_info, note, price_at_save)
    SELECT id, list_id, user_id, product_id, variant_id, variant_info, note, price_at_save FROM deleted
    RETURNING id
  )
  SELECT count(*) INTO v_count FROM inserted;
  RETURN v_count;
EXCEPTION WHEN OTHERS THEN RETURN 0;
END $function$
;

-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.normalize_unit(p_value numeric, p_source_unit character varying, p_target_unit character varying)
 RETURNS numeric
 LANGUAGE plpgsql
 IMMUTABLE
 SET search_path TO 'public'
AS $function$
BEGIN
    -- Retornar NULL se valor é NULL
    IF p_value IS NULL THEN
        RETURN NULL;
    END IF;
    
    -- Se unidades são iguais, retornar valor original
    IF LOWER(p_source_unit) = LOWER(p_target_unit) THEN
        RETURN p_value;
    END IF;
    
    -- CONVERSÕES DE PESO
    IF LOWER(p_source_unit) = 'kg' AND LOWER(p_target_unit) = 'g' THEN
        RETURN p_value * 1000;
    ELSIF LOWER(p_source_unit) = 'g' AND LOWER(p_target_unit) = 'kg' THEN
        RETURN p_value / 1000;
    ELSIF LOWER(p_source_unit) = 'kg' AND LOWER(p_target_unit) = 'mg' THEN
        RETURN p_value * 1000000;
    ELSIF LOWER(p_source_unit) = 'mg' AND LOWER(p_target_unit) = 'kg' THEN
        RETURN p_value / 1000000;
    ELSIF LOWER(p_source_unit) = 'g' AND LOWER(p_target_unit) = 'mg' THEN
        RETURN p_value * 1000;
    ELSIF LOWER(p_source_unit) = 'mg' AND LOWER(p_target_unit) = 'g' THEN
        RETURN p_value / 1000;
    
    -- CONVERSÕES DE COMPRIMENTO
    ELSIF LOWER(p_source_unit) = 'm' AND LOWER(p_target_unit) = 'cm' THEN
        RETURN p_value * 100;
    ELSIF LOWER(p_source_unit) = 'cm' AND LOWER(p_target_unit) = 'm' THEN
        RETURN p_value / 100;
    ELSIF LOWER(p_source_unit) = 'm' AND LOWER(p_target_unit) = 'mm' THEN
        RETURN p_value * 1000;
    ELSIF LOWER(p_source_unit) = 'mm' AND LOWER(p_target_unit) = 'm' THEN
        RETURN p_value / 1000;
    ELSIF LOWER(p_source_unit) = 'cm' AND LOWER(p_target_unit) = 'mm' THEN
        RETURN p_value * 10;
    ELSIF LOWER(p_source_unit) = 'mm' AND LOWER(p_target_unit) = 'cm' THEN
        RETURN p_value / 10;
    
    -- CONVERSÕES DE VOLUME
    ELSIF LOWER(p_source_unit) = 'l' AND LOWER(p_target_unit) = 'ml' THEN
        RETURN p_value * 1000;
    ELSIF LOWER(p_source_unit) = 'ml' AND LOWER(p_target_unit) = 'l' THEN
        RETURN p_value / 1000;
    
    -- Conversão não suportada
    ELSE
        RAISE WARNING 'Conversão não suportada: % → %', p_source_unit, p_target_unit;
        RETURN p_value;
    END IF;
    
EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'Erro em normalize_unit: %', SQLERRM;
    RETURN p_value;
END;
$function$
;

-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.ownership_repair(_report_id uuid, _dry_run boolean DEFAULT true)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT public.is_admin(auth.uid()) THEN RAISE EXCEPTION 'Permission denied'; END IF;
  INSERT INTO public.ownership_repair_logs (report_id, table_name, owner_column, issue_type, action, rows_affected, dry_run, triggered_by)
  VALUES (_report_id, 'multi', 'multi', 'manual_review', 'manual_review', 0, _dry_run, auth.uid());
  RETURN jsonb_build_object('status', 'logged', 'dry_run', _dry_run);
END $function$
;

-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.rate_limit_check(_identifier text, _endpoint text, _max_requests integer DEFAULT 100, _window_seconds integer DEFAULT 60)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
DECLARE v_record record; v_now timestamptz := now(); v_window_start timestamptz;
BEGIN
  v_window_start := v_now - (_window_seconds || ' seconds')::interval;
  
  -- Limpa janela expirada
  DELETE FROM public.request_rate_limits 
  WHERE identifier = _identifier AND endpoint = _endpoint AND window_start < v_window_start;
  
  SELECT * INTO v_record FROM public.request_rate_limits
  WHERE identifier = _identifier AND endpoint = _endpoint;
  
  IF NOT FOUND THEN
    INSERT INTO public.request_rate_limits (identifier, endpoint, request_count, window_start)
    VALUES (_identifier, _endpoint, 1, v_now);
    RETURN jsonb_build_object('allowed', true, 'remaining', _max_requests - 1, 'blocked', false);
  END IF;
  
  IF v_record.blocked_until IS NOT NULL AND v_record.blocked_until > v_now THEN
    RETURN jsonb_build_object('allowed', false, 'remaining', 0, 'blocked', true, 'retry_after', v_record.blocked_until);
  END IF;
  
  IF v_record.request_count >= _max_requests THEN
    UPDATE public.request_rate_limits 
    SET blocked_until = v_now + interval '15 minutes'
    WHERE id = v_record.id;
    RETURN jsonb_build_object('allowed', false, 'remaining', 0, 'blocked', true, 'retry_after', v_now + interval '15 minutes');
  END IF;
  
  UPDATE public.request_rate_limits 
  SET request_count = request_count + 1, updated_at = v_now
  WHERE id = v_record.id;
  
  RETURN jsonb_build_object('allowed', true, 'remaining', _max_requests - v_record.request_count - 1, 'blocked', false);
END $function$
;

-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.record_app_vital(_name text, _value double precision, _rating text DEFAULT NULL::text, _req_id text DEFAULT NULL::text, _url text DEFAULT NULL::text, _ua text DEFAULT NULL::text, _uid uuid DEFAULT NULL::uuid)
 RETURNS void
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO public.app_vitals (metric_name, metric_value, rating, request_id, page_url, user_agent, user_id)
  VALUES (_name, _value, _rating, _req_id, _url, _ua, _uid);
END;
$function$
;

-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.register_ai_routing_decision(p_function_name text, p_user_id uuid, p_attempted_models uuid[], p_attempted_providers uuid[], p_attempted_outcomes jsonb, p_final_model_id uuid, p_final_provider_id uuid, p_total_attempts integer, p_total_duration_ms integer, p_outcome text, p_usage_log_id uuid DEFAULT NULL::uuid, p_request_id text DEFAULT NULL::text)
 RETURNS uuid
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
DECLARE
  v_id uuid;
BEGIN
  INSERT INTO public.ai_routing_decisions (
    function_name, user_id, attempted_models, attempted_providers, attempted_outcomes,
    final_model_id, final_provider_id, total_attempts, total_duration_ms, outcome,
    usage_log_id, request_id
  ) VALUES (
    p_function_name, p_user_id, p_attempted_models, p_attempted_providers, p_attempted_outcomes,
    p_final_model_id, p_final_provider_id, p_total_attempts, p_total_duration_ms, p_outcome,
    p_usage_log_id, p_request_id
  ) RETURNING id INTO v_id;
  RETURN v_id;
END;
$function$
;

-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.registrar_entrada_estoque(p_variant_sku character varying, p_quantity integer, p_unit_cost numeric DEFAULT NULL::numeric, p_supplier_name character varying DEFAULT NULL::character varying, p_document_number character varying DEFAULT NULL::character varying, p_notes text DEFAULT NULL::text, p_user_id uuid DEFAULT NULL::uuid)
 RETURNS json
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
DECLARE
    v_variant_id UUID;
    v_stock_before INTEGER;
    v_stock_after INTEGER;
    v_movement_id UUID;
BEGIN
    IF p_quantity <= 0 THEN
        RETURN json_build_object('success', false, 'error', 'Quantidade deve ser maior que zero');
    END IF;

    SELECT id INTO v_variant_id FROM product_variants WHERE sku = p_variant_sku;
    
    IF v_variant_id IS NULL THEN
        RETURN json_build_object('success', false, 'error', format('Variante não encontrada: %s', p_variant_sku));
    END IF;
    
    SELECT COALESCE(stock_quantity, 0) INTO v_stock_before FROM product_variants WHERE id = v_variant_id;
    v_stock_after := v_stock_before + p_quantity;
    
    INSERT INTO stock_movements (id, variant_id, movement_type, quantity, stock_before, stock_after, unit_cost, reference_type, reference_number, notes, created_by, created_at)
    VALUES (gen_random_uuid(), v_variant_id, 'ENTRADA', p_quantity, v_stock_before, v_stock_after, p_unit_cost,
            CASE WHEN p_document_number IS NOT NULL THEN 'NF' ELSE NULL END, p_document_number,
            COALESCE(p_notes, format('Entrada de %s unidades - Fornecedor: %s', p_quantity, COALESCE(p_supplier_name, 'N/A'))),
            p_user_id, NOW())
    RETURNING id INTO v_movement_id;
    
    UPDATE product_variants SET stock_quantity = v_stock_after, updated_at = NOW() WHERE id = v_variant_id;
    
    RETURN json_build_object('success', true, 'movement_id', v_movement_id, 'variant_id', v_variant_id, 'sku', p_variant_sku,
                             'quantity_added', p_quantity, 'stock_before', v_stock_before, 'stock_after', v_stock_after, 'movement_type', 'ENTRADA');
EXCEPTION WHEN OTHERS THEN
    RETURN json_build_object('success', false, 'error', SQLERRM);
END;
$function$
;

-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.registrar_saida_estoque(p_variant_sku character varying, p_quantity integer, p_movement_type character varying DEFAULT 'VENDA'::character varying, p_document_number character varying DEFAULT NULL::character varying, p_notes text DEFAULT NULL::text, p_user_id uuid DEFAULT NULL::uuid, p_allow_negative boolean DEFAULT false)
 RETURNS json
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
DECLARE
    v_variant_id UUID;
    v_stock_before INTEGER;
    v_stock_after INTEGER;
    v_movement_id UUID;
BEGIN
    IF p_quantity <= 0 THEN
        RETURN json_build_object('success', false, 'error', 'Quantidade deve ser maior que zero');
    END IF;

    IF p_movement_type NOT IN ('VENDA', 'RESERVA', 'AJUSTE', 'PERDA', 'DEVOLUCAO_FORNECEDOR') THEN
        RETURN json_build_object('success', false, 'error', format('Tipo de movimento inválido: %s', p_movement_type));
    END IF;

    SELECT id INTO v_variant_id FROM product_variants WHERE sku = p_variant_sku;
    
    IF v_variant_id IS NULL THEN
        RETURN json_build_object('success', false, 'error', format('Variante não encontrada: %s', p_variant_sku));
    END IF;
    
    SELECT COALESCE(stock_quantity, 0) INTO v_stock_before FROM product_variants WHERE id = v_variant_id;
    
    IF v_stock_before < p_quantity AND NOT p_allow_negative THEN
        RETURN json_build_object('success', false, 'error', 'Estoque insuficiente', 'stock_available', v_stock_before, 'quantity_requested', p_quantity);
    END IF;
    
    v_stock_after := v_stock_before - p_quantity;
    
    INSERT INTO stock_movements (id, variant_id, movement_type, quantity, stock_before, stock_after, reference_type, reference_number, notes, created_by, created_at)
    VALUES (gen_random_uuid(), v_variant_id, 'SAIDA', -p_quantity, v_stock_before, v_stock_after, p_movement_type, p_document_number,
            COALESCE(p_notes, format('Saída de %s unidades - Tipo: %s', p_quantity, p_movement_type)), p_user_id, NOW())
    RETURNING id INTO v_movement_id;
    
    UPDATE product_variants SET stock_quantity = v_stock_after, updated_at = NOW() WHERE id = v_variant_id;
    
    RETURN json_build_object('success', true, 'movement_id', v_movement_id, 'variant_id', v_variant_id, 'sku', p_variant_sku,
                             'quantity_removed', p_quantity, 'stock_before', v_stock_before, 'stock_after', v_stock_after, 'movement_type', p_movement_type);
EXCEPTION WHEN OTHERS THEN
    RETURN json_build_object('success', false, 'error', SQLERRM);
END;
$function$
;

-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.reset_user_step_up_state(_user_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT public.is_supervisor_or_above(auth.uid()) THEN RAISE EXCEPTION 'Permission denied'; END IF;
  DELETE FROM public.step_up_challenges WHERE user_id = _user_id AND consumed = false;
  DELETE FROM public.step_up_tokens WHERE user_id = _user_id AND consumed = false;
END $function$
;

-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.restore_collection_item_from_trash(_item_id uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
DECLARE v_row record;
BEGIN
  SELECT * INTO v_row FROM public.collection_items_trash WHERE id = _item_id AND user_id = auth.uid();
  IF NOT FOUND THEN RETURN false; END IF;
  INSERT INTO public.collection_items (id, collection_id, user_id, product_id, color_name, color_hex, thumbnail_url, notes, price_at_save, sort_order)
  VALUES (COALESCE(v_row.original_id, gen_random_uuid()), v_row.collection_id, v_row.user_id, v_row.product_id, v_row.color_name, v_row.color_hex, v_row.thumbnail_url, v_row.notes, v_row.price_at_save, v_row.sort_order);
  DELETE FROM public.collection_items_trash WHERE id = _item_id;
  RETURN true;
EXCEPTION WHEN OTHERS THEN RETURN false;
END $function$
;

-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.restore_favorite_item_from_trash(_item_id uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
DECLARE v_row record;
BEGIN
  SELECT * INTO v_row FROM public.favorite_items_trash WHERE id = _item_id AND user_id = auth.uid();
  IF NOT FOUND THEN RETURN false; END IF;
  INSERT INTO public.favorite_items (id, list_id, user_id, product_id, variant_id, variant_info, note, price_at_save)
  VALUES (v_row.id, v_row.list_id, v_row.user_id, v_row.product_id, v_row.variant_id, v_row.variant_info, v_row.note, v_row.price_at_save);
  DELETE FROM public.favorite_items_trash WHERE id = _item_id;
  RETURN true;
EXCEPTION WHEN OTHERS THEN RETURN false;
END $function$
;

-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.restore_product(p_product_id uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
BEGIN
    UPDATE products 
    SET is_deleted = false, deleted_at = NULL, is_active = true, updated_at = NOW()
    WHERE id = p_product_id;
    RETURN FOUND;
END;
$function$
;

-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.revoke_mcp_full_from_user(_target_user_id uuid)
 RETURNS integer
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
DECLARE v_deleted int;
BEGIN
  IF NOT public.is_admin(auth.uid()) THEN RAISE EXCEPTION 'Permission denied'; END IF;
  DELETE FROM public.mcp_full_grantors WHERE user_id = _target_user_id;
  GET DIAGNOSTICS v_deleted = ROW_COUNT;
  RETURN v_deleted;
END $function$
;

-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.revoke_user_step_up(_user_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT public.is_supervisor_or_above(auth.uid()) THEN RAISE EXCEPTION 'Permission denied'; END IF;
  UPDATE public.step_up_tokens SET consumed = true, consumed_at = now() WHERE user_id = _user_id AND consumed = false;
END $function$
;

-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.rotate_mcp_key(_key_id uuid, _new_key_hash text, _new_key_prefix text)
 RETURNS uuid
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
DECLARE v_old record; v_new_id uuid;
BEGIN
  SELECT * INTO v_old FROM public.mcp_api_keys 
  WHERE id = _key_id AND (created_by = auth.uid() OR public.is_admin(auth.uid()));
  IF NOT FOUND THEN RAISE EXCEPTION 'Key not found or access denied'; END IF;
  INSERT INTO public.mcp_api_keys (name, key_hash, key_prefix, scopes, description, created_by, expires_at, rotated_from)
  VALUES (v_old.name || ' (rotated)', _new_key_hash, _new_key_prefix, v_old.scopes, v_old.description, auth.uid(), v_old.expires_at, _key_id)
  RETURNING id INTO v_new_id;
  UPDATE public.mcp_api_keys SET revoked_at = now() WHERE id = _key_id;
  RETURN v_new_id;
END $function$
;

-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.soft_delete_product(p_product_id uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
BEGIN
    UPDATE products 
    SET is_deleted = true, deleted_at = NOW(), is_active = false, updated_at = NOW()
    WHERE id = p_product_id;
    RETURN FOUND;
END;
$function$
;

-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.soft_delete_quote(_quote_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
BEGIN
  UPDATE public.quotes SET status = 'cancelled', updated_at = now()
  WHERE id = _quote_id AND (seller_id = auth.uid() OR public.is_admin_or_above(auth.uid()));
END $function$
;

-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.step_up_challenge_verify(_challenge_id uuid, _otp text)
 RETURNS boolean
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
DECLARE v_valid boolean;
BEGIN
  UPDATE public.step_up_challenges
  SET attempts = attempts + 1, otp_verified = (otp_hash = crypt(_otp, otp_hash))
  WHERE id = _challenge_id AND user_id = auth.uid() AND expires_at > now() AND consumed = false
  RETURNING otp_verified INTO v_valid;
  RETURN COALESCE(v_valid, false);
END $function$
;

-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.step_up_token_create(_challenge_id uuid)
 RETURNS text
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
DECLARE v_token text; v_hash text; v_challenge record;
BEGIN
  SELECT * INTO v_challenge FROM public.step_up_challenges
  WHERE id = _challenge_id AND user_id = auth.uid() AND otp_verified = true AND consumed = false;
  IF NOT FOUND THEN RAISE EXCEPTION 'Challenge not verified'; END IF;
  v_token := encode(gen_random_bytes(32), 'hex');
  v_hash := encode(digest(v_token, 'sha256'), 'hex');
  INSERT INTO public.step_up_tokens (user_id, action, target_ref, token_hash, challenge_id)
  VALUES (auth.uid(), v_challenge.action, v_challenge.target_ref, v_hash, _challenge_id);
  UPDATE public.step_up_challenges SET consumed = true WHERE id = _challenge_id;
  RETURN v_token;
END $function$
;

-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.step_up_token_revoke(_token_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
BEGIN
  UPDATE public.step_up_tokens SET consumed = true, consumed_at = now()
  WHERE id = _token_id AND user_id = auth.uid();
END $function$
;

-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.step_up_user_settings_set(_settings jsonb, _user_id uuid DEFAULT NULL::uuid)
 RETURNS void
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
DECLARE v_target uuid := COALESCE(_user_id, auth.uid());
BEGIN
  IF v_target <> auth.uid() AND NOT public.is_supervisor_or_above(auth.uid()) THEN
    RAISE EXCEPTION 'Permission denied';
  END IF;
  INSERT INTO public.system_settings (key, value, updated_by)
  VALUES ('step_up_settings_' || v_target::text, _settings, auth.uid())
  ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now(), updated_by = auth.uid();
END $function$
;

-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.store_user_token_revocation(_user_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT (public.is_supervisor_or_above(auth.uid()) OR auth.uid() = _user_id) THEN
    RAISE EXCEPTION 'Permission denied';
  END IF;
  INSERT INTO public.user_token_revocations(user_id) VALUES (_user_id)
  ON CONFLICT (user_id) DO UPDATE SET revoked_at = EXCLUDED.revoked_at;
END $function$
;

-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.toggle_user_step_up(_user_id uuid, _enabled boolean)
 RETURNS void
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT public.is_supervisor_or_above(auth.uid()) THEN RAISE EXCEPTION 'Permission denied'; END IF;
  PERFORM public.step_up_user_settings_set(jsonb_build_object('enabled', _enabled), _user_id);
END $function$
;

-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.unblock_ip(_ip text)
 RETURNS integer
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
DECLARE v_deleted int;
BEGIN
  IF NOT public.is_supervisor_or_above(auth.uid()) THEN RAISE EXCEPTION 'Permission denied'; END IF;
  DELETE FROM public.ip_access_control WHERE ip_address = _ip::inet AND list_type = 'blocklist';
  GET DIAGNOSTICS v_deleted = ROW_COUNT;
  RETURN v_deleted;
END $function$
;

-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.voice_command_audit()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$ BEGIN RETURN NEW; END; $function$
;

-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.build_full_scope_grants_v()
 RETURNS void
 LANGUAGE sql
 SET search_path TO 'public'
AS $function$ SELECT 1; $function$
;

-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.can_grant_mcp_full_to_user(_target_user_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE
 SET search_path TO 'public'
AS $function$ SELECT public.is_admin(auth.uid()) AND auth.uid() <> _target_user_id; $function$
;

-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.check_geo_country_allowed(_country_code text)
 RETURNS boolean
 LANGUAGE sql
 STABLE
 SET search_path TO 'public'
AS $function$ SELECT EXISTS(SELECT 1 FROM public.geo_allowed_countries WHERE country_code = upper(_country_code)); $function$
;

-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.check_owner_email(_user_id uuid)
 RETURNS text
 LANGUAGE sql
 STABLE
 SET search_path TO 'public'
AS $function$ SELECT email FROM auth.users WHERE id = _user_id; $function$
;

-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.clear_auth_attempts(_email text)
 RETURNS void
 LANGUAGE sql
 SET search_path TO 'public'
AS $function$
    DELETE FROM public.auth_login_attempts WHERE email = _email;
$function$
;

-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.compare_quote_snapshots(_quote_id uuid, _version_a integer, _version_b integer)
 RETURNS jsonb
 LANGUAGE sql
 STABLE
 SET search_path TO 'public'
AS $function$
  WITH va AS (SELECT snapshot FROM public.quote_versions WHERE quote_id = _quote_id AND version_number = _version_a),
       vb AS (SELECT snapshot FROM public.quote_versions WHERE quote_id = _quote_id AND version_number = _version_b)
  SELECT jsonb_build_object('a', (SELECT snapshot FROM va), 'b', (SELECT snapshot FROM vb));
$function$
;

-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.compare_quote_versions(_quote_id uuid, _version_a integer, _version_b integer)
 RETURNS jsonb
 LANGUAGE sql
 STABLE
 SET search_path TO 'public'
AS $function$ SELECT public.compare_quote_snapshots(_quote_id, _version_a, _version_b); $function$
;

-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.expert_chat_get_conversation(_conv_id uuid)
 RETURNS jsonb
 LANGUAGE sql
 SET search_path TO 'public'
AS $function$
  SELECT to_jsonb(c) FROM public.expert_conversations c
  WHERE id = _conv_id AND seller_id = auth.uid();
$function$
;

-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.expert_chat_get_messages(_conv_id uuid, _limit integer DEFAULT 100)
 RETURNS jsonb
 LANGUAGE sql
 SET search_path TO 'public'
AS $function$
  SELECT jsonb_agg(to_jsonb(m) ORDER BY m.created_at) FROM public.expert_messages m
  WHERE conversation_id = _conv_id
    AND EXISTS (SELECT 1 FROM public.expert_conversations WHERE id = _conv_id AND seller_id = auth.uid())
  LIMIT _limit;
$function$
;

-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.fn_is_admin_user(p_user_id uuid DEFAULT NULL::uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE
 SET search_path TO 'public'
AS $function$
  SELECT public.is_admin_or_above(COALESCE(p_user_id, auth.uid()));
$function$
;

-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_active_step_up_tokens()
 RETURNS jsonb
 LANGUAGE sql
 STABLE
 SET search_path TO 'public'
AS $function$
  SELECT COALESCE(jsonb_agg(jsonb_build_object('id', id, 'action', action, 'expires_at', expires_at)), '[]'::jsonb)
  FROM public.step_up_tokens
  WHERE user_id = auth.uid() AND consumed = false AND expires_at > now();
$function$
;

-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_all_material_groups_safe()
 RETURNS TABLE(id uuid, organization_id uuid, name text, slug text, description text, sort_order integer, is_active boolean)
 LANGUAGE sql
 STABLE
 SET search_path TO 'public'
AS $function$
    SELECT 
        id, 
        organization_id, 
        name::TEXT, 
        slug::TEXT, 
        description::TEXT, 
        sort_order, 
        is_active
    FROM material_groups
    WHERE is_active = true
    ORDER BY sort_order, name;
$function$
;

-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_all_material_types_safe()
 RETURNS TABLE(id uuid, organization_id uuid, group_id uuid, name text, slug text, description text, properties jsonb, display_order integer, is_active boolean)
 LANGUAGE sql
 STABLE
 SET search_path TO 'public'
AS $function$
    SELECT 
        id, 
        organization_id, 
        group_id, 
        name::TEXT, 
        slug::TEXT, 
        description::TEXT, 
        properties, 
        display_order, 
        is_active
    FROM material_types
    WHERE is_active = true
    ORDER BY name;
$function$
;

-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_category_descendants(p_category_id uuid)
 RETURNS uuid[]
 LANGUAGE sql
 STABLE
 SET search_path TO 'public'
AS $function$
  WITH RECURSIVE descendants AS (
    SELECT id, parent_id
    FROM categories
    WHERE id = p_category_id
      AND is_active = true
    
    UNION ALL
    
    SELECT c.id, c.parent_id
    FROM categories c
    INNER JOIN descendants d ON c.parent_id = d.id
    WHERE c.is_active = true
  )
  SELECT COALESCE(ARRAY_AGG(id), ARRAY[]::UUID[]) 
  FROM descendants;
$function$
;

-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_commemorative_dates_by_product(p_product_id uuid)
 RETURNS TABLE(id uuid, name text, slug text, date_day integer, date_month integer, category text, icon_name text, color_hex text, variant_id uuid, variant_name text, variant_color text, is_product_wide boolean, is_featured boolean, custom_description text)
 LANGUAGE sql
 STABLE
 SET search_path TO 'public'
AS $function$
    SELECT 
        cd.id,
        cd.name,
        cd.slug,
        cd.date_day,
        cd.date_month,
        cd.category,
        cd.icon_name,
        cd.color_hex,
        pv.id AS variant_id,
        pv.name AS variant_name,
        pv.color_name AS variant_color,
        (vcd.variant_id IS NULL) AS is_product_wide,
        vcd.is_featured,
        vcd.custom_description
    FROM variant_commemorative_dates vcd
    JOIN commemorative_dates cd ON cd.id = vcd.commemorative_date_id
    LEFT JOIN product_variants pv ON pv.id = vcd.variant_id
    WHERE vcd.product_id = p_product_id
       OR pv.product_id = p_product_id
    ORDER BY cd.date_month, cd.date_day;
$function$
;

-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_commemorative_dates_by_variant(p_variant_id uuid)
 RETURNS TABLE(id uuid, name text, slug text, date_day integer, date_month integer, category text, icon_name text, color_hex text, is_featured boolean, custom_description text)
 LANGUAGE sql
 STABLE
 SET search_path TO 'public'
AS $function$
    SELECT 
        cd.id,
        cd.name,
        cd.slug,
        cd.date_day,
        cd.date_month,
        cd.category,
        cd.icon_name,
        cd.color_hex,
        vcd.is_featured,
        vcd.custom_description
    FROM variant_commemorative_dates vcd
    JOIN commemorative_dates cd ON cd.id = vcd.commemorative_date_id
    JOIN product_variants pv ON pv.id = p_variant_id
    WHERE vcd.variant_id = p_variant_id
       OR (vcd.product_id = pv.product_id AND vcd.variant_id IS NULL)
    ORDER BY cd.date_month, cd.date_day;
$function$
;

-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_full_scope_grants()
 RETURNS jsonb
 LANGUAGE sql
 STABLE
 SET search_path TO 'public'
AS $function$ SELECT COALESCE(jsonb_agg(to_jsonb(g)), '[]'::jsonb) FROM public.mcp_full_grantors g WHERE public.is_admin(auth.uid()); $function$
;

-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_login_attempts_status(_email text DEFAULT NULL::text, _ip text DEFAULT NULL::text, _window_minutes integer DEFAULT 15)
 RETURNS jsonb
 LANGUAGE sql
 STABLE
 SET search_path TO 'public'
AS $function$
  SELECT jsonb_build_object(
    'total', count(*),
    'success', count(*) FILTER (WHERE success = true),
    'failed', count(*) FILTER (WHERE success = false),
    'last_attempt', max(created_at)
  ) FROM public.login_attempts
  WHERE created_at > now() - (_window_minutes || ' minutes')::interval
    AND (_email IS NULL OR email = _email)
    AND (_ip IS NULL OR ip_address = _ip);
$function$
;

-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_material_types_by_group_id(p_group_id uuid)
 RETURNS TABLE(id uuid, organization_id uuid, group_id uuid, name text, slug text, description text, properties jsonb, display_order integer, is_active boolean)
 LANGUAGE sql
 STABLE
 SET search_path TO 'public'
AS $function$
    SELECT 
        id, 
        organization_id, 
        group_id, 
        name::TEXT, 
        slug::TEXT, 
        description::TEXT, 
        properties, 
        display_order, 
        is_active
    FROM material_types
    WHERE group_id = p_group_id
      AND is_active = true
    ORDER BY display_order, name;
$function$
;

-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_material_types_by_group_slug(p_group_slug text)
 RETURNS TABLE(id uuid, organization_id uuid, group_id uuid, name text, slug text, description text, properties jsonb, display_order integer, is_active boolean)
 LANGUAGE sql
 STABLE
 SET search_path TO 'public'
AS $function$
    SELECT 
        mt.id, 
        mt.organization_id, 
        mt.group_id, 
        mt.name::TEXT, 
        mt.slug::TEXT, 
        mt.description::TEXT, 
        mt.properties, 
        mt.display_order, 
        mt.is_active
    FROM material_types mt
    JOIN material_groups mg ON mg.id = mt.group_id
    WHERE mg.slug = p_group_slug
      AND mt.is_active = true
      AND mg.is_active = true
    ORDER BY mt.display_order, mt.name;
$function$
;

-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_materials_complete_safe()
 RETURNS TABLE(material_id uuid, material_name text, material_slug text, material_description text, group_id uuid, group_name text, group_slug text, display_order integer, is_active boolean)
 LANGUAGE sql
 STABLE
 SET search_path TO 'public'
AS $function$
    SELECT 
        mt.id AS material_id,
        mt.name::TEXT AS material_name,
        mt.slug::TEXT AS material_slug,
        mt.description::TEXT AS material_description,
        mg.id AS group_id,
        mg.name::TEXT AS group_name,
        mg.slug::TEXT AS group_slug,
        mt.display_order,
        mt.is_active
    FROM material_types mt
    JOIN material_groups mg ON mg.id = mt.group_id
    WHERE mt.is_active = true
      AND mg.is_active = true
    ORDER BY mg.sort_order, mg.name, mt.display_order, mt.name;
$function$
;

-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_mcp_key_status(_key_id uuid)
 RETURNS jsonb
 LANGUAGE sql
 STABLE
 SET search_path TO 'public'
AS $function$
  SELECT jsonb_build_object(
    'id', id, 'name', name, 'key_prefix', key_prefix,
    'scopes', scopes, 'is_revoked', revoked_at IS NOT NULL,
    'is_expired', expires_at IS NOT NULL AND expires_at < now(),
    'last_used_at', last_used_at
  ) FROM public.mcp_api_keys
  WHERE id = _key_id AND (created_by = auth.uid() OR public.is_admin(auth.uid()));
$function$
;

-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_my_grantor_status()
 RETURNS jsonb
 LANGUAGE sql
 STABLE
 SET search_path TO 'public'
AS $function$
  SELECT jsonb_build_object(
    'has_grant', EXISTS(SELECT 1 FROM public.mcp_full_grantors WHERE user_id = auth.uid()),
    'can_grant', public.is_admin(auth.uid()),
    'granted_count', (SELECT count(*) FROM public.mcp_full_grantors WHERE granted_by = auth.uid())
  );
$function$
;

-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_step_up_audit(_user_id uuid DEFAULT NULL::uuid, _limit integer DEFAULT 100)
 RETURNS jsonb
 LANGUAGE sql
 STABLE
 SET search_path TO 'public'
AS $function$
  SELECT COALESCE(jsonb_agg(to_jsonb(a) ORDER BY a.created_at DESC), '[]'::jsonb) FROM (
    SELECT * FROM public.step_up_audit_log
    WHERE (_user_id IS NULL OR user_id = _user_id)
      AND (auth.uid() = COALESCE(_user_id, auth.uid()) OR public.is_supervisor_or_above(auth.uid()))
    ORDER BY created_at DESC LIMIT _limit
  ) a;
$function$
;

-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_step_up_user_settings(_user_id uuid DEFAULT NULL::uuid)
 RETURNS jsonb
 LANGUAGE sql
 STABLE
 SET search_path TO 'public'
AS $function$ SELECT public.step_up_user_settings_get(_user_id); $function$
;

-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_user_role_history(_user_id uuid)
 RETURNS jsonb
 LANGUAGE sql
 STABLE
 SET search_path TO 'public'
AS $function$
  SELECT COALESCE(jsonb_agg(to_jsonb(a) ORDER BY a.created_at DESC), '[]'::jsonb)
  FROM public.admin_audit_log a
  WHERE resource_type = 'user_role' AND resource_id = _user_id::text;
$function$
;

-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_variants_by_commemorative_date(p_commemorative_date_slug text, p_limit integer DEFAULT 100)
 RETURNS TABLE(product_id uuid, product_name text, product_sku text, variant_id uuid, variant_name text, variant_sku text, color_name text, color_hex text, is_product_wide boolean, is_featured boolean, custom_description text, display_order integer)
 LANGUAGE sql
 STABLE
 SET search_path TO 'public'
AS $function$
    SELECT 
        p.id AS product_id,
        p.name AS product_name,
        p.sku AS product_sku,
        pv.id AS variant_id,
        pv.name AS variant_name,
        pv.sku AS variant_sku,
        pv.color_name,
        pv.color_hex,
        (vcd.variant_id IS NULL) AS is_product_wide,
        vcd.is_featured,
        vcd.custom_description,
        vcd.display_order
    FROM variant_commemorative_dates vcd
    JOIN commemorative_dates cd ON cd.id = vcd.commemorative_date_id
    LEFT JOIN products p ON p.id = vcd.product_id
    LEFT JOIN product_variants pv ON pv.id = vcd.variant_id OR pv.product_id = vcd.product_id
    WHERE cd.slug = p_commemorative_date_slug
      AND (p.is_active = TRUE OR pv.is_active = TRUE)
    ORDER BY vcd.is_featured DESC, vcd.display_order, p.name, pv.color_name
    LIMIT p_limit;
$function$
;

-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_variants_for_commemorative_date(p_slug text, p_limit integer DEFAULT 100, p_include_all_colors boolean DEFAULT false)
 RETURNS TABLE(product_id uuid, product_name text, product_sku text, variant_id uuid, variant_name text, variant_sku text, color_name text, color_hex text, color_group_id uuid, color_group_name text, is_primary_color boolean, price_1 numeric, image_url text)
 LANGUAGE sql
 STABLE
 SET search_path TO 'public'
AS $function$
    WITH date_colors AS (
        SELECT cdc.color_group_id, cdc.is_primary
        FROM commemorative_date_colors cdc
        JOIN commemorative_dates cd ON cd.id = cdc.commemorative_date_id
        WHERE cd.slug = p_slug AND cd.is_active = TRUE
    ),
    exclusions AS (
        SELECT cde.product_id, cde.variant_id
        FROM commemorative_date_exclusions cde
        JOIN commemorative_dates cd ON cd.id = cde.commemorative_date_id
        WHERE cd.slug = p_slug
    ),
    variants_data AS (
        SELECT 
            p.id AS product_id,
            p.name AS product_name,
            p.sku AS product_sku,
            pv.id AS variant_id,
            pv.name AS variant_name,
            pv.sku AS variant_sku,
            pv.color_name,
            pv.color_hex,
            cg.id AS color_group_id,
            cg.name AS color_group_name,
            COALESCE(dc.is_primary, FALSE) AS is_primary_color,
            pv.price_1,
            COALESCE((pv.images->>0)::TEXT, p.primary_image_url) AS image_url
        FROM product_variants pv
        JOIN products p ON p.id = pv.product_id
        LEFT JOIN color_variations cv ON LOWER(cv.name) = LOWER(pv.color_name)
        LEFT JOIN color_groups cg ON cg.id = cv.group_id
        LEFT JOIN date_colors dc ON dc.color_group_id = cg.id
        WHERE pv.is_active = TRUE
          AND p.is_active = TRUE
          AND (p_include_all_colors OR dc.color_group_id IS NOT NULL)
          AND NOT EXISTS (
              SELECT 1 FROM exclusions ex
              WHERE ex.product_id = p.id OR ex.variant_id = pv.id
          )
    )
    SELECT DISTINCT ON (vd.variant_id)
        vd.product_id,
        vd.product_name,
        vd.product_sku,
        vd.variant_id,
        vd.variant_name,
        vd.variant_sku,
        vd.color_name,
        vd.color_hex,
        vd.color_group_id,
        vd.color_group_name,
        vd.is_primary_color,
        vd.price_1,
        vd.image_url
    FROM variants_data vd
    ORDER BY vd.variant_id, vd.is_primary_color DESC
    LIMIT p_limit;
$function$
;

-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_voice_command_stats(_user_id uuid DEFAULT NULL::uuid, _days integer DEFAULT 30)
 RETURNS jsonb
 LANGUAGE sql
 SET search_path TO 'public'
AS $function$
  SELECT jsonb_build_object(
    'total', count(*),
    'success', count(*) FILTER (WHERE success = true),
    'failed', count(*) FILTER (WHERE success = false)
  ) FROM public.voice_command_logs
  WHERE created_at > now() - (_days || ' days')::interval
    AND (_user_id IS NULL OR user_id = _user_id)
    AND (_user_id IS NOT NULL OR user_id = auth.uid() OR public.is_admin(auth.uid()));
$function$
;

-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.has_active_step_up_challenge(_action step_up_action DEFAULT NULL::step_up_action)
 RETURNS boolean
 LANGUAGE sql
 STABLE
 SET search_path TO 'public'
AS $function$
  SELECT EXISTS(SELECT 1 FROM public.step_up_challenges
    WHERE user_id = auth.uid() AND consumed = false AND expires_at > now()
      AND (_action IS NULL OR action = _action));
$function$
;

-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.has_permission(_user_id uuid, _code text)
 RETURNS boolean
 LANGUAGE sql
 STABLE
 SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1 
    FROM public.user_roles ur
    JOIN public.role_permissions rp ON rp.role = ur.role
    WHERE ur.user_id = _user_id
      AND rp.permission_code = _code
  );
$function$
;

-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.is_order_owner(p_order_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE
 SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.orders o
    WHERE o.id = p_order_id AND o.created_by = (SELECT auth.uid())
  );
$function$
;

-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.magic_up_get_brand_kit(_kit_id uuid)
 RETURNS jsonb
 LANGUAGE sql
 SET search_path TO 'public'
AS $function$
  SELECT to_jsonb(k) FROM public.magic_up_brand_kits k
  WHERE id = _kit_id AND user_id = auth.uid();
$function$
;

-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.magic_up_get_campaign(_campaign_id uuid)
 RETURNS jsonb
 LANGUAGE sql
 SET search_path TO 'public'
AS $function$
  SELECT to_jsonb(c) FROM public.magic_up_campaigns c
  WHERE id = _campaign_id AND user_id = auth.uid();
$function$
;

-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.magic_up_get_dashboard()
 RETURNS jsonb
 LANGUAGE sql
 SET search_path TO 'public'
AS $function$
  SELECT jsonb_build_object(
    'brand_kits', (SELECT count(*) FROM public.magic_up_brand_kits WHERE user_id = auth.uid()),
    'campaigns', (SELECT count(*) FROM public.magic_up_campaigns WHERE user_id = auth.uid()),
    'generations', (SELECT count(*) FROM public.magic_up_generations WHERE user_id = auth.uid()),
    'reactions', (SELECT count(*) FROM public.magic_up_reactions WHERE user_id = auth.uid())
  );
$function$
;

-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.mcp_record_access_violation(_key_id uuid, _reason text, _details jsonb DEFAULT '{}'::jsonb)
 RETURNS uuid
 LANGUAGE sql
 SET search_path TO 'public'
AS $function$ SELECT public.mcp_audit_violation(_key_id, _reason, _details); $function$
;

-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.next_in_step_up_queue()
 RETURNS jsonb
 LANGUAGE sql
 STABLE
 SET search_path TO 'public'
AS $function$ SELECT '{}'::jsonb; $function$
;

-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.ownership_audit(_triggered_by text DEFAULT 'manual'::text)
 RETURNS uuid
 LANGUAGE sql
 SET search_path TO 'public'
AS $function$ SELECT public.audit_ownership_orphans(_triggered_by); $function$
;

-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.process_step_up_queue()
 RETURNS integer
 LANGUAGE sql
 SET search_path TO 'public'
AS $function$ SELECT 0; $function$
;

-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.purge_expired_step_up_artifacts()
 RETURNS integer
 LANGUAGE sql
 SET search_path TO 'public'
AS $function$ SELECT public.cleanup_orphan_step_up_artifacts() + public.cleanup_expired_step_up_tokens(); $function$
;

-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.purge_old_login_attempts()
 RETURNS integer
 LANGUAGE sql
 SET search_path TO 'public'
AS $function$ SELECT public.cleanup_old_login_attempts(); $function$
;

-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.purge_old_rate_limits()
 RETURNS integer
 LANGUAGE sql
 SET search_path TO 'public'
AS $function$ SELECT public.clean_old_rate_limits(); $function$
;

-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.record_auth_attempt(_email text, _ip text, _success boolean, _reason text DEFAULT NULL::text, _ua text DEFAULT NULL::text)
 RETURNS void
 LANGUAGE sql
 SET search_path TO 'public'
AS $function$
    INSERT INTO public.auth_login_attempts (email, ip_address, success, failure_reason, user_agent)
    VALUES (_email, _ip, _success, _reason, _ua);
$function$
;

-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.refresh_full_scope_grants_view()
 RETURNS void
 LANGUAGE sql
 SET search_path TO 'public'
AS $function$ SELECT 1; $function$
;

-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.rls_matrix_export()
 RETURNS jsonb
 LANGUAGE sql
 STABLE
 SET search_path TO 'public'
AS $function$ SELECT public.audit_rls_matrix(); $function$
;

-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.save_step_up_audit(_event_type text, _action step_up_action DEFAULT NULL::step_up_action, _metadata jsonb DEFAULT '{}'::jsonb)
 RETURNS uuid
 LANGUAGE sql
 SET search_path TO 'public'
AS $function$ SELECT public.log_step_up_audit(_event_type, _action, _metadata); $function$
;

-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.step_up_challenge_create(_action step_up_action, _target_ref text DEFAULT NULL::text)
 RETURNS uuid
 LANGUAGE sql
 SET search_path TO 'public'
AS $function$ SELECT public.generate_step_up_challenge(_action, _target_ref); $function$
;

-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.step_up_user_settings_get(_user_id uuid DEFAULT NULL::uuid)
 RETURNS jsonb
 LANGUAGE sql
 STABLE
 SET search_path TO 'public'
AS $function$
  SELECT COALESCE(value, '{}'::jsonb) FROM public.system_settings
  WHERE key = 'step_up_settings_' || COALESCE(_user_id, auth.uid())::text
  LIMIT 1;
$function$
;

-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.track_voice_command(_transcript text)
 RETURNS uuid
 LANGUAGE sql
 SET search_path TO 'public'
AS $function$ SELECT public.log_voice_command(_transcript); $function$
;

-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.update_step_up_user_settings(_settings jsonb, _user_id uuid DEFAULT NULL::uuid)
 RETURNS void
 LANGUAGE sql
 SET search_path TO 'public'
AS $function$ SELECT public.step_up_user_settings_set(_settings, _user_id); $function$
;

-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.user_belongs_to_org(org_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE
 SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1 
    FROM public.user_organizations uo
    WHERE uo.user_id = auth.uid()
    AND uo.organization_id = org_id
  );
$function$
;

-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.user_can_skip_step_up(_user_id uuid DEFAULT NULL::uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE
 SET search_path TO 'public'
AS $function$
  SELECT COALESCE(
    (SELECT (value->>'skip_enabled')::boolean FROM public.system_settings
      WHERE key = 'step_up_settings_' || COALESCE(_user_id, auth.uid())::text), 
    false);
$function$
;

-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.verify_user_step_up_required(_action step_up_action, _user_id uuid DEFAULT NULL::uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE
 SET search_path TO 'public'
AS $function$ SELECT NOT public.user_can_skip_step_up(_user_id); $function$
;

