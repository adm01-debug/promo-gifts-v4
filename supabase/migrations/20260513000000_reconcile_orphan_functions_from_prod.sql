-- ============================================================================
-- Reconcile functions from production (drift fix for clean migration replay)
-- ============================================================================
-- The t37a/t37b1/t37b2 hardening batches (20260513000001+) run
-- ALTER FUNCTION ... SECURITY INVOKER on 218 functions. On a fresh replay
-- (Supabase Preview branch / `supabase start`) several of those targets do not
-- exist yet, because they were created out-of-band in production, or created in
-- the repo under a different overload/signature, or created only by a later
-- migration. Later migrations also create POLICIES/TRIGGERS that call some of
-- these functions (e.g. can_view_all_sales()), so the functions must actually
-- exist, not merely be skipped.
--
-- This migration recreates every overload of those target functions verbatim
-- from production, just before the first ALTER. check_function_bodies is
-- disabled so SQL-language functions with forward references (other functions
-- or tables created in later migrations) load without create-time validation,
-- exactly as pg_dump does. The subsequent SECURITY INVOKER ALTERs then become
-- idempotent no-ops.
-- ============================================================================

SET check_function_bodies = false;

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

CREATE OR REPLACE FUNCTION public.can_approve_discount(_user_id uuid DEFAULT auth.uid())
 RETURNS boolean
 LANGUAGE sql
 STABLE
 SET search_path TO 'public'
AS $function$ SELECT public.can_manage_quotes(_user_id) $function$
;

CREATE OR REPLACE FUNCTION public.can_manage_connections(_user_id uuid DEFAULT auth.uid())
 RETURNS boolean
 LANGUAGE sql
 STABLE
 SET search_path TO 'public'
AS $function$ SELECT public.is_supervisor_or_above(_user_id); $function$
;

CREATE OR REPLACE FUNCTION public.can_view_all_sales()
 RETURNS boolean
 LANGUAGE sql
 STABLE
 SET search_path TO 'public'
AS $function$
  SELECT auth.uid() IS NULL
    OR public.has_role(auth.uid(), 'admin'::app_role)
    OR public.has_role(auth.uid(), 'manager'::app_role)
    OR public.has_role(auth.uid(), 'supervisor'::app_role)
    OR public.has_role(auth.uid(), 'dev'::app_role);
$function$
;

CREATE OR REPLACE FUNCTION public.can_view_audit_logs(_user_id uuid DEFAULT auth.uid())
 RETURNS boolean
 LANGUAGE sql
 STABLE
 SET search_path TO 'public'
AS $function$ SELECT public.is_dev(_user_id); $function$
;

CREATE OR REPLACE FUNCTION public.can_view_connections(_user_id uuid DEFAULT auth.uid())
 RETURNS boolean
 LANGUAGE sql
 STABLE
 SET search_path TO 'public'
AS $function$ SELECT public.is_supervisor_or_above(_user_id); $function$
;

CREATE OR REPLACE FUNCTION public.can_view_telemetry(_user_id uuid DEFAULT auth.uid())
 RETURNS boolean
 LANGUAGE sql
 STABLE
 SET search_path TO 'public'
AS $function$ SELECT public.is_supervisor_or_above(_user_id); $function$
;

CREATE OR REPLACE FUNCTION public.compare_quote_versions(_quote_id uuid, _version_a integer, _version_b integer)
 RETURNS jsonb
 LANGUAGE sql
 STABLE
 SET search_path TO 'public'
AS $function$ SELECT public.compare_quote_snapshots(_quote_id, _version_a, _version_b); $function$
;

CREATE OR REPLACE FUNCTION public.enforce_user_id_owner()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  -- Enforça que user_id corresponda ao auth.uid() em inserts/updates
  IF NEW.user_id IS NULL THEN
    NEW.user_id := auth.uid();
  ELSIF NEW.user_id != auth.uid() AND NOT public.is_admin_or_above(auth.uid()) THEN
    RAISE EXCEPTION 'user_id deve corresponder ao usuário autenticado';
  END IF;
  RETURN NEW;
END;
$function$
;

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

