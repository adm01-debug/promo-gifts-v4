-- CUTOVER (parte 2/2): reescreve o restante do motor para `status`, reconcilia a
-- janela de transição, recria o índice de fila, faz o backfill de imagens e remove
-- fisicamente as colunas legadas. Tudo atômico.
-- Funções que ainda liam/escreviam `processed` (descobertas na verificação pós-parte1):
--   fn_process_raw_v2 (motor), fn_process_staged_product, fn_finish_import_batch,
--   process_supplier_products_batch.

-- 0) Duas views remanescentes que dependiam de `processed` (ambas contêm processed_at,
--    por isso escaparam do filtro inicial). vw_asia_products_errors expõe `processed`
--    como coluna de saída -> preserva contrato com (status='processed') AS processed.
CREATE OR REPLACE VIEW public.vw_asia_products_errors AS
 SELECT supplier_reference,
    raw_data ->> 'nome'::text AS nome_produto,
    process_errors,
    (status = 'processed'::supplier_raw_status) AS processed,
    processed_at,
    created_at
   FROM supplier_products_raw spr
  WHERE supplier_id = 'd2734e23-d633-4819-bb15-e51aa44e2118'::uuid AND process_errors IS NOT NULL
  ORDER BY updated_at DESC;
ALTER VIEW public.vw_asia_products_errors SET (security_invoker = on);

CREATE OR REPLACE VIEW public.vw_supplier_products_raw_status AS
 SELECT s.id AS supplier_id,
    s.name AS supplier_name,
    count(*) AS total_produtos,
    count(*) FILTER (WHERE spr.status = 'processed'::supplier_raw_status) AS processados,
    count(*) FILTER (WHERE spr.status <> 'processed'::supplier_raw_status) AS pendentes,
    count(*) FILTER (WHERE spr.process_errors IS NOT NULL) AS com_erro,
    round(count(*) FILTER (WHERE spr.status = 'processed'::supplier_raw_status)::numeric * 100.0 / NULLIF(count(*), 0)::numeric, 2) AS taxa_sucesso_pct,
    min(spr.imported_at) AS primeira_importacao,
    max(spr.imported_at) AS ultima_importacao,
    avg(EXTRACT(epoch FROM spr.processed_at - spr.imported_at)) AS tempo_medio_processamento_seg
   FROM supplier_products_raw spr
     JOIN suppliers s ON s.id = spr.supplier_id
  GROUP BY s.id, s.name
  ORDER BY (count(*)) DESC;
ALTER VIEW public.vw_supplier_products_raw_status SET (security_invoker = on);

-- 1) Swap por regex nas 3 funções cujos usos de `processed` são todos = TRUE/FALSE
--    sem ambiguidade SET/WHERE (no motor os '=false' são todos WHERE; o único '=true'
--    é o SET final de conclusão).
DO $f$
DECLARE r record; v_src text;
BEGIN
  FOR r IN
    SELECT p.oid FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname='public'
       AND p.proname IN ('fn_process_raw_v2','fn_process_staged_product','fn_finish_import_batch')
  LOOP
    v_src := pg_get_functiondef(r.oid);
    v_src := regexp_replace(v_src, '([a-z0-9_]+\.)?\mprocessed\M\s*=\s*true',
                            '\1status = ''processed''::supplier_raw_status', 'gi');
    v_src := regexp_replace(v_src, '([a-z0-9_]+\.)?\mprocessed\M\s*=\s*false',
                            '\1status <> ''processed''::supplier_raw_status', 'gi');
    EXECUTE v_src;
  END LOOP;
END $f$;

-- 2) process_supplier_products_batch: reescrita explícita (mistura SET/WHERE com
--    'processed = FALSE'). Sucesso -> status 'processed'; falha -> status 'failed'
--    (continua sendo re-tentado pois a fila usa status <> 'processed').
CREATE OR REPLACE FUNCTION public.process_supplier_products_batch(p_supplier_id uuid, p_limit integer DEFAULT 100)
 RETURNS TABLE(staging_id uuid, supplier_reference text, success boolean, product_id uuid, variants_created integer, error_message text, processed_at timestamp with time zone)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
    v_raw RECORD;
    v_result JSONB;
