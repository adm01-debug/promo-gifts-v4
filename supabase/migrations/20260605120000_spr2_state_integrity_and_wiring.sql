-- ============================================================================
-- supplier_products_raw — Refactor v2 (Fase 1/5): Integridade do estado
-- ----------------------------------------------------------------------------
-- Contexto: o motor (fn_process_raw_v2) gravava process_errors no handler de
-- exceção mas NUNCA refletia isso no status (ficava 'processed'/'pending') e
-- nunca contava a tentativa. Resultado medido: 499 linhas status='processed'
-- COM process_errors (estado mentiroso) e as colunas attempts/last_error como
-- scaffolding de uma máquina de retry que nunca foi ligada.
--
-- Esta fase:
--   1. Liga a contagem de tentativas + estado verdadeiro (failed/quarantined)
--      DENTRO do trigger BEFORE WRITE — sem reescrever o motor. Sempre que o
--      pipeline grava um novo process_errors, o trigger conta a tentativa,
--      guarda last_error e marca failed (ou quarantined a partir de 5 falhas).
--   2. Remove a atribuição de images_processed (vira coluna gerada na Fase 2).
--   3. Reconcilia as 499 linhas inconsistentes -> failed (verdade).
--   4. Trava o invariante com CHECK: nunca mais processed + process_errors.
-- ============================================================================

-- 1) Trigger consolidado BEFORE INSERT/UPDATE — agora com wiring de retry
CREATE OR REPLACE FUNCTION public.fn_spr_before_write()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
DECLARE v_clean jsonb;
BEGIN
  IF NEW.raw_data ? '_source' AND COALESCE(NEW.source_channel,'') IN ('','n8n','legacy') THEN
    NEW.source_channel := NEW.raw_data->>'_source';
  END IF;
  IF NEW.raw_data ? '_imported_at' AND NEW.imported_at IS NULL THEN
    BEGIN NEW.imported_at := (NEW.raw_data->>'_imported_at')::timestamptz;
    EXCEPTION WHEN others THEN NULL; END;
  END IF;

  v_clean := NEW.raw_data - '_source' - '_api_fields_count' - '_imported_at';
  NEW.raw_data     := v_clean;
  NEW.content_hash := md5(v_clean::text);

  IF TG_OP = 'INSERT' THEN
    NEW.imported_at := COALESCE(NEW.imported_at, now());
    IF NEW.process_errors IS NOT NULL AND NEW.last_error IS NULL THEN
      NEW.last_error := NEW.process_errors;
    END IF;
  ELSE
    NEW.updated_at := now();

    -- Quando o pipeline registra um NOVO erro, refletir o estado de forma
    -- verdadeira: contar a tentativa, guardar o ultimo erro e marcar
    -- failed (ou quarantined a partir de 5 tentativas, poison-pill).
    IF NEW.process_errors IS DISTINCT FROM OLD.process_errors
       AND NEW.process_errors IS NOT NULL THEN
      NEW.last_error := NEW.process_errors;
      NEW.attempts   := COALESCE(OLD.attempts, 0) + 1;
      IF NEW.status <> 'processed'::supplier_raw_status THEN
        NEW.status := CASE WHEN NEW.attempts >= 5
                           THEN 'quarantined'::supplier_raw_status
                           ELSE 'failed'::supplier_raw_status END;
      END IF;
    END IF;

    IF NEW.status = 'processed'::supplier_raw_status
       AND NEW.status IS DISTINCT FROM OLD.status THEN
      NEW.processed_at := COALESCE(NEW.processed_at, now());
    END IF;
  END IF;

  -- images_processed deixa de ser sincronizada aqui; vira coluna GERADA (Fase 2).

  RETURN NEW;
END $function$;

-- 2) Reconciliar as 499 linhas "processed com erro" -> estado verdadeiro.
--    São escritas na silver que falharam; voltam para a fila como 'failed'
--    (o motor reprocessa; se falhar 5x, o trigger as coloca em quarantined).
UPDATE public.supplier_products_raw
   SET status   = 'failed'::supplier_raw_status,
       attempts = GREATEST(attempts, 1)
 WHERE status = 'processed'::supplier_raw_status
   AND process_errors IS NOT NULL;

-- 3) Invariante: jamais 'processed' carregando erro de processamento.
ALTER TABLE public.supplier_products_raw
  ADD CONSTRAINT chk_spr_no_processed_with_errors
  CHECK (NOT (status = 'processed'::supplier_raw_status AND process_errors IS NOT NULL));