CREATE OR REPLACE FUNCTION public.fn_is_admin_user(p_user_id uuid DEFAULT NULL::uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE
 SET search_path TO 'public'
AS $function$
  SELECT public.is_admin_or_above(COALESCE(p_user_id, auth.uid()));
$function$
;

CREATE OR REPLACE FUNCTION public.get_step_up_user_settings(_user_id uuid DEFAULT NULL::uuid)
 RETURNS jsonb
 LANGUAGE sql
 STABLE
 SET search_path TO 'public'
AS $function$ SELECT public.step_up_user_settings_get(_user_id); $function$
;

CREATE OR REPLACE FUNCTION public.is_admin()
 RETURNS boolean
 LANGUAGE sql
 STABLE
 SET search_path TO 'public'
AS $function$
  SELECT public.is_supervisor_or_above(auth.uid());
$function$
;

CREATE OR REPLACE FUNCTION public.is_admin(_user_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE
 SET search_path TO 'public'
AS $function$
  SELECT public.is_supervisor_or_above(_user_id);
$function$
;

CREATE OR REPLACE FUNCTION public.is_admin_strict(_user_id uuid DEFAULT auth.uid())
 RETURNS boolean
 LANGUAGE sql
 STABLE
 SET search_path TO 'public'
AS $function$
  SELECT public.is_dev(_user_id);
$function$
;

CREATE OR REPLACE FUNCTION public.is_manager_or_admin()
 RETURNS boolean
 LANGUAGE sql
 STABLE
 SET search_path TO 'public', 'pg_temp'
AS $function$
  SELECT public.is_admin_or_above(auth.uid());
$function$
;

CREATE OR REPLACE FUNCTION public.is_seller_only(_user_id uuid DEFAULT auth.uid())
 RETURNS boolean
 LANGUAGE sql
 STABLE
 SET search_path TO 'public'
AS $function$
  SELECT public.has_role(_user_id,'vendedor'::public.app_role)
     AND NOT public.can_manage_quotes(_user_id)
     AND NOT public.is_admin_strict(_user_id)
$function$
;

CREATE OR REPLACE FUNCTION public.limit_recently_viewed_products()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$ BEGIN RETURN NEW; END; $function$
;

CREATE OR REPLACE FUNCTION public.mcp_audit_actor(_fallback uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 STABLE
 SET search_path TO 'public'
AS $function$
DECLARE
  jwt_sub text;
  header_actor text;
BEGIN
  BEGIN
    header_actor := current_setting('request.mcp_actor', true);
  EXCEPTION WHEN OTHERS THEN
    header_actor := NULL;
  END;
  IF header_actor IS NOT NULL AND header_actor <> '' THEN
    RETURN header_actor::uuid;
  END IF;

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
$function$
;

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

CREATE OR REPLACE FUNCTION public.ownership_audit(_triggered_by text DEFAULT 'manual'::text)
 RETURNS uuid
 LANGUAGE sql
 SET search_path TO 'public'
AS $function$ SELECT public.audit_ownership_orphans(_triggered_by); $function$
;

CREATE OR REPLACE FUNCTION public.purge_old_login_attempts()
 RETURNS integer
 LANGUAGE sql
 SET search_path TO 'public'
AS $function$ SELECT public.cleanup_old_login_attempts(); $function$
;

CREATE OR REPLACE FUNCTION public.rls_matrix_export()
 RETURNS jsonb
 LANGUAGE sql
 STABLE
 SET search_path TO 'public'
AS $function$ SELECT public.audit_rls_matrix(); $function$
;

CREATE OR REPLACE FUNCTION public.save_step_up_audit(_event_type text, _action step_up_action DEFAULT NULL::step_up_action, _metadata jsonb DEFAULT '{}'::jsonb)
 RETURNS uuid
 LANGUAGE sql
 SET search_path TO 'public'
AS $function$ SELECT public.log_step_up_audit(_event_type, _action, _metadata); $function$
;

CREATE OR REPLACE FUNCTION public.step_up_challenge_create(_action step_up_action, _target_ref text DEFAULT NULL::text)
 RETURNS uuid
 LANGUAGE sql
 SET search_path TO 'public'
AS $function$ SELECT public.generate_step_up_challenge(_action, _target_ref); $function$
;

CREATE OR REPLACE FUNCTION public.track_voice_command(_transcript text)
 RETURNS uuid
 LANGUAGE sql
 SET search_path TO 'public'
AS $function$ SELECT public.log_voice_command(_transcript); $function$
;

CREATE OR REPLACE FUNCTION public.trg_sync_external_connections()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
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
$function$
;

CREATE OR REPLACE FUNCTION public.update_step_up_user_settings(_settings jsonb, _user_id uuid DEFAULT NULL::uuid)
 RETURNS void
 LANGUAGE sql
 SET search_path TO 'public'
AS $function$ SELECT public.step_up_user_settings_set(_settings, _user_id); $function$
;

CREATE OR REPLACE FUNCTION public.validate_scheduled_report_email()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.email_to !~ '^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$' THEN
    RAISE EXCEPTION 'Email inválido: %', NEW.email_to;
  END IF;
  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.validate_status_fields()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
BEGIN
  IF TG_TABLE_NAME = 'quotes' THEN
    -- NOTA Fase B (12/05/2026): valores 'approved'/'rejected'/'pending_approval'/'viewed'
    -- são mantidos por compatibilidade histórica até decisão Fase C
    -- (novo ciclo de vida do orçamento sem rotas públicas).
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
  -- ❌ REMOVIDOS (Fase B Decision 011): branches de kit_share_tokens e quote_approval_tokens
  --    Tables foram dropadas — rotas públicas com token não existem mais no modelo.
  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.verify_user_step_up_required(_action step_up_action, _user_id uuid DEFAULT NULL::uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE
 SET search_path TO 'public'
AS $function$ SELECT NOT public.user_can_skip_step_up(_user_id); $function$
;

CREATE OR REPLACE FUNCTION public.voice_command_audit()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$ BEGIN RETURN NEW; END; $function$
;

CREATE OR REPLACE FUNCTION public.fn_log_step_up_event()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$ BEGIN RETURN NEW; END; $function$
;

CREATE OR REPLACE FUNCTION public.next_in_step_up_queue()
 RETURNS jsonb
 LANGUAGE sql
 STABLE
 SET search_path TO 'public'
AS $function$ SELECT '{}'::jsonb; $function$
;

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

CREATE OR REPLACE FUNCTION public.mark_step_up_password_verified(_challenge_id uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
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
$function$
;

CREATE OR REPLACE FUNCTION public.fn_audit_role_changes()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$ BEGIN RETURN COALESCE(NEW, OLD); END; $function$
;

CREATE OR REPLACE FUNCTION public.repair_ownership_orphans(_report_id uuid DEFAULT NULL::uuid, _dry_run boolean DEFAULT true, _triggered_by_label text DEFAULT 'manual_admin'::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
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
  v_safe_delete text[] := ARRAY[
    'workspace_notifications', 'rls_denial_log',
    'mcp_audit_log', 'mcp_keys_audit_log',
    'role_migration_audit', 'login_attempts'
  ];
  v_has_active boolean;
  v_has_is_active boolean;
  v_has_status boolean;
BEGIN
  IF v_caller IS NULL OR NOT (
    has_role(v_caller, 'admin'::app_role) OR has_role(v_caller, 'dev'::app_role)
  ) THEN
    RAISE EXCEPTION 'repair_ownership_orphans: acesso negado';
  END IF;

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

  FOR v_detail IN SELECT * FROM jsonb_array_elements(v_report.details)
  LOOP
    v_table := v_detail->>'table';
    v_col := v_detail->>'owner_column';
    v_null_count := COALESCE((v_detail->>'null_owner_count')::bigint, 0);
    v_orphan_count := COALESCE((v_detail->>'missing_user_count')::bigint, 0);

    SELECT EXISTS(SELECT 1 FROM information_schema.columns
      WHERE table_schema='public' AND table_name=v_table AND column_name='active')
      INTO v_has_active;
    SELECT EXISTS(SELECT 1 FROM information_schema.columns
      WHERE table_schema='public' AND table_name=v_table AND column_name='is_active')
      INTO v_has_is_active;
    SELECT EXISTS(SELECT 1 FROM information_schema.columns
      WHERE table_schema='public' AND table_name=v_table AND column_name='status')
      INTO v_has_status;

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
$function$
;

CREATE OR REPLACE FUNCTION public.magic_up_get_campaign(_campaign_id uuid)
 RETURNS jsonb
 LANGUAGE sql
 SET search_path TO 'public'
AS $function$
  SELECT to_jsonb(c) FROM public.magic_up_campaigns c
  WHERE id = _campaign_id AND user_id = auth.uid();
$function$
;

CREATE OR REPLACE FUNCTION public.check_ip_access(_ip text)
 RETURNS text
 LANGUAGE plpgsql
 STABLE
 SET search_path TO 'public'
AS $function$
DECLARE
  _type TEXT;
BEGIN
  SELECT list_type INTO _type
  FROM public.ip_access_control
  WHERE ip_address = _ip
    AND (expires_at IS NULL OR expires_at > now())
  LIMIT 1;
  
  RETURN _type;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.clear_auth_attempts(_email text)
 RETURNS void
 LANGUAGE sql
 SET search_path TO 'public'
AS $function$
    DELETE FROM public.auth_login_attempts WHERE email = _email;
$function$
;

CREATE OR REPLACE FUNCTION public.lookup_request_id(_request_id text)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE
 SET search_path TO 'public'
AS $function$
DECLARE v_webhook_events jsonb;
BEGIN
  IF NOT (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'dev'::app_role)) THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;
  IF _request_id IS NULL OR length(_request_id) < 8 OR length(_request_id) > 128 THEN
    RAISE EXCEPTION 'invalid_request_id' USING ERRCODE = '22023';
  END IF;
  SELECT COALESCE(jsonb_agg(row_to_json(r) ORDER BY (r->>'occurred_at')), '[]'::jsonb) INTO v_webhook_events FROM (
    SELECT occurred_at, source, direction, event_type, endpoint, http_status, duration_ms,
           attempt, success, error_class, error_message, payload_bytes
    FROM public.webhook_delivery_metrics WHERE request_id = _request_id
    ORDER BY occurred_at ASC LIMIT 200
  ) r;
  RETURN jsonb_build_object('request_id', _request_id, 'webhook_events', v_webhook_events,
                            'event_count', jsonb_array_length(v_webhook_events));
END; $function$
;

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

CREATE OR REPLACE FUNCTION public.check_hardening_status()
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE
 SET search_path TO 'public'
AS $function$
DECLARE
  _is_admin boolean; _private_buckets int; _sensitive_realtime int;
  _pg_trgm_in_extensions boolean; _cleanup_job_active boolean;
BEGIN
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin')
    INTO _is_admin;
  IF NOT _is_admin THEN RAISE EXCEPTION 'Admin only'; END IF;
  SELECT count(*) INTO _private_buckets FROM storage.buckets
    WHERE id IN ('personalization-images','product-videos','supplier-logos','component-media')
      AND public = false;
  SELECT count(*) INTO _sensitive_realtime FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public'
      AND tablename IN ('discount_approval_requests','kit_variants','kit_comments');
  SELECT EXISTS (SELECT 1 FROM pg_extension e JOIN pg_namespace n ON n.oid = e.extnamespace
    WHERE e.extname = 'pg_trgm' AND n.nspname = 'extensions') INTO _pg_trgm_in_extensions;
  SELECT EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'cleanup-security-logs-daily' AND active = true)
    INTO _cleanup_job_active;
  RETURN jsonb_build_object(
    'private_buckets_count', _private_buckets, 'private_buckets_ok', _private_buckets = 4,
    'sensitive_realtime_count', _sensitive_realtime, 'realtime_isolation_ok', _sensitive_realtime = 0,
    'pg_trgm_in_extensions', _pg_trgm_in_extensions, 'cleanup_job_active', _cleanup_job_active,
    'mfa_enforced_in_app', true, 'checked_at', now()
  );
END;
$function$
;

CREATE OR REPLACE FUNCTION public.consume_step_up_token(_token text, _expected_action step_up_action, _expected_target text DEFAULT NULL::text)
 RETURNS boolean
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
DECLARE
  _uid UUID := auth.uid();
  _token_h TEXT;
  _row RECORD;
BEGIN
  IF _uid IS NULL THEN RETURN false; END IF;
  IF _token IS NULL OR length(_token) < 32 THEN RETURN false; END IF;

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
$function$
;

CREATE OR REPLACE FUNCTION public.ensure_default_favorite_list(_user_id uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
DECLARE
  v_list_id uuid;
BEGIN
  -- Se já existe default, retorna
  SELECT id INTO v_list_id 
  FROM public.favorite_lists 
  WHERE user_id = _user_id AND is_default = true 
  LIMIT 1;
  
  IF v_list_id IS NOT NULL THEN
    RETURN v_list_id;
  END IF;
  
  -- Cria lista default
  INSERT INTO public.favorite_lists (
    user_id, name, description, color, icon, is_default, position
  ) VALUES (
    _user_id, 'Meus Favoritos', 'Lista padrão de favoritos', '#3B82F6', 'Heart', true, 0
  ) RETURNING id INTO v_list_id;
  
  RETURN v_list_id;
END $function$
;

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

CREATE OR REPLACE FUNCTION public.get_active_novelties(p_supplier_code character varying DEFAULT NULL::character varying, p_limit integer DEFAULT 50, p_offset integer DEFAULT 0, p_only_highlighted boolean DEFAULT false)
 RETURNS TABLE(novelty_id uuid, product_id uuid, product_name text, product_sku text, supplier_code character varying, supplier_product_code character varying, detected_at timestamp with time zone, expires_at timestamp with time zone, days_remaining integer, is_highlighted boolean)
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
BEGIN
    RETURN QUERY
    SELECT 
        n.id AS novelty_id,
        n.product_id,
        p.name AS product_name,
        p.sku AS product_sku,
        n.supplier_code,
        n.supplier_product_code,
        n.detected_at,
        n.expires_at,
        EXTRACT(DAY FROM (n.expires_at - NOW()))::INTEGER AS days_remaining,
        n.is_highlighted
    FROM public.product_novelties n
    JOIN public.products p ON n.product_id = p.id
    WHERE n.is_active = true
      AND n.expires_at > NOW()
      AND (p_supplier_code IS NULL OR n.supplier_code = p_supplier_code)
      AND (p_only_highlighted = false OR n.is_highlighted = true)
    ORDER BY n.detected_at DESC
    LIMIT p_limit
    OFFSET p_offset;
END;
$function$
;

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

CREATE OR REPLACE FUNCTION public.get_app_health_summary(_minutes integer DEFAULT 60)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE
 SET search_path TO 'public'
AS $function$
DECLARE
  v_since timestamptz := now() - make_interval(mins => GREATEST(1, LEAST(_minutes, 1440)));
  v_kpis jsonb; v_routes jsonb; v_webhooks jsonb; v_edges jsonb; v_vitals jsonb;
BEGIN
  IF NOT (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'dev'::app_role)) THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;
  SELECT jsonb_build_object(
    'total', COUNT(*), 'req_per_min', ROUND((COUNT(*)::numeric / GREATEST(1, _minutes))::numeric, 2),
    'pct_4xx', CASE WHEN COUNT(*) = 0 THEN 0 ELSE ROUND((COUNT(*) FILTER (WHERE http_status BETWEEN 400 AND 499))::numeric * 100.0 / COUNT(*), 2) END,
    'pct_5xx', CASE WHEN COUNT(*) = 0 THEN 0 ELSE ROUND((COUNT(*) FILTER (WHERE http_status >= 500))::numeric * 100.0 / COUNT(*), 2) END,
    'p95_ms', COALESCE(percentile_disc(0.95) WITHIN GROUP (ORDER BY duration_ms), 0),
    'p99_ms', COALESCE(percentile_disc(0.99) WITHIN GROUP (ORDER BY duration_ms), 0),
    'window_minutes', _minutes, 'since', v_since
  ) INTO v_kpis FROM public.webhook_delivery_metrics WHERE occurred_at >= v_since;
  SELECT COALESCE(jsonb_agg(row_to_json(r)), '[]'::jsonb) INTO v_routes FROM (
    SELECT endpoint, direction, COUNT(*) AS total,
      COUNT(*) FILTER (WHERE http_status BETWEEN 400 AND 499) AS count_4xx,
      COUNT(*) FILTER (WHERE http_status >= 500) AS count_5xx,
      ROUND((COUNT(*) FILTER (WHERE http_status >= 400))::numeric * 100.0 / NULLIF(COUNT(*),0), 2) AS error_rate_pct,
      MAX(occurred_at) FILTER (WHERE http_status >= 400) AS last_error_at
    FROM public.webhook_delivery_metrics
    WHERE occurred_at >= v_since AND endpoint IS NOT NULL
    GROUP BY endpoint, direction HAVING COUNT(*) FILTER (WHERE http_status >= 400) > 0
    ORDER BY (COUNT(*) FILTER (WHERE http_status >= 400)) DESC LIMIT 20
  ) r;
  SELECT COALESCE(jsonb_agg(row_to_json(r)), '[]'::jsonb) INTO v_webhooks FROM (
    SELECT source, direction, COUNT(*) AS total, COUNT(*) FILTER (WHERE NOT success) AS failures,
      ROUND((COUNT(*) FILTER (WHERE NOT success))::numeric * 100.0 / NULLIF(COUNT(*),0), 2) AS failure_rate_pct,
      COALESCE(percentile_disc(0.95) WITHIN GROUP (ORDER BY duration_ms), 0) AS p95_ms,
      MAX(occurred_at) FILTER (WHERE NOT success) AS last_failure_at
    FROM public.webhook_delivery_metrics WHERE occurred_at >= v_since
    GROUP BY source, direction ORDER BY failures DESC, total DESC LIMIT 30
  ) r;
  SELECT COALESCE(jsonb_agg(row_to_json(r)), '[]'::jsonb) INTO v_edges FROM (
    SELECT source AS edge_function, COUNT(*) AS total,
      COALESCE(percentile_disc(0.50) WITHIN GROUP (ORDER BY duration_ms), 0) AS p50_ms,
      COALESCE(percentile_disc(0.95) WITHIN GROUP (ORDER BY duration_ms), 0) AS p95_ms,
      COALESCE(percentile_disc(0.99) WITHIN GROUP (ORDER BY duration_ms), 0) AS p99_ms,
      ROUND(AVG(duration_ms)::numeric, 0) AS avg_ms, MAX(duration_ms) AS max_ms
    FROM public.webhook_delivery_metrics WHERE occurred_at >= v_since
    GROUP BY source ORDER BY p95_ms DESC NULLS LAST LIMIT 30
  ) r;
  SELECT COALESCE(jsonb_agg(row_to_json(r)), '[]'::jsonb) INTO v_vitals FROM (
    SELECT metric_name AS name, COUNT(*) AS total,
      COALESCE(percentile_disc(0.75) WITHIN GROUP (ORDER BY metric_value), 0) AS p75,
      COUNT(*) FILTER (WHERE rating = 'good') AS count_good,
      COUNT(*) FILTER (WHERE rating = 'needs-improvement') AS count_needs_improvement,
      COUNT(*) FILTER (WHERE rating = 'poor') AS count_poor,
      ROUND((COUNT(*) FILTER (WHERE rating = 'good'))::numeric * 100.0 / NULLIF(COUNT(*), 0), 1) AS good_pct
    FROM public.app_vitals WHERE created_at >= v_since GROUP BY metric_name ORDER BY metric_name ASC
  ) r;
  RETURN jsonb_build_object('kpis', v_kpis, 'top_routes_by_error', v_routes,
                            'webhooks_by_source', v_webhooks, 'edges_by_latency', v_edges, 'web_vitals', v_vitals);
END; $function$
;

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

CREATE OR REPLACE FUNCTION public.get_client_seasonality(_client_id uuid, _months integer DEFAULT 24)
 RETURNS TABLE(year integer, month integer, quotes_count bigint, total_revenue numeric, avg_ticket numeric)
 LANGUAGE sql
 STABLE
 SET search_path TO 'public'
AS $function$
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
    AND (q.seller_id = auth.uid()
      OR has_role(auth.uid(), 'admin'::app_role)
      OR has_role(auth.uid(), 'manager'::app_role))
  GROUP BY 1, 2 ORDER BY 1, 2;
$function$
;

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

CREATE OR REPLACE FUNCTION public.get_collections_weekly_count(_weeks integer DEFAULT 8)
 RETURNS TABLE(week_start date, item_count bigint)
 LANGUAGE sql
 STABLE
 SET search_path TO 'public'
AS $function$
  WITH weeks AS (
    SELECT generate_series(
      date_trunc('week', now())::date - (GREATEST(_weeks, 1) - 1) * 7,
      date_trunc('week', now())::date,
      '7 days'::interval
    )::date AS week_start
  )
  SELECT w.week_start, COALESCE(COUNT(ci.id), 0)::bigint AS item_count
  FROM weeks w
  LEFT JOIN public.collection_items ci
    ON date_trunc('week', ci.created_at)::date = w.week_start
    AND EXISTS (SELECT 1 FROM public.collections c WHERE c.id = ci.collection_id AND c.user_id = auth.uid())
  GROUP BY w.week_start
  ORDER BY w.week_start ASC;
$function$
;

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

CREATE OR REPLACE FUNCTION public.get_connection_failure_window_minutes()
 RETURNS integer
 LANGUAGE sql
 STABLE
 SET search_path TO 'public'
AS $function$
  SELECT COALESCE(
    (SELECT (value)::text::int FROM public.system_settings WHERE key = 'connection_failure_window_minutes'),
    30
  );
$function$
;

CREATE OR REPLACE FUNCTION public.get_favorites_weekly_count(_weeks integer DEFAULT 8)
 RETURNS TABLE(week_start date, item_count bigint)
 LANGUAGE sql
 STABLE
 SET search_path TO 'public'
AS $function$
  WITH weeks AS (
    SELECT generate_series(
      date_trunc('week', now())::date - (GREATEST(_weeks, 1) - 1) * 7,
      date_trunc('week', now())::date,
      '7 days'::interval
    )::date AS week_start
  )
  SELECT w.week_start, COALESCE(COUNT(fi.id), 0)::bigint AS item_count
  FROM weeks w
  LEFT JOIN public.favorite_items fi
    ON fi.user_id = auth.uid() AND date_trunc('week', fi.added_at)::date = w.week_start
  GROUP BY w.week_start
  ORDER BY w.week_start ASC;
$function$
;

CREATE OR REPLACE FUNCTION public.get_industry_benchmark_stats(_company_ids uuid[], _days integer DEFAULT 180)
 RETURNS TABLE(total_clients_sampled integer, avg_ltv numeric, avg_ticket numeric, avg_quotes_per_client numeric, avg_items_per_quote numeric, top_product_name text, total_revenue numeric)
 LANGUAGE plpgsql
 STABLE
 SET search_path TO 'public'
AS $function$
DECLARE
  v_top_product_name text;
BEGIN
  -- Top produto pré-calculado (subquery isolada)
  SELECT qi.product_name INTO v_top_product_name
  FROM public.quote_items qi
  JOIN public.quotes q ON q.id = qi.quote_id
  WHERE q.client_id = ANY(_company_ids)
    AND q.status IS DISTINCT FROM 'cancelled'
    AND q.created_at >= now() - make_interval(days => _days)
  GROUP BY qi.product_name
  ORDER BY SUM(qi.quantity) DESC
  LIMIT 1;

  RETURN QUERY
  WITH quote_stats AS (
    SELECT 
      q.client_id,
      COUNT(*)::integer            AS quotes_count,
      COALESCE(AVG(q.total), 0)    AS avg_total,
      COALESCE(SUM(q.total), 0)    AS client_revenue
    FROM public.quotes q
    WHERE q.client_id = ANY(_company_ids)
      AND q.status IS DISTINCT FROM 'cancelled'
      AND q.status IS DISTINCT FROM 'draft'
      AND q.created_at >= now() - make_interval(days => _days)
    GROUP BY q.client_id
  ),
  items_stats AS (
    SELECT 
      q.client_id,
      AVG(item_count.cnt) AS avg_items
    FROM public.quotes q
    JOIN LATERAL (
      SELECT COUNT(*)::numeric AS cnt 
      FROM public.quote_items qi 
      WHERE qi.quote_id = q.id
    ) item_count ON true
    WHERE q.client_id = ANY(_company_ids)
      AND q.created_at >= now() - make_interval(days => _days)
    GROUP BY q.client_id
  )
  SELECT 
    COUNT(DISTINCT qs.client_id)::integer       AS total_clients_sampled,
    COALESCE(AVG(qs.client_revenue), 0)::numeric AS avg_ltv,
    COALESCE(AVG(qs.avg_total), 0)::numeric      AS avg_ticket,
    COALESCE(AVG(qs.quotes_count), 0)::numeric   AS avg_quotes_per_client,
    COALESCE(AVG(its.avg_items), 0)::numeric     AS avg_items_per_quote,
    v_top_product_name                           AS top_product_name,
    COALESCE(SUM(qs.client_revenue), 0)::numeric AS total_revenue
  FROM quote_stats qs
  LEFT JOIN items_stats its ON its.client_id = qs.client_id;
END $function$
;

CREATE OR REPLACE FUNCTION public.get_industry_top_products(_company_ids uuid[], _days integer DEFAULT 90, _limit integer DEFAULT 10)
 RETURNS TABLE(product_id uuid, product_name text, product_image_url text, total_quantity bigint, unique_clients bigint, unique_sellers bigint, total_revenue numeric, avg_unit_price numeric)
 LANGUAGE sql
 STABLE
 SET search_path TO 'public'
AS $function$
  SELECT 
    oi.product_id,
    oi.product_name,
    oi.product_image_url,
    SUM(oi.quantity)::bigint                                AS total_quantity,
    COUNT(DISTINCT o.client_id)::bigint                     AS unique_clients,
    COUNT(DISTINCT o.seller_id)::bigint                     AS unique_sellers,
    COALESCE(SUM(oi.quantity * oi.unit_price), 0)::numeric  AS total_revenue,
    COALESCE(AVG(oi.unit_price), 0)::numeric                AS avg_unit_price
  FROM public.orders o
  JOIN public.order_items oi ON oi.order_id = o.id
  WHERE o.client_id = ANY(_company_ids)
    AND o.status IS DISTINCT FROM 'cancelled'
    AND o.status IS DISTINCT FROM 'draft'
    AND o.created_at >= now() - make_interval(days => _days)
  GROUP BY oi.product_id, oi.product_name, oi.product_image_url
  ORDER BY SUM(oi.quantity) DESC
  LIMIT _limit
$function$
;

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

CREATE OR REPLACE FUNCTION public.get_novelties_stats()
 RETURNS TABLE(total_novelties bigint, active_novelties bigint, highlighted_novelties bigint, expiring_soon bigint)
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
BEGIN
    RETURN QUERY
    SELECT 
        COUNT(*)::BIGINT AS total_novelties,
        COUNT(*) FILTER (WHERE expires_at > NOW() AND is_active = true)::BIGINT AS active_novelties,
        COUNT(*) FILTER (WHERE is_highlighted = true AND expires_at > NOW() AND is_active = true)::BIGINT AS highlighted_novelties,
        COUNT(*) FILTER (WHERE expires_at BETWEEN NOW() AND NOW() + INTERVAL '7 days' AND is_active = true)::BIGINT AS expiring_soon
    FROM public.product_novelties;
END;
$function$
;

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

CREATE OR REPLACE FUNCTION public.get_platform_failure_metrics(window_minutes integer DEFAULT 60)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE
 SET search_path TO 'public'
AS $function$
DECLARE
  window_start timestamptz := now() - make_interval(mins => COALESCE(window_minutes, 60));
  total_calls bigint; total_503 bigint; total_cold bigint; recent_cold_at timestamptz;
  prev_window_start timestamptz := now() - make_interval(mins => COALESCE(window_minutes, 60) * 2);
  prev_503 bigint;
BEGIN
  SELECT COUNT(*), COUNT(*) FILTER (WHERE is_503 = true),
         COUNT(*) FILTER (WHERE is_cold_start = true),
         MAX(created_at) FILTER (WHERE is_cold_start = true)
    INTO total_calls, total_503, total_cold, recent_cold_at
  FROM public.query_telemetry WHERE created_at >= window_start;
  SELECT COUNT(*) FILTER (WHERE is_503 = true) INTO prev_503
  FROM public.query_telemetry WHERE created_at >= prev_window_start AND created_at < window_start;
  RETURN jsonb_build_object(
    'window_minutes', window_minutes, 'total_calls', COALESCE(total_calls, 0),
    'total_503', COALESCE(total_503, 0), 'total_cold_starts', COALESCE(total_cold, 0),
    'rate_503_pct', CASE WHEN COALESCE(total_calls, 0) = 0 THEN 0 ELSE ROUND(total_503::numeric / total_calls::numeric * 100, 2) END,
    'rate_cold_start_pct', CASE WHEN COALESCE(total_calls, 0) = 0 THEN 0 ELSE ROUND(total_cold::numeric / total_calls::numeric * 100, 2) END,
    'last_cold_start_at', recent_cold_at, 'prev_window_503', COALESCE(prev_503, 0),
    'delta_503', COALESCE(total_503, 0) - COALESCE(prev_503, 0));
END; $function$
;

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

CREATE OR REPLACE FUNCTION public.get_user_recent_comparisons(p_limit integer DEFAULT 5)
 RETURNS TABLE(id uuid, name text, client_name text, items jsonb, item_count integer, updated_at timestamp with time zone)
 LANGUAGE sql
 STABLE
 SET search_path TO 'public'
AS $function$
  SELECT uc.id, uc.name, uc.client_name, uc.items, jsonb_array_length(uc.items) AS item_count, uc.updated_at
  FROM public.user_comparisons uc
  WHERE uc.user_id = auth.uid()
  ORDER BY uc.updated_at DESC
  LIMIT p_limit;
$function$
;

CREATE OR REPLACE FUNCTION public.log_rls_denial(p_table_name text, p_operation text, p_endpoint text DEFAULT NULL::text, p_query_summary text DEFAULT NULL::text, p_target_id uuid DEFAULT NULL::uuid, p_target_seller_id uuid DEFAULT NULL::uuid, p_policy_hint text DEFAULT NULL::text, p_error_code text DEFAULT NULL::text, p_error_message text DEFAULT NULL::text, p_user_agent text DEFAULT NULL::text)
 RETURNS uuid
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
DECLARE v_uid UUID := auth.uid(); v_email TEXT; v_role TEXT; v_id UUID;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'unauthenticated'; END IF;
  IF p_operation NOT IN ('SELECT','INSERT','UPDATE','DELETE') THEN
    RAISE EXCEPTION 'invalid_operation';
  END IF;
  SELECT email, role INTO v_email, v_role
  FROM public.profiles WHERE user_id = v_uid LIMIT 1;
  INSERT INTO public.rls_denial_log (
    user_id, user_email, user_role, table_name, operation,
    endpoint, query_summary, target_id, target_seller_id,
    policy_hint, error_code, error_message, user_agent
  ) VALUES (
    v_uid, v_email, v_role, p_table_name, p_operation,
    p_endpoint, p_query_summary, p_target_id, p_target_seller_id,
    p_policy_hint, p_error_code, p_error_message, p_user_agent
  ) RETURNING id INTO v_id;
  RETURN v_id;
END;
$function$
;

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

CREATE OR REPLACE FUNCTION public.log_full_scope_grant(_operation text, _key_id uuid, _key_prefix text, _challenge_id uuid DEFAULT NULL::uuid, _token_id uuid DEFAULT NULL::uuid, _justification text DEFAULT NULL::text, _confirmation_phrase_ok boolean DEFAULT NULL::boolean, _expires_at timestamp with time zone DEFAULT NULL::timestamp with time zone, _ip inet DEFAULT NULL::inet, _user_agent text DEFAULT NULL::text, _request_id text DEFAULT NULL::text, _extra jsonb DEFAULT '{}'::jsonb)
 RETURNS uuid
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
DECLARE
  _uid UUID := auth.uid();
  _action public.step_up_action;
  _id UUID;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'unauthorized'; END IF;

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
      'operation', _operation, 'key_id', _key_id, 'key_prefix', _key_prefix,
      'expires_at', _expires_at, 'justification', _justification,
      'verifications', jsonb_build_object(
        'is_dev_recheck', true,
        'step_up_token_consumed', _token_id IS NOT NULL,
        'can_grant_mcp_full', true,
        'confirmation_phrase_ok', COALESCE(_confirmation_phrase_ok, true),
        'has_justification', _justification IS NOT NULL AND length(_justification) > 0
      ),
      'request_id', _request_id, 'granted_at', now(), 'extra', _extra
    )
  )
  RETURNING id INTO _id;

  RETURN _id;
END;
$function$
;

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

CREATE OR REPLACE FUNCTION public.revoke_all_user_tokens(_user_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO public.user_token_revocations (user_id, revoked_at)
  VALUES (_user_id, now())
  ON CONFLICT (user_id) DO UPDATE SET revoked_at = now();
END;
$function$
;

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

CREATE OR REPLACE FUNCTION public.search_products_semantic(_query text, _products jsonb, _limit integer DEFAULT 20)
 RETURNS TABLE(product_id text, score real, matched_field text)
 LANGUAGE plpgsql
 STABLE
 SET search_path TO 'public'
AS $function$
DECLARE
  _normalized_query text;
BEGIN
  IF _query IS NULL OR length(trim(_query)) = 0 THEN RETURN; END IF;
  IF _products IS NULL OR jsonb_typeof(_products) <> 'array' THEN RETURN; END IF;
  _normalized_query := lower(trim(_query));
  RETURN QUERY
  WITH expanded AS (
    SELECT
      COALESCE(p->>'id', p->>'product_id', '') AS pid,
      lower(COALESCE(p->>'name', '')) AS pname,
      lower(COALESCE(p->>'description', '')) AS pdesc,
      lower(COALESCE(
        (SELECT string_agg(t::text, ' ') FROM jsonb_array_elements_text(COALESCE(p->'tags', '[]'::jsonb)) t), ''
      )) AS ptags,
      lower(COALESCE(p->>'category', '')) AS pcat
    FROM jsonb_array_elements(_products) AS p
  ),
  scored AS (
    SELECT pid,
      GREATEST(
        similarity(pname, _normalized_query) * 1.0,
        similarity(pdesc, _normalized_query) * 0.6,
        similarity(ptags, _normalized_query) * 0.8,
        similarity(pcat, _normalized_query) * 0.5
      ) AS best_score,
      CASE
        WHEN similarity(pname, _normalized_query) >= similarity(pdesc, _normalized_query)
         AND similarity(pname, _normalized_query) >= similarity(ptags, _normalized_query)
         AND similarity(pname, _normalized_query) >= similarity(pcat, _normalized_query) THEN 'name'
        WHEN similarity(ptags, _normalized_query) >= similarity(pdesc, _normalized_query)
         AND similarity(ptags, _normalized_query) >= similarity(pcat, _normalized_query) THEN 'tags'
        WHEN similarity(pdesc, _normalized_query) >= similarity(pcat, _normalized_query) THEN 'description'
        ELSE 'category'
      END AS field
    FROM expanded WHERE pid <> ''
  )
  SELECT pid, best_score::real, field FROM scored
  WHERE best_score > 0.05
  ORDER BY best_score DESC
  LIMIT GREATEST(_limit, 1);
END;
$function$
;

CREATE OR REPLACE FUNCTION public.search_records_rerank(_query text, _candidates jsonb)
 RETURNS TABLE(id text, score real, matched_field text)
 LANGUAGE plpgsql
 STABLE
 SET search_path TO 'public'
AS $function$
DECLARE
  _q text;
BEGIN
  IF _query IS NULL OR length(trim(_query)) = 0 THEN RETURN; END IF;
  IF _candidates IS NULL OR jsonb_typeof(_candidates) <> 'array' THEN RETURN; END IF;
  _q := lower(trim(_query));
  RETURN QUERY
  WITH expanded AS (
    SELECT COALESCE(c->>'id', '') AS cid,
      lower(COALESCE(c->>'label', '')) AS clabel,
      lower(COALESCE(c->>'sublabel', '')) AS csublabel
    FROM jsonb_array_elements(_candidates) AS c
  ),
  scored AS (
    SELECT cid,
      GREATEST(
        similarity(clabel, _q) * 1.0,
        word_similarity(_q, clabel) * 0.9,
        similarity(csublabel, _q) * 0.7,
        word_similarity(_q, csublabel) * 0.6
      ) AS best_score,
      CASE WHEN similarity(clabel, _q) >= similarity(csublabel, _q) THEN 'label' ELSE 'sublabel' END AS field
    FROM expanded WHERE cid <> ''
  )
  SELECT cid, best_score::real, field FROM scored
  WHERE best_score > 0.05
  ORDER BY best_score DESC;
END;
$function$
;

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

CREATE OR REPLACE FUNCTION public.validate_discount_approval_status()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.status NOT IN ('pending', 'approved', 'rejected') THEN
    RAISE EXCEPTION 'Invalid discount approval status: %', NEW.status;
  END IF;
  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.user_is_org_member(org_id uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  RETURN EXISTS (
    SELECT 1 
    FROM public.user_organizations
    WHERE organization_id = org_id
      AND user_id = auth.uid()
  );
END;
$function$
;

CREATE OR REPLACE FUNCTION public.verify_step_up_otp(_challenge_id uuid, _otp text)
 RETURNS TABLE(token text, expires_at timestamp with time zone)
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
DECLARE
  _uid UUID := auth.uid();
  _row RECORD;
  _otp_h TEXT;
  _token TEXT;
  _token_h TEXT;
  _tid UUID;
  _exp TIMESTAMPTZ;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'unauthorized'; END IF;

  SELECT * INTO _row FROM public.step_up_challenges
  WHERE id = _challenge_id AND user_id = _uid AND consumed = false AND expires_at > now()
  FOR UPDATE;

  IF NOT FOUND THEN
    INSERT INTO public.step_up_audit_log(user_id, event_type, challenge_id, metadata)
    VALUES (_uid, 'failed', _challenge_id, '{"reason":"challenge_not_found_or_expired"}'::jsonb);
    RAISE EXCEPTION 'invalid_or_expired_challenge';
  END IF;

  IF NOT _row.password_verified THEN
    INSERT INTO public.step_up_audit_log(user_id, action, target_ref, event_type, challenge_id, metadata)
    VALUES (_uid, _row.action, _row.target_ref, 'failed', _challenge_id, '{"reason":"password_not_verified"}'::jsonb);
    RAISE EXCEPTION 'password_not_verified_first';
  END IF;

  IF _row.attempts >= _row.max_attempts THEN
    INSERT INTO public.step_up_audit_log(user_id, action, target_ref, event_type, challenge_id, metadata)
    VALUES (_uid, _row.action, _row.target_ref, 'failed', _challenge_id, '{"reason":"max_attempts"}'::jsonb);
    RAISE EXCEPTION 'max_attempts_exceeded';
  END IF;

  _otp_h := encode(digest(_otp || _uid::text, 'sha256'), 'hex');

  IF _otp_h <> _row.otp_hash THEN
    UPDATE public.step_up_challenges SET attempts = attempts + 1 WHERE id = _challenge_id;
    INSERT INTO public.step_up_audit_log(user_id, action, target_ref, event_type, challenge_id, metadata)
    VALUES (_uid, _row.action, _row.target_ref, 'failed', _challenge_id, jsonb_build_object('reason','wrong_otp','attempt', _row.attempts + 1));
    RAISE EXCEPTION 'invalid_otp';
  END IF;

  _token := encode(gen_random_bytes(32), 'hex');
  _token_h := encode(digest(_token, 'sha256'), 'hex');
  _exp := now() + interval '5 minutes';

  INSERT INTO public.step_up_tokens(user_id, action, target_ref, token_hash, challenge_id, expires_at)
  VALUES (_uid, _row.action, _row.target_ref, _token_h, _challenge_id, _exp)
  RETURNING id INTO _tid;

  UPDATE public.step_up_challenges
    SET otp_verified = true, consumed = true
    WHERE id = _challenge_id;

  INSERT INTO public.step_up_audit_log(user_id, action, target_ref, event_type, challenge_id, token_id)
  VALUES (_uid, _row.action, _row.target_ref, 'otp_verified', _challenge_id, _tid);
  INSERT INTO public.step_up_audit_log(user_id, action, target_ref, event_type, challenge_id, token_id)
  VALUES (_uid, _row.action, _row.target_ref, 'token_issued', _challenge_id, _tid);

  RETURN QUERY SELECT _token, _exp;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.is_kit_owner(_kit_id uuid, _user_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE
 SET search_path TO 'public'
AS $function$
  SELECT EXISTS (SELECT 1 FROM public.custom_kits WHERE id = _kit_id AND user_id = _user_id);
$function$
;

CREATE OR REPLACE FUNCTION public.record_mcp_access_violation(_user_id uuid, _reason text, _source text, _operation text DEFAULT NULL::text, _target_key_id uuid DEFAULT NULL::uuid, _ip text DEFAULT NULL::text, _user_agent text DEFAULT NULL::text, _request_id text DEFAULT NULL::text, _details jsonb DEFAULT '{}'::jsonb)
 RETURNS uuid
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
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
  RAISE WARNING 'record_mcp_access_violation failed: %', SQLERRM;
  RETURN NULL;
END;
$function$
;

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

CREATE OR REPLACE FUNCTION public.is_admin_or_above(_user_id uuid DEFAULT auth.uid())
 RETURNS boolean
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF _user_id IS DISTINCT FROM auth.uid()
     AND NOT public.has_role(auth.uid(), 'dev'::app_role) THEN
    RAISE EXCEPTION 'forbidden: cannot query role of another user'
      USING ERRCODE = '42501';
  END IF;
  RETURN public.is_supervisor_or_above(_user_id);
END;
$function$
;

CREATE OR REPLACE FUNCTION public.is_coord_or_above(_user_id uuid DEFAULT auth.uid())
 RETURNS boolean
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF _user_id IS DISTINCT FROM auth.uid()
     AND NOT public.has_role(auth.uid(), 'dev'::app_role) THEN
    RAISE EXCEPTION 'forbidden: cannot query role of another user'
      USING ERRCODE = '42501';
  END IF;
  RETURN public.is_supervisor_or_above(_user_id);
END;
$function$
;

CREATE OR REPLACE FUNCTION public.increment_kit_template_usage(_template_id uuid)
 RETURNS integer
 LANGUAGE sql
 SET search_path TO 'public'
AS $function$
  UPDATE public.kit_templates 
  SET usage_count = usage_count + 1
  WHERE id = _template_id AND is_active = true
  RETURNING usage_count;
$function$
;

CREATE OR REPLACE FUNCTION public.can_grant_mcp_full(_user_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE
 SET search_path TO 'public'
AS $function$ SELECT public.is_dev(_user_id); $function$
;

CREATE OR REPLACE FUNCTION public.enforce_seller_id_owner()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
BEGIN
  -- Força seller_id ao auth.uid() na inserção (impede impersonação)
  IF NEW.seller_id IS NULL OR NEW.seller_id <> auth.uid() THEN
    NEW.seller_id := auth.uid();
  END IF;
  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.purge_expired_step_up_artifacts()
 RETURNS integer
 LANGUAGE sql
 SET search_path TO 'public'
AS $function$ SELECT public.cleanup_orphan_step_up_artifacts() + public.cleanup_expired_step_up_tokens(); $function$
;

CREATE OR REPLACE FUNCTION public.fill_integration_credential_metadata()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
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
$function$
;

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

CREATE OR REPLACE FUNCTION public.fn_force_user_logout()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$ BEGIN RETURN NEW; END; $function$
;

CREATE OR REPLACE FUNCTION public.generate_secure_token()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
BEGIN
  NEW.token := encode(gen_random_bytes(32), 'hex');
  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.invalidate_used_approval_token()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.responded_at IS NOT NULL AND OLD.responded_at IS NULL THEN
    NEW.status := 'responded';
    NEW.expires_at := now();
  END IF;
  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.magic_up_audit_changes()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$ BEGIN RETURN NEW; END; $function$
;

CREATE OR REPLACE FUNCTION public.validate_ip_access_control()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.list_type NOT IN ('allow', 'block') THEN
    RAISE EXCEPTION 'Invalid list_type: must be allow or block';
  END IF;
  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.validate_secret_rotation_action_type()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.action_type NOT IN ('set', 'rotate') THEN
    RAISE EXCEPTION 'Invalid action_type: must be set or rotate';
  END IF;
  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.set_magic_up_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.process_step_up_queue()
 RETURNS integer
 LANGUAGE sql
 SET search_path TO 'public'
AS $function$ SELECT 0; $function$
;

CREATE OR REPLACE FUNCTION public.fn_validate_role_change()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$ BEGIN RETURN NEW; END; $function$
;

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

CREATE OR REPLACE FUNCTION public.get_top_collected_products(_days integer DEFAULT 7, _limit integer DEFAULT 6)
 RETURNS TABLE(product_id text, col_count bigint)
 LANGUAGE sql
 STABLE
 SET search_path TO 'public'
AS $function$
  SELECT ci.product_id, COUNT(*)::bigint AS col_count
  FROM public.collection_items ci
  WHERE ci.created_at >= (now() - make_interval(days => GREATEST(_days, 1)))
  GROUP BY ci.product_id
  ORDER BY col_count DESC, MAX(ci.created_at) DESC
  LIMIT GREATEST(_limit, 1);
$function$
;

CREATE OR REPLACE FUNCTION public.get_top_compared_products(p_limit integer DEFAULT 6)
 RETURNS TABLE(product_id text, comparison_count bigint)
 LANGUAGE sql
 STABLE
 SET search_path TO 'public'
AS $function$
  SELECT (item->>'productId')::text AS product_id, count(*)::bigint AS comparison_count
  FROM public.user_comparisons, jsonb_array_elements(items) AS item
  WHERE updated_at > now() - interval '30 days'
  GROUP BY (item->>'productId')
  ORDER BY comparison_count DESC
  LIMIT p_limit;
$function$
;

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

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
 RETURNS boolean
 LANGUAGE sql
 STABLE
 SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  );
$function$
;

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

CREATE OR REPLACE FUNCTION public.fn_log_login_attempt()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$ BEGIN RETURN NEW; END; $function$
;

CREATE OR REPLACE FUNCTION public.mcp_record_access_violation(_key_id uuid, _reason text, _details jsonb DEFAULT '{}'::jsonb)
 RETURNS uuid
 LANGUAGE sql
 SET search_path TO 'public'
AS $function$ SELECT public.mcp_audit_violation(_key_id, _reason, _details); $function$
;

CREATE OR REPLACE FUNCTION public.is_dev(_user_id uuid DEFAULT auth.uid())
 RETURNS boolean
 LANGUAGE sql
 STABLE
 SET search_path TO 'public'
AS $function$
  SELECT public.has_role(_user_id, 'dev'::public.app_role);
$function$
;

CREATE OR REPLACE FUNCTION public.enforce_created_by_owner()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
DECLARE v_uid uuid := auth.uid();
BEGIN
  IF v_uid IS NULL THEN RETURN NEW; END IF;
  IF NEW.created_by IS NULL THEN NEW.created_by := v_uid; RETURN NEW; END IF;
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
$function$
;

CREATE OR REPLACE FUNCTION public._can_act_on_behalf_of_others()
 RETURNS boolean
 LANGUAGE sql
 STABLE
 SET search_path TO 'public'
AS $function$
  SELECT auth.uid() IS NULL
    OR public.has_role(auth.uid(), 'admin'::app_role)
    OR public.has_role(auth.uid(), 'manager'::app_role)
    OR public.has_role(auth.uid(), 'supervisor'::app_role)
    OR public.has_role(auth.uid(), 'dev'::app_role);
$function$
;

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

CREATE OR REPLACE FUNCTION public.get_bundle_suggestions(_product_id uuid)
 RETURNS TABLE(product_id uuid, product_name text, product_image_url text, cooccurrence_count bigint, frequency_percent numeric)
 LANGUAGE sql
 STABLE
 SET search_path TO 'public'
AS $function$
  WITH anchor_quotes AS (
    SELECT DISTINCT quote_id FROM public.quote_items WHERE product_id = _product_id
  ),
  total AS (SELECT COUNT(*)::numeric AS n FROM anchor_quotes),
  cooc AS (
    SELECT qi.product_id, MAX(qi.product_name) AS product_name,
      MAX(qi.product_image_url) AS product_image_url,
      COUNT(DISTINCT qi.quote_id) AS cnt
    FROM public.quote_items qi
    JOIN anchor_quotes aq ON aq.quote_id = qi.quote_id
    WHERE qi.product_id IS NOT NULL AND qi.product_id <> _product_id
    GROUP BY qi.product_id
  )
  SELECT c.product_id, c.product_name, c.product_image_url, c.cnt AS cooccurrence_count,
    ROUND((c.cnt::numeric / NULLIF((SELECT n FROM total), 0)) * 100, 1) AS frequency_percent
  FROM cooc c, total
  WHERE total.n >= 3 AND (c.cnt::numeric / NULLIF(total.n, 0)) >= 0.30
  ORDER BY c.cnt DESC LIMIT 5;
$function$
;

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

CREATE OR REPLACE FUNCTION public.get_full_scope_grants()
 RETURNS jsonb
 LANGUAGE sql
 STABLE
 SET search_path TO 'public'
AS $function$ SELECT COALESCE(jsonb_agg(to_jsonb(g)), '[]'::jsonb) FROM public.mcp_full_grantors g WHERE public.is_admin(auth.uid()); $function$
;

CREATE OR REPLACE FUNCTION public.refresh_full_scope_grants_view()
 RETURNS void
 LANGUAGE sql
 SET search_path TO 'public'
AS $function$ SELECT 1; $function$
;

CREATE OR REPLACE FUNCTION public.check_rate_limit(_identifier text, _endpoint text, _max_requests integer DEFAULT 60, _window_seconds integer DEFAULT 60, _block_duration_seconds integer DEFAULT 3600)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
DECLARE
  _row record;
  _now timestamptz := now();
  _window_start timestamptz := _now - make_interval(secs => _window_seconds);
BEGIN
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

  IF _row.blocked_until IS NOT NULL AND _row.blocked_until > _now THEN
    RETURN jsonb_build_object('allowed', false, 'reason', 'blocked',
      'blocked_until', _row.blocked_until,
      'retry_after_seconds', EXTRACT(EPOCH FROM (_row.blocked_until - _now))::integer);
  END IF;

  IF _row.request_count > _max_requests THEN
    RETURN jsonb_build_object('allowed', false, 'reason', 'rate_exceeded',
      'count', _row.request_count, 'limit', _max_requests,
      'retry_after_seconds', _block_duration_seconds);
  END IF;

  RETURN jsonb_build_object('allowed', true, 'count', _row.request_count,
    'limit', _max_requests, 'remaining', GREATEST(_max_requests - _row.request_count, 0));
END;
$function$
;

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

CREATE OR REPLACE FUNCTION public.check_geo_country_allowed(_country_code text)
 RETURNS boolean
 LANGUAGE sql
 STABLE
 SET search_path TO 'public'
AS $function$ SELECT EXISTS(SELECT 1 FROM public.geo_allowed_countries WHERE country_code = upper(_country_code)); $function$
;

CREATE OR REPLACE FUNCTION public.is_org_admin(org_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE
 SET search_path TO 'public'
AS $function$
  select exists (
    select 1
    from public.user_organizations uo
    where uo.user_id = auth.uid()
      and uo.organization_id = org_id
      and uo.role = 'admin'
  );
$function$
;

CREATE OR REPLACE FUNCTION public.is_org_owner_or_admin(org_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select exists (
    select 1
    from public.user_organizations uo
    where uo.user_id = auth.uid()
      and uo.organization_id = org_id
      and uo.role in ('owner','admin')
  );
$function$
;

CREATE OR REPLACE FUNCTION public.is_dnd_active()
 RETURNS boolean
 LANGUAGE plpgsql
 STABLE
 SET search_path TO 'public'
AS $function$
DECLARE
  dnd_enabled BOOLEAN; dnd_start TIME; dnd_end TIME; current_t TIME;
BEGIN
  SELECT 
    COALESCE((preferences->>'dnd_enabled')::boolean, false),
    (preferences->>'dnd_start')::time,
    (preferences->>'dnd_end')::time
  INTO dnd_enabled, dnd_start, dnd_end
  FROM public.profiles WHERE user_id = auth.uid();
  
  IF NOT dnd_enabled OR dnd_start IS NULL OR dnd_end IS NULL THEN RETURN FALSE; END IF;
  current_t := LOCALTIME;
  
  IF dnd_start <= dnd_end THEN
    RETURN current_t BETWEEN dnd_start AND dnd_end;
  ELSE
    RETURN current_t >= dnd_start OR current_t <= dnd_end;
  END IF;
END;
$function$
;

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

CREATE OR REPLACE FUNCTION public.check_owner_email(_user_id uuid)
 RETURNS text
 LANGUAGE sql
 STABLE
 SET search_path TO 'public'
AS $function$ SELECT email FROM auth.users WHERE id = _user_id; $function$
;

CREATE OR REPLACE FUNCTION public.build_full_scope_grants_v()
 RETURNS void
 LANGUAGE sql
 SET search_path TO 'public'
AS $function$ SELECT 1; $function$
;

CREATE OR REPLACE FUNCTION public.purge_old_rate_limits()
 RETURNS integer
 LANGUAGE sql
 SET search_path TO 'public'
AS $function$ SELECT public.clean_old_rate_limits(); $function$
;

CREATE OR REPLACE FUNCTION public.log_user_logout()
 RETURNS void
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO public.admin_audit_log (
    user_id, action, resource_type, status, source, details
  ) VALUES (
    auth.uid(), 'user.logout', 'auth', 'success', 'client.auth',
    jsonb_build_object('timestamp', now())
  );
END;
$function$
;

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

CREATE OR REPLACE FUNCTION public.magic_up_get_brand_kit(_kit_id uuid)
 RETURNS jsonb
 LANGUAGE sql
 SET search_path TO 'public'
AS $function$
  SELECT to_jsonb(k) FROM public.magic_up_brand_kits k
  WHERE id = _kit_id AND user_id = auth.uid();
$function$
;

CREATE OR REPLACE FUNCTION public.mark_all_notifications_read()
 RETURNS void
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
BEGIN
  UPDATE public.workspace_notifications SET is_read = TRUE
  WHERE user_id = auth.uid() AND is_read = FALSE;
END;
$function$
;

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

CREATE OR REPLACE FUNCTION public.validate_mcp_key(_key_plain text)
 RETURNS TABLE(key_id uuid, scopes text[], block_reason text, created_by uuid)
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
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

  IF NOT FOUND THEN RETURN; END IF;

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
        user_id, action, resource_type, resource_id, status, source, details
      ) VALUES (
        _row.created_by, 'mcp_key.auto_revoked', 'mcp_api_key', _row.id, 'denied', 'validate_mcp_key',
        jsonb_build_object('reason', 'grantor_lost_dev_at_use', 'is_full_access', true, 'auto_revoked_at', now())
      );

      INSERT INTO public.step_up_audit_log(user_id, action, target_ref, event_type, metadata)
      VALUES (_row.created_by, 'mcp_full_issue', _row.id::text, 'auto_revoked',
        jsonb_build_object('reason','grantor_lost_dev_at_use','source','validate_mcp_key'));

      RETURN QUERY SELECT _row.id, NULL::text[], 'grantor_lost_dev'::text, _row.created_by;
      RETURN;
    END IF;
  END IF;

  UPDATE public.mcp_api_keys SET last_used_at = now() WHERE id = _row.id;

  RETURN QUERY SELECT _row.id, _row.scopes, NULL::text, _row.created_by;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.record_auth_attempt(_email text, _ip text, _success boolean, _reason text DEFAULT NULL::text, _ua text DEFAULT NULL::text)
 RETURNS void
 LANGUAGE sql
 SET search_path TO 'public'
AS $function$
    INSERT INTO public.auth_login_attempts (email, ip_address, success, failure_reason, user_agent)
    VALUES (_email, _ip, _success, _reason, _ua);
$function$
;

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

CREATE OR REPLACE FUNCTION public.get_industry_seasonality(_company_ids uuid[], _months integer DEFAULT 24)
 RETURNS TABLE(year integer, month integer, avg_quotes_per_company numeric, avg_revenue_per_company numeric, companies_active bigint)
 LANGUAGE sql
 STABLE
 SET search_path TO 'public'
AS $function$
  WITH per_client_month AS (
    SELECT q.client_id,
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
  SELECT y AS year, m AS month,
    AVG(qc)::numeric AS avg_quotes_per_company,
    AVG(rev)::numeric AS avg_revenue_per_company,
    COUNT(DISTINCT client_id)::bigint AS companies_active
  FROM per_client_month
  GROUP BY y, m ORDER BY y, m;
$function$
;

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

CREATE OR REPLACE FUNCTION public.reset_optimization_queue(_only_running boolean DEFAULT true)
 RETURNS integer
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
DECLARE
  affected int;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'forbidden';
  END IF;
  IF _only_running THEN
    UPDATE public.optimization_queue SET status = 'pending', started_at = NULL WHERE status = 'running';
  ELSE
    UPDATE public.optimization_queue SET status = 'pending', started_at = NULL, finished_at = NULL, error = NULL WHERE status IN ('running','failed','blocked');
  END IF;
  GET DIAGNOSTICS affected = ROW_COUNT;
  RETURN affected;
END;
$function$
;

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

CREATE OR REPLACE FUNCTION public.acquire_ai_quota(_user_id uuid, _function_name text, _model text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
DECLARE
  v_check jsonb;
  v_log_id uuid;
BEGIN
  v_check := public.check_ai_quota(_user_id);

  IF NOT (v_check->>'allowed')::boolean THEN
    RETURN v_check;
  END IF;

  INSERT INTO public.ai_usage_logs (user_id, function_name, model, status)
  VALUES (_user_id, _function_name, _model, 'pending')
  RETURNING id INTO v_log_id;

  RETURN v_check || jsonb_build_object('log_id', v_log_id);
END;
$function$
;

CREATE OR REPLACE FUNCTION public.can_grant_mcp_full_to_user(_target_user_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE
 SET search_path TO 'public'
AS $function$ SELECT public.is_admin(auth.uid()) AND auth.uid() <> _target_user_id; $function$
;

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

CREATE OR REPLACE FUNCTION public.request_step_up_challenge(_action step_up_action, _target_ref text DEFAULT NULL::text, _ip inet DEFAULT NULL::inet, _user_agent text DEFAULT NULL::text)
 RETURNS TABLE(challenge_id uuid, otp_plain text, expires_at timestamp with time zone)
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
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

  IF NOT public.is_dev(_uid) THEN
    INSERT INTO public.step_up_audit_log(user_id, action, target_ref, event_type, ip_address, user_agent)
    VALUES (_uid, _action, _target_ref, 'unauthorized', _ip, _user_agent);
    RAISE EXCEPTION 'forbidden: dev role required';
  END IF;

  SELECT count(*) INTO _recent_count
  FROM public.step_up_challenges
  WHERE user_id = _uid AND created_at > (now() - interval '1 hour');

  IF _recent_count >= 5 THEN
    INSERT INTO public.step_up_audit_log(user_id, action, target_ref, event_type, ip_address, user_agent)
    VALUES (_uid, _action, _target_ref, 'rate_limited', _ip, _user_agent);
    RAISE EXCEPTION 'rate_limited: too many step-up requests';
  END IF;

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
$function$
;

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

CREATE OR REPLACE FUNCTION public.can_manage_quotes(_user_id uuid DEFAULT auth.uid())
 RETURNS boolean
 LANGUAGE sql
 STABLE
 SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id
      AND role IN ('supervisor'::public.app_role, 'admin'::public.app_role, 'manager'::public.app_role)
  )
$function$
;

CREATE OR REPLACE FUNCTION public.get_unread_count()
 RETURNS integer
 LANGUAGE plpgsql
 STABLE
 SET search_path TO 'public'
AS $function$
DECLARE count_val INTEGER;
BEGIN
  SELECT COUNT(*)::INTEGER INTO count_val
  FROM public.workspace_notifications
  WHERE user_id = auth.uid() AND is_read = FALSE;
  RETURN count_val;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.mark_notification_read(p_notification_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
BEGIN
  UPDATE public.workspace_notifications SET is_read = TRUE
  WHERE id = p_notification_id AND user_id = auth.uid();
END;
$function$
;

CREATE OR REPLACE FUNCTION public.has_org_role(_user_id uuid, _org_id uuid, _role org_role)
 RETURNS boolean
 LANGUAGE sql
 STABLE
 SET search_path TO 'public'
AS $function$
  SELECT EXISTS (SELECT 1 FROM public.organization_members
    WHERE user_id = _user_id AND organization_id = _org_id AND role = _role)
$function$
;

CREATE OR REPLACE FUNCTION public.get_user_org_ids(_user_id uuid)
 RETURNS TABLE(organization_id uuid)
 LANGUAGE sql
 SET search_path TO 'public'
AS $function$
  SELECT organization_id FROM public.organization_members WHERE user_id = _user_id
$function$
;

CREATE OR REPLACE FUNCTION public.create_organization_with_owner(_name text, _slug text)
 RETURNS uuid
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
DECLARE _org_id uuid;
BEGIN
  INSERT INTO public.organizations (name, slug) VALUES (_name, _slug)
  RETURNING id INTO _org_id;
  INSERT INTO public.organization_members (organization_id, user_id, role)
  VALUES (_org_id, auth.uid(), 'owner');
  RETURN _org_id;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.is_org_member(_user_id uuid, _org_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT EXISTS (SELECT 1 FROM public.organization_members
    WHERE user_id = _user_id AND organization_id = _org_id)
$function$
;

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

CREATE OR REPLACE FUNCTION public.is_supervisor_or_above(_user_id uuid DEFAULT auth.uid())
 RETURNS boolean
 LANGUAGE sql
 STABLE
 SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id 
      AND role IN ('dev','supervisor','admin','manager')
  );
$function$
;

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

CREATE OR REPLACE FUNCTION public.is_kit_collaborator(_kit_id uuid, _user_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE
 SET search_path TO 'public'
AS $function$
  SELECT EXISTS (SELECT 1 FROM public.kit_collaborators WHERE kit_id = _kit_id AND user_id = _user_id);
$function$
;

CREATE OR REPLACE FUNCTION public.check_ai_quota(_user_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
DECLARE
  v_role text;
  v_limit int;
  v_unlimited boolean;
  v_used int;
BEGIN
  v_role := public._get_user_primary_role(_user_id);

  SELECT monthly_limit, is_unlimited INTO v_limit, v_unlimited
  FROM public.ai_usage_quotas WHERE role = v_role;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'allowed', true, 'used', 0, 'limit', -1, 'remaining', -1,
      'unlimited', true, 'reason', 'no_quota_for_role'
    );
  END IF;

  SELECT count(*)::int INTO v_used
  FROM public.ai_usage_logs
  WHERE user_id = _user_id
    AND created_at >= date_trunc('month', now())
    AND status != 'error';

  IF v_unlimited THEN
    RETURN jsonb_build_object(
      'allowed', true, 'used', v_used, 'limit', -1, 'remaining', -1, 'unlimited', true
    );
  END IF;

  RETURN jsonb_build_object(
    'allowed', v_used < v_limit,
    'used', v_used,
    'limit', v_limit,
    'remaining', greatest(0, v_limit - v_used),
    'unlimited', false
  );
END;
$function$
;

CREATE OR REPLACE FUNCTION public.set_connection_failure_window_minutes(minutes integer)
 RETURNS integer
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
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
    SET value = EXCLUDED.value, updated_by = EXCLUDED.updated_by, updated_at = EXCLUDED.updated_at;
  INSERT INTO public.admin_audit_log (user_id, action, resource_type, resource_id, details)
  VALUES (auth.uid(), 'connection_failure_window_changed', 'system_setting',
          'connection_failure_window_minutes', jsonb_build_object('minutes', minutes));
  RETURN minutes;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.get_connections_auto_test_interval()
 RETURNS integer
 LANGUAGE plpgsql
 STABLE
 SET search_path TO 'public', 'cron'
AS $function$
DECLARE
  s text; m text;
BEGIN
  SELECT schedule INTO s FROM cron.job WHERE jobname = 'connections-auto-test' LIMIT 1;
  IF s IS NULL THEN RETURN NULL; END IF;
  m := split_part(s, ' ', 1);
  IF m LIKE '*/%' THEN RETURN NULLIF(substring(m FROM 3), '')::int;
  ELSIF m ~ '^[0-9]+$' THEN RETURN 60;
  END IF;
  RETURN NULL;
END;
$function$
;

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

CREATE OR REPLACE FUNCTION public.set_connections_auto_test_interval(minutes integer)
 RETURNS integer
 LANGUAGE plpgsql
 SET search_path TO 'public', 'cron'
AS $function$
DECLARE
  schedule text; job_id bigint;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::public.app_role) THEN
    RAISE EXCEPTION 'forbidden: admin role required';
  END IF;
  IF minutes NOT IN (5, 10, 15, 30, 60, 120, 240) THEN
    RAISE EXCEPTION 'invalid interval: must be one of 5, 10, 15, 30, 60, 120, 240 minutes';
  END IF;
  IF minutes < 60 THEN schedule := '*/' || minutes::text || ' * * * *';
  ELSIF minutes = 60 THEN schedule := '0 * * * *';
  ELSIF minutes = 120 THEN schedule := '0 */2 * * *';
  ELSIF minutes = 240 THEN schedule := '0 */4 * * *';
  END IF;
  SELECT jobid INTO job_id FROM cron.job WHERE jobname = 'connections-auto-test' LIMIT 1;
  IF job_id IS NULL THEN RAISE EXCEPTION 'cron job connections-auto-test not found'; END IF;
  PERFORM cron.alter_job(job_id := job_id, schedule := schedule);
  INSERT INTO public.admin_audit_log (user_id, action, resource_type, resource_id, details)
  VALUES (auth.uid(), 'connections_auto_test_interval_changed', 'cron_job', job_id::text,
          jsonb_build_object('minutes', minutes, 'schedule', schedule));
  RETURN minutes;
END;
$function$
;

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

CREATE OR REPLACE FUNCTION public.get_top_favorited_products(_days integer DEFAULT 7, _limit integer DEFAULT 6)
 RETURNS TABLE(product_id text, fav_count bigint)
 LANGUAGE sql
 STABLE
 SET search_path TO 'public'
AS $function$
  SELECT fi.product_id, COUNT(*)::bigint AS fav_count
  FROM public.favorite_items fi
  WHERE fi.added_at >= (now() - make_interval(days => GREATEST(_days, 1)))
  GROUP BY fi.product_id
  ORDER BY fav_count DESC, MAX(fi.added_at) DESC
  LIMIT GREATEST(_limit, 1);
$function$
;

CREATE OR REPLACE FUNCTION public.get_client_top_products(_client_id uuid, _limit integer DEFAULT 15)
 RETURNS TABLE(product_id uuid, product_name text, product_image_url text, total_quantity bigint, occurrences bigint, total_revenue numeric, avg_unit_price numeric, last_quoted_at timestamp with time zone)
 LANGUAGE sql
 STABLE
 SET search_path TO 'public'
AS $function$
  SELECT 
    qi.product_id,
    qi.product_name,
    qi.product_image_url,
    SUM(qi.quantity)::bigint                                AS total_quantity,
    COUNT(DISTINCT q.id)::bigint                            AS occurrences,
    COALESCE(SUM(qi.quantity * qi.unit_price), 0)::numeric  AS total_revenue,
    COALESCE(AVG(qi.unit_price), 0)::numeric                AS avg_unit_price,
    MAX(q.created_at)                                       AS last_quoted_at
  FROM public.quotes q
  JOIN public.quote_items qi ON qi.quote_id = q.id
  WHERE q.client_id = _client_id
    AND q.status IS DISTINCT FROM 'cancelled'
    AND q.status IS DISTINCT FROM 'rejected'
  GROUP BY qi.product_id, qi.product_name, qi.product_image_url
  ORDER BY SUM(qi.quantity) DESC
  LIMIT _limit
$function$
;

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

CREATE OR REPLACE FUNCTION public.get_auto_test_job_status(_limit integer DEFAULT 20)
 RETURNS TABLE(run_started_at timestamp with time zone, run_ended_at timestamp with time zone, duration_ms integer, total_tested integer, ok_count integer, fail_count integer, retried_count integer, avg_latency_ms integer)
 LANGUAGE plpgsql
 STABLE
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'forbidden: admin role required';
  END IF;
  RETURN QUERY
  WITH ordered AS (
    SELECT cth.tested_at, cth.success, cth.latency_ms, cth.attempts, date_trunc('minute', cth.tested_at) AS bucket
    FROM public.connection_test_history cth
    WHERE cth.triggered_by = 'cron' AND cth.tested_at > now() - interval '7 days'
  ),
  runs AS (
    SELECT o.bucket,
      MIN(o.tested_at) AS run_started_at,
      MAX(o.tested_at) AS run_ended_at,
      GREATEST(EXTRACT(EPOCH FROM (MAX(o.tested_at) - MIN(o.tested_at))) * 1000, 0)::int AS duration_ms,
      COUNT(*)::int AS total_tested,
      COUNT(*) FILTER (WHERE o.success)::int AS ok_count,
      COUNT(*) FILTER (WHERE NOT o.success)::int AS fail_count,
      COUNT(*) FILTER (WHERE o.attempts > 1)::int AS retried_count,
      COALESCE(AVG(o.latency_ms) FILTER (WHERE o.latency_ms IS NOT NULL), 0)::int AS avg_latency_ms
    FROM ordered o GROUP BY o.bucket
  )
  SELECT r.run_started_at, r.run_ended_at, r.duration_ms, r.total_tested, r.ok_count, r.fail_count, r.retried_count, r.avg_latency_ms
  FROM runs r ORDER BY r.run_started_at DESC LIMIT GREATEST(1, LEAST(_limit, 100));
END;
$function$
;

CREATE OR REPLACE FUNCTION public.log_access_denied(_blocked_path text, _required_role text, _user_role text DEFAULT NULL::text, _reason text DEFAULT 'route_blocked'::text)
 RETURNS void
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
DECLARE _uid uuid := auth.uid();
BEGIN
  IF _uid IS NULL THEN RETURN; END IF;
  IF _required_role NOT IN ('dev','admin','supervisor') THEN
    RAISE EXCEPTION 'invalid required_role: %', _required_role;
  END IF;
  INSERT INTO public.admin_audit_log (
    user_id, action, resource_type, resource_id, status, source,
    started_at, finished_at, duration_ms, request_id, payload_summary, details
  ) VALUES (
    _uid, 'route.access_denied', 'route', _blocked_path, 'denied', 'frontend-guard',
    now(), now(), 0, gen_random_uuid()::text,
    jsonb_build_object('blocked_path', _blocked_path),
    jsonb_build_object('reason', _reason, 'blocked_path', _blocked_path,
                       'required_role', _required_role, 'user_role', _user_role)
  );
END;
$function$
;

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

CREATE OR REPLACE FUNCTION public.record_platform_failure(p_operation text, p_table text DEFAULT NULL::text, p_rpc_name text DEFAULT NULL::text, p_duration_ms integer DEFAULT 0, p_error_message text DEFAULT NULL::text, p_is_503 boolean DEFAULT true, p_is_cold_start boolean DEFAULT false, p_retry_count integer DEFAULT 0)
 RETURNS uuid
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
DECLARE new_id uuid;
BEGIN
  INSERT INTO public.query_telemetry (
    operation, table_name, rpc_name, duration_ms, record_count, severity,
    error_message, error_kind, user_id, retry_count, cache_hit, is_503, is_cold_start
  ) VALUES (
    COALESCE(p_operation, 'unknown'), p_table, p_rpc_name,
    GREATEST(COALESCE(p_duration_ms, 0), 0), NULL, 'error',
    p_error_message, 'network', auth.uid(),
    GREATEST(COALESCE(p_retry_count, 0), 0), false,
    COALESCE(p_is_503, true), COALESCE(p_is_cold_start, false)
  ) RETURNING id INTO new_id;
  RETURN new_id;
END; $function$
;

CREATE OR REPLACE FUNCTION public.record_dev_route_telemetry(_event_type text, _blocked_path text, _user_role text DEFAULT NULL::text, _duration_ms integer DEFAULT NULL::integer)
 RETURNS void
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
DECLARE
  _uid uuid := auth.uid();
  _safe_path text; _safe_role text; _safe_duration integer; _recent_count integer;
  _allowed_events constant text[] := ARRAY['view','back','retry','fallback','request_access','copy_link','mail','abandon'];
BEGIN
  IF _uid IS NULL THEN RETURN; END IF;
  IF NOT (_event_type = ANY (_allowed_events)) THEN
    RAISE EXCEPTION 'invalid event_type: %', _event_type USING ERRCODE = '22023';
  END IF;
  _safe_path := substring(coalesce(_blocked_path, '') from 1 for 200);
  IF length(_safe_path) = 0 THEN RAISE EXCEPTION 'blocked_path required' USING ERRCODE = '22023'; END IF;
  _safe_role := substring(coalesce(_user_role, '') from 1 for 32);
  IF _safe_role NOT IN ('dev','admin','supervisor','agente','agent','vendedor','') THEN _safe_role := 'unknown'; END IF;
  IF length(_safe_role) = 0 THEN _safe_role := NULL; END IF;
  IF _duration_ms IS NULL THEN _safe_duration := NULL;
  ELSIF _duration_ms < 0 THEN _safe_duration := 0;
  ELSIF _duration_ms > 3600000 THEN _safe_duration := 3600000;
  ELSE _safe_duration := _duration_ms; END IF;
  SELECT count(*) INTO _recent_count FROM public.admin_audit_log
  WHERE user_id = _uid AND action = 'route.ux_event' AND source = 'dev-route-ui'
    AND created_at > now() - interval '1 minute';
  IF _recent_count >= 30 THEN RETURN; END IF;
  INSERT INTO public.admin_audit_log (
    user_id, action, resource_type, resource_id, status, source,
    started_at, finished_at, duration_ms, request_id, payload_summary, details
  ) VALUES (
    _uid, 'route.ux_event', 'route', _safe_path,
    CASE WHEN _event_type IN ('view','abandon','copy_link','mail') THEN 'denied'
         WHEN _event_type IN ('back','retry','fallback') THEN 'partial'
         WHEN _event_type = 'request_access' THEN 'success' ELSE 'denied' END,
    'dev-route-ui', now(), now(), _safe_duration, gen_random_uuid()::text,
    jsonb_build_object('event_type', _event_type, 'blocked_path', _safe_path),
    jsonb_build_object('event_type', _event_type, 'blocked_path', _safe_path, 'user_role', _safe_role, 'duration_ms', _safe_duration)
  );
END; $function$
;

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

CREATE OR REPLACE FUNCTION public.expert_chat_get_conversation(_conv_id uuid)
 RETURNS jsonb
 LANGUAGE sql
 SET search_path TO 'public'
AS $function$
  SELECT to_jsonb(c) FROM public.expert_conversations c
  WHERE id = _conv_id AND seller_id = auth.uid();
$function$
;