BEGIN
    FOR v_raw IN
        SELECT *
        FROM supplier_products_raw
        WHERE supplier_id = p_supplier_id
        AND status <> 'processed'::supplier_raw_status
        ORDER BY imported_at ASC
        LIMIT p_limit
        FOR UPDATE SKIP LOCKED
    LOOP
        BEGIN
            v_result := process_supplier_product(
                v_raw.supplier_id,
                v_raw.raw_data,
                v_raw.supplier_reference
            );

            IF (v_result->>'success')::BOOLEAN THEN
                UPDATE supplier_products_raw
                SET
                    status = 'processed'::supplier_raw_status,
                    processed_at = NOW(),
                    product_id = (v_result->>'product_id')::UUID,
                    process_errors = NULL,
                    updated_at = NOW()
                WHERE id = v_raw.id;

                staging_id := v_raw.id;
                supplier_reference := v_raw.supplier_reference;
                success := TRUE;
                product_id := (v_result->>'product_id')::UUID;
                variants_created := (v_result->>'variants_created')::INTEGER;
                error_message := NULL;
                processed_at := NOW();
                RETURN NEXT;
            ELSE
                UPDATE supplier_products_raw
                SET
                    status = 'failed'::supplier_raw_status,
                    process_errors = v_result->'errors',
                    updated_at = NOW()
                WHERE id = v_raw.id;

                staging_id := v_raw.id;
                supplier_reference := v_raw.supplier_reference;
                success := FALSE;
                product_id := NULL;
                variants_created := 0;
                error_message := (v_result->'errors'->>0);
                processed_at := NOW();
                RETURN NEXT;
            END IF;

        EXCEPTION WHEN OTHERS THEN
            UPDATE supplier_products_raw
            SET
                status = 'failed'::supplier_raw_status,
                process_errors = jsonb_build_object(
                    'fatal_error', SQLERRM,
                    'timestamp', NOW()
                ),
                updated_at = NOW()
            WHERE id = v_raw.id;

            staging_id := v_raw.id;
            supplier_reference := v_raw.supplier_reference;
            success := FALSE;
            product_id := NULL;
            variants_created := 0;
            error_message := SQLERRM;
            processed_at := NOW();
            RETURN NEXT;
        END;
    END LOOP;

    RETURN;
END;
$function$;

-- 3) Guarda: nenhuma das funções tocadas pode mais referenciar a coluna processed.
DO $g$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
     WHERE n.nspname='public'
       AND p.proname IN ('fn_process_raw_v2','fn_process_staged_product','fn_finish_import_batch',
                         'process_supplier_products_batch','fn_dryrun_raw_v2',
                         'fn_process_all_staged_products','fn_stage_product','insert_supplier_product_raw')
       AND (p.prosrc ~* '\mprocessed\M\s*=' OR p.prosrc ~* '\mprocessed\M\s+IS\s+NULL')
  ) THEN
    RAISE EXCEPTION 'Cutover abortado: ainda ha funcao referenciando a coluna processed';
  END IF;
END $g$;

-- 4) Reconcilia a janela de transição (motor pode ter marcado processed=true sem a
--    ponte). Alinha status a partir do booleano antes de removê-lo.
UPDATE public.supplier_products_raw
   SET status = 'processed'::supplier_raw_status
 WHERE processed = true AND status <> 'processed'::supplier_raw_status;

-- 5) Backfill final de images_processed (drift histórico). O trigger BEFORE recomputa
--    images_processed a partir de images_status, sem clobber do enum.
UPDATE public.supplier_products_raw
   SET images_status = images_status
 WHERE images_processed IS DISTINCT FROM (images_status = 'processed');

-- 6) Remove colunas legadas (idx_spr_processed cai junto com a coluna).
ALTER TABLE public.supplier_products_raw DROP COLUMN processed;
ALTER TABLE public.supplier_products_raw DROP COLUMN raw_hash;

-- 7) Índice de fila equivalente ao antigo idx_spr_processed (WHERE processed=false),
--    agora sobre o enum. Como quase tudo fica 'processed', o conjunto pendente é
--    pequeno -> índice parcial enxuto e ideal para o motor.
CREATE INDEX IF NOT EXISTS idx_spr_unprocessed
  ON public.supplier_products_raw (supplier_id, imported_at)
  WHERE status <> 'processed'::supplier_raw_status;
