-- CUTOVER (parte 1/2): tornar `status` (enum) a fonte única da verdade.
-- Reescreve views/funções/triggers para não dependerem mais do booleano `processed`
-- nem do `raw_hash` legado. A coluna física só é removida na parte 2/2.
-- Semântica preservada: processed = (status = 'processed') com 0 divergências hoje.

-- 1) Views: troca predicados processed=true/false por status (preservando contrato e
--    a opção security_invoker). Feito via pg_get_viewdef+regex para não transcrever as
--    views grandes (ex.: v_system_health_dashboard) à mão.
DO $vw$
DECLARE r record; v_new text;
BEGIN
  FOR r IN
    SELECT viewname FROM pg_views
     WHERE schemaname = 'public'
       AND viewname IN ('v_system_alerts','v_system_health_dashboard',
                        'vw_asia_products_by_category','vw_asia_products_pending',
                        'vw_asia_products_stats','vw_somarcas_pending','vw_somarcas_stats',
                        'vw_somarcas_sync_status','vw_xbz_products_stats')
  LOOP
    v_new := pg_get_viewdef(('public.'||r.viewname)::regclass, true);
    -- processed = true  -> status = 'processed'
    v_new := regexp_replace(v_new,
      '([a-z0-9_]+\.)?\mprocessed\M\s*=\s*true',
      '\1status = ''processed''::supplier_raw_status', 'gi');
    -- processed = false OR processed IS NULL  -> status <> 'processed'
    v_new := regexp_replace(v_new,
      '([a-z0-9_]+\.)?\mprocessed\M\s*=\s*false\s+OR\s+([a-z0-9_]+\.)?\mprocessed\M\s+IS\s+NULL',
      '\1status <> ''processed''::supplier_raw_status', 'gi');
    -- processed = false  -> status <> 'processed'
    v_new := regexp_replace(v_new,
      '([a-z0-9_]+\.)?\mprocessed\M\s*=\s*false',
      '\1status <> ''processed''::supplier_raw_status', 'gi');

    EXECUTE 'CREATE OR REPLACE VIEW public.'||quote_ident(r.viewname)||' AS '||v_new;
    EXECUTE 'ALTER VIEW public.'||quote_ident(r.viewname)||' SET (security_invoker = on)';
  END LOOP;

  IF EXISTS (
    SELECT 1 FROM pg_views
     WHERE schemaname='public'
       AND viewname IN ('v_system_alerts','v_system_health_dashboard',
                        'vw_asia_products_by_category','vw_asia_products_pending',
                        'vw_asia_products_stats','vw_somarcas_pending','vw_somarcas_stats',
                        'vw_somarcas_sync_status','vw_xbz_products_stats')
       AND (definition ~* '\mprocessed\M\s*=' OR definition ~* '\mprocessed\M\s+IS\s+NULL')
  ) THEN
    RAISE EXCEPTION 'Cutover abortado: ainda há view referenciando a coluna processed';
  END IF;
END $vw$;

-- 2) Funções diagnósticas/de fila: troca de processed por status (swap pontual via
--    pg_get_functiondef+regex, preservando corpo, SECURITY e search_path).
DO $fns$
DECLARE v_src text;
BEGIN
  -- fn_dryrun_raw_v2: UPDATE ... SET processed=false  -> SET status='pending'
  v_src := pg_get_functiondef('public.fn_dryrun_raw_v2(uuid,integer)'::regprocedure);
  v_src := regexp_replace(v_src, '\mprocessed\M\s*=\s*false',
                          'status=''pending''::supplier_raw_status', 'gi');
  EXECUTE v_src;

  -- fn_process_all_staged_products: WHERE processed = FALSE -> status <> 'processed'
  v_src := pg_get_functiondef('public.fn_process_all_staged_products(uuid,integer)'::regprocedure);
  v_src := regexp_replace(v_src, '\mprocessed\M\s*=\s*false',
                          'status <> ''processed''::supplier_raw_status', 'gi');
  EXECUTE v_src;
END $fns$;

-- 3) Funções de ingestão: removem raw_hash e processed; detecção de mudança passa a
--    usar content_hash (hash "limpo", calculado pelo trigger ignorando campos voláteis).
CREATE OR REPLACE FUNCTION public.fn_stage_product(
  p_batch_id uuid, p_supplier_id uuid, p_supplier_reference text, p_raw_data jsonb)
 RETURNS uuid
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $fn$
DECLARE
  v_staging_id UUID;
BEGIN
  SELECT id INTO v_staging_id
    FROM supplier_products_raw
   WHERE import_batch_id = p_batch_id AND supplier_reference = p_supplier_reference;

  IF v_staging_id IS NOT NULL THEN
    UPDATE supplier_products_raw
       SET raw_data = p_raw_data, updated_at = NOW()
     WHERE id = v_staging_id;
  ELSE
    INSERT INTO supplier_products_raw (
      import_batch_id, supplier_id, supplier_reference, raw_data,
      imported_at, created_at, updated_at)
    VALUES (
      p_batch_id, p_supplier_id, p_supplier_reference, p_raw_data,
      NOW(), NOW(), NOW())
    RETURNING id INTO v_staging_id;
  END IF;

  RETURN v_staging_id;
END $fn$;

CREATE OR REPLACE FUNCTION public.insert_supplier_product_raw(
  p_supplier_id uuid, p_supplier_reference text, p_raw_data jsonb,
  p_import_batch_id uuid DEFAULT NULL::uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $fn$
DECLARE v_id UUID;
BEGIN
  INSERT INTO supplier_products_raw (
    id, supplier_id, supplier_reference, raw_data, import_batch_id,
    imported_at, created_at, updated_at)
  VALUES (
    gen_random_uuid(), p_supplier_id, p_supplier_reference, p_raw_data, p_import_batch_id,
    NOW(), NOW(), NOW())
  ON CONFLICT (supplier_id, supplier_reference) DO UPDATE SET
    raw_data        = EXCLUDED.raw_data,
    import_batch_id = EXCLUDED.import_batch_id,
    imported_at     = NOW(),
    -- content_hash é recalculado pelo trigger BEFORE; reabre p/ reprocesso só se mudou.
    status          = CASE
                        WHEN supplier_products_raw.content_hash IS DISTINCT FROM EXCLUDED.content_hash
                        THEN 'pending'::supplier_raw_status
                        ELSE supplier_products_raw.status
                      END,
    updated_at      = NOW()
  RETURNING id INTO v_id;
  RETURN v_id;
END $fn$;

-- 4) Consolida os 4 triggers BEFORE (normalize + initial_state + sync_status +
--    set_updated_at) num único. images_processed vira espelho UNIDIRECIONAL de
--    images_status (corrige o drift histórico e elimina o "reverse bridge").
CREATE OR REPLACE FUNCTION public.fn_spr_before_write()
RETURNS trigger
LANGUAGE plpgsql
AS $fn$
DECLARE v_clean jsonb;
BEGIN
  -- normalize: source_channel e imported_at a partir de metacampos do payload
  IF NEW.raw_data ? '_source' AND COALESCE(NEW.source_channel,'') IN ('','n8n','legacy') THEN
    NEW.source_channel := NEW.raw_data->>'_source';
  END IF;
  IF NEW.raw_data ? '_imported_at' AND NEW.imported_at IS NULL THEN
    BEGIN NEW.imported_at := (NEW.raw_data->>'_imported_at')::timestamptz;
    EXCEPTION WHEN others THEN NULL; END;
  END IF;

  -- remove metacampos voláteis e calcula content_hash "limpo"
  v_clean := NEW.raw_data - '_source' - '_api_fields_count' - '_imported_at';
  NEW.raw_data     := v_clean;
  NEW.content_hash := md5(v_clean::text);

  IF TG_OP = 'INSERT' THEN
    NEW.imported_at := COALESCE(NEW.imported_at, now());
    IF NEW.process_errors IS NOT NULL AND NEW.last_error IS NULL THEN
      NEW.last_error := NEW.process_errors;
    END IF;
  ELSE -- UPDATE
    NEW.updated_at := now();
    IF NEW.process_errors IS DISTINCT FROM OLD.process_errors AND NEW.process_errors IS NOT NULL THEN
      NEW.last_error := NEW.process_errors;
    END IF;
    IF NEW.status = 'processed' AND NEW.status IS DISTINCT FROM OLD.status THEN
      NEW.processed_at := COALESCE(NEW.processed_at, now());
    END IF;
  END IF;

  -- espelho unidirecional (fonte da verdade = images_status)
  NEW.images_processed := (NEW.images_status = 'processed');

  RETURN NEW;
END $fn$;

DROP TRIGGER IF EXISTS trg_aa_spr_normalize   ON public.supplier_products_raw;
DROP TRIGGER IF EXISTS trg_set_initial_state  ON public.supplier_products_raw;
DROP TRIGGER IF EXISTS trg_zz_sync_raw_status ON public.supplier_products_raw;
DROP TRIGGER IF EXISTS set_updated_at_trigger ON public.supplier_products_raw;

CREATE TRIGGER trg_spr_before_write
  BEFORE INSERT OR UPDATE ON public.supplier_products_raw
  FOR EACH ROW EXECUTE FUNCTION public.fn_spr_before_write();

-- funções dos triggers antigos: exclusivas desta tabela, agora órfãs.
DROP FUNCTION IF EXISTS public.fn_spr_normalize();
DROP FUNCTION IF EXISTS public.fn_set_initial_processed_state();
DROP FUNCTION IF EXISTS public.fn_sync_raw_status();
-- set_updated_at NÃO é removida: compartilhada por 65 tabelas.
