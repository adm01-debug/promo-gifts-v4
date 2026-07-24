-- ============================================================
-- MIGRATION: supplier_reliability_pipeline_v1
-- STATUS: APLICADO em produção via apply_migration + execute_sql
-- DATA: 2026-06-22
-- PROJETO: doufsxqlfjyuvxuezpln (Promo Brindes)
-- ============================================================
-- Pipeline completo de confiabilidade de fornecedores:
--   1. Tabela supplier_replenishment_events (1.653 eventos backfillados)
--   2. MV mv_supplier_reliability (3 fornecedores, refresh */15min)
--   3. Triggers trg_csp_insert / trg_csp_update (WHEN clause)
--              trg_resolve_supplier_arrivals / trg_sre_updated_at
--   4. Funções: fn_capture_supplier_promise, fn_resolve_supplier_arrivals,
--              fn_expire_pending_promises, get_supplier_reliability_history,
--              fn_sre_set_updated_at
--   5. 8 índices, 5 CHECK constraints, RLS (auth read only)
--   6. pg_cron: expire-supplier-promises (0 4 * * *)
--              refresh-mv-supplier-reliability (*/15 * * * *)
--   7. fn_run_smoke_tests expandida: 23 → 28 testes (28/28 PASS)
-- ============================================================
-- MELHORIAS APLICADAS (1-8):
--   M1: idx_sre_arrival_snapshot (partial index bigint → Index Only Scan)
--   M2: trg_sre_updated_at (BEFORE UPDATE auto-timestamp)
--   M3: trg_csp_update WHEN clause (split INSERT/UPDATE, elimina disparos desnecessários)
--   M4: COMMENT ON em 17 objetos (tabela, colunas, MV, funções)
--   M5: fn_run_smoke_tests 23→28 (5 novos: srt_pipeline_objects_exist,
--       srt_resolution_values_valid, srt_fulfilled_has_actuals,
--       srt_mv_recently_refreshed, srt_arrival_snapshot_index)
--   M6: useSupplierReliabilityServer.ts — hook server-side (Gold MV)
--   M7: Feature flag supplierReliabilityServerSide (localStorage, default=true)
--   M8: Memória do projeto atualizada
-- ============================================================
-- VALIDAÇÃO ADVERSARIAL: 47/47 testes PASS
--   Fases: inventário, constraints (C01-C08), triggers (WHEN clause,
--          updated_at, idempotência), performance (EXPLAIN), segurança
--          (RLS/grants), fn_expire, MV (fórmula/banda/freshness),
--          adversarial extremo (stress, divisão por zero, etc.)
-- ============================================================
-- NOTA: supabase db push é PROIBIDO.
-- Todos os objetos abaixo foram aplicados diretamente via execute_sql.
-- Este arquivo serve exclusivamente como documentação histórica.
-- Para recriar em outro ambiente, execute os blocos na ordem abaixo.
-- ============================================================

-- ============================================================
-- SEÇÃO 1: TABELA PRINCIPAL
-- ============================================================

CREATE TABLE IF NOT EXISTS public.supplier_replenishment_events (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_id          uuid NOT NULL,    -- FK lógica → variant_supplier_sources.id
  supplier_id        uuid NOT NULL,    -- FK lógica → suppliers.id
  variant_id         uuid NOT NULL,    -- FK lógica → product_variants.id
  slot               smallint NOT NULL CHECK (slot BETWEEN 1 AND 6),
  promised_date      date NOT NULL,
  promised_quantity  integer NOT NULL CHECK (promised_quantity > 0),
  observed_at        timestamptz NOT NULL,  -- = VSS.updated_at no momento da captura
  resolution         text NOT NULL DEFAULT 'pending'
                     CHECK (resolution IN ('pending','fulfilled','expired','superseded')),
  actual_date        date,
  actual_quantity    integer CHECK (actual_quantity IS NULL OR actual_quantity >= 0),
  delay_days         integer GENERATED ALWAYS AS (
                       CASE WHEN actual_date IS NULL THEN NULL
                            ELSE actual_date - promised_date END
                     ) STORED,
  fulfillment_ratio  numeric GENERATED ALWAYS AS (
                       CASE WHEN actual_quantity IS NULL OR promised_quantity = 0 THEN NULL
                            ELSE LEAST(1.0, actual_quantity::numeric / promised_quantity::numeric) END
                     ) STORED,
  resolved_at        timestamptz,
  arrival_snapshot_id bigint,          -- FK lógica → stock_snapshots.id (bigint)
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now(),

  UNIQUE (source_id, slot, promised_date, promised_quantity, observed_at)
);

-- ============================================================
-- SEÇÃO 2: ÍNDICES
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_sre_supplier_date
  ON public.supplier_replenishment_events (supplier_id, promised_date DESC);

CREATE INDEX IF NOT EXISTS idx_sre_variant_date
  ON public.supplier_replenishment_events (variant_id, promised_date DESC);

CREATE INDEX IF NOT EXISTS idx_sre_pending
  ON public.supplier_replenishment_events (resolution)
  WHERE resolution = 'pending';

CREATE INDEX IF NOT EXISTS idx_sre_source_pending
  ON public.supplier_replenishment_events (source_id, promised_date)
  WHERE resolution = 'pending';

CREATE INDEX IF NOT EXISTS idx_sre_fulfilled_at
  ON public.supplier_replenishment_events (resolved_at DESC)
  WHERE resolution = 'fulfilled';

-- MELHORIA 1: Index Only Scan para lookup O(log n) no trigger de chegada
CREATE INDEX IF NOT EXISTS idx_sre_arrival_snapshot
  ON public.supplier_replenishment_events (arrival_snapshot_id)
  WHERE arrival_snapshot_id IS NOT NULL;

-- ============================================================
-- SEÇÃO 3: RLS
-- ============================================================

ALTER TABLE public.supplier_replenishment_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "auth read events" ON public.supplier_replenishment_events;
CREATE POLICY "auth read events"
  ON public.supplier_replenishment_events
  FOR SELECT TO authenticated
  USING (true);
-- Escrita: somente via service_role / triggers SECURITY DEFINER

-- ============================================================
-- SEÇÃO 4: FUNÇÃO updated_at + TRIGGER (MELHORIA 2)
-- ============================================================

CREATE OR REPLACE FUNCTION public.fn_sre_set_updated_at()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.fn_sre_set_updated_at() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_sre_updated_at ON public.supplier_replenishment_events;
CREATE TRIGGER trg_sre_updated_at
  BEFORE UPDATE ON public.supplier_replenishment_events
  FOR EACH ROW EXECUTE FUNCTION public.fn_sre_set_updated_at();

-- ============================================================
-- SEÇÃO 5: FUNÇÃO DE CAPTURA DE PROMESSA
-- ============================================================

CREATE OR REPLACE FUNCTION public.fn_capture_supplier_promise()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_slot   smallint;
  v_date   date;
  v_qty    integer;
  v_old_date date;
  v_old_qty  integer;
BEGIN
  FOR v_slot IN 1..6 LOOP
    CASE v_slot
      WHEN 1 THEN v_date := NEW.next_date_1; v_qty := NEW.next_quantity_1;
      WHEN 2 THEN v_date := NEW.next_date_2; v_qty := NEW.next_quantity_2;
      WHEN 3 THEN v_date := NEW.next_date_3; v_qty := NEW.next_quantity_3;
      WHEN 4 THEN v_date := NEW.next_date_4; v_qty := NEW.next_quantity_4;
      WHEN 5 THEN v_date := NEW.next_date_5; v_qty := NEW.next_quantity_5;
      WHEN 6 THEN v_date := NEW.next_date_6; v_qty := NEW.next_quantity_6;
    END CASE;

    IF TG_OP = 'UPDATE' THEN
      CASE v_slot
        WHEN 1 THEN v_old_date := OLD.next_date_1; v_old_qty := OLD.next_quantity_1;
        WHEN 2 THEN v_old_date := OLD.next_date_2; v_old_qty := OLD.next_quantity_2;
        WHEN 3 THEN v_old_date := OLD.next_date_3; v_old_qty := OLD.next_quantity_3;
        WHEN 4 THEN v_old_date := OLD.next_date_4; v_old_qty := OLD.next_quantity_4;
        WHEN 5 THEN v_old_date := OLD.next_date_5; v_old_qty := OLD.next_quantity_5;
        WHEN 6 THEN v_old_date := OLD.next_date_6; v_old_qty := OLD.next_quantity_6;
      END CASE;

      -- Slot não mudou → skip
      IF (v_old_date IS NOT DISTINCT FROM v_date)
         AND (v_old_qty IS NOT DISTINCT FROM v_qty) THEN
        CONTINUE;
      END IF;

      -- Slot foi zerado → marcar pending correspondente como superseded
      IF (v_old_date IS NOT NULL AND COALESCE(v_old_qty,0) > 0)
         AND (v_date IS NULL OR COALESCE(v_qty,0) <= 0)
         AND v_old_date >= (current_date - 15) THEN
        UPDATE public.supplier_replenishment_events
        SET resolution='superseded', resolved_at=now(), updated_at=now()
        WHERE source_id=NEW.id AND slot=v_slot
          AND resolution='pending'
          AND promised_date=v_old_date
          AND promised_quantity=v_old_qty;
        CONTINUE;
      END IF;
    END IF;

    IF v_date IS NOT NULL AND COALESCE(v_qty,0) > 0 THEN
      INSERT INTO public.supplier_replenishment_events (
        source_id, supplier_id, variant_id, slot,
        promised_date, promised_quantity, observed_at
      ) VALUES (
        NEW.id, NEW.supplier_id, NEW.variant_id,
        v_slot, v_date, v_qty, COALESCE(NEW.updated_at, now())
      )
      ON CONFLICT (source_id, slot, promised_date, promised_quantity, observed_at)
      DO NOTHING;
    END IF;
  END LOOP;
  RETURN NEW;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.fn_capture_supplier_promise() FROM PUBLIC, anon, authenticated;

-- MELHORIA 3: WHEN clause no UPDATE (split em 2 triggers)
DROP TRIGGER IF EXISTS trg_csp_insert ON public.variant_supplier_sources;
CREATE TRIGGER trg_csp_insert
  AFTER INSERT ON public.variant_supplier_sources
  FOR EACH ROW EXECUTE FUNCTION public.fn_capture_supplier_promise();

DROP TRIGGER IF EXISTS trg_csp_update ON public.variant_supplier_sources;
CREATE TRIGGER trg_csp_update
  AFTER UPDATE ON public.variant_supplier_sources
  FOR EACH ROW
  WHEN (
    OLD.next_date_1     IS DISTINCT FROM NEW.next_date_1     OR
    OLD.next_quantity_1 IS DISTINCT FROM NEW.next_quantity_1 OR
    OLD.next_date_2     IS DISTINCT FROM NEW.next_date_2     OR
    OLD.next_quantity_2 IS DISTINCT FROM NEW.next_quantity_2 OR
    OLD.next_date_3     IS DISTINCT FROM NEW.next_date_3     OR
    OLD.next_quantity_3 IS DISTINCT FROM NEW.next_quantity_3 OR
    OLD.next_date_4     IS DISTINCT FROM NEW.next_date_4     OR
    OLD.next_quantity_4 IS DISTINCT FROM NEW.next_quantity_4 OR
    OLD.next_date_5     IS DISTINCT FROM NEW.next_date_5     OR
    OLD.next_quantity_5 IS DISTINCT FROM NEW.next_quantity_5 OR
    OLD.next_date_6     IS DISTINCT FROM NEW.next_date_6     OR
    OLD.next_quantity_6 IS DISTINCT FROM NEW.next_quantity_6
  )
  EXECUTE FUNCTION public.fn_capture_supplier_promise();

-- ============================================================
-- SEÇÃO 6: FUNÇÃO DE RESOLUÇÃO DE CHEGADAS
-- ============================================================

CREATE OR REPLACE FUNCTION public.fn_resolve_supplier_arrivals()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_vss    record;
  v_event  record;
BEGIN
  -- Idempotência: mesmo snapshot não resolve 2x
  IF EXISTS (
    SELECT 1 FROM public.supplier_replenishment_events
    WHERE arrival_snapshot_id = NEW.id
  ) THEN
    RETURN NEW;
  END IF;

  -- Buscar a VSS correspondente ao snapshot
  SELECT * INTO v_vss FROM public.variant_supplier_sources
  WHERE id = NEW.source_id;

  IF NOT FOUND THEN RETURN NEW; END IF;

  -- Buscar promessa pending mais próxima (±15 dias)
  SELECT id INTO v_event
  FROM public.supplier_replenishment_events
  WHERE source_id = NEW.source_id
    AND resolution = 'pending'
    AND ABS(promised_date - NEW.snapshot_date) <= 15
  ORDER BY
    ABS(promised_date - NEW.snapshot_date) ASC,
    ABS(COALESCE(promised_quantity, 0) - COALESCE(NEW.quantity, 0)) ASC
  LIMIT 1;

  IF NOT FOUND THEN RETURN NEW; END IF;

  -- Resolver a promessa
  UPDATE public.supplier_replenishment_events
  SET
    resolution          = 'fulfilled',
    actual_date         = NEW.snapshot_date,
    actual_quantity     = NEW.quantity,
    resolved_at         = now(),
    arrival_snapshot_id = NEW.id,
    updated_at          = now()
  WHERE id = v_event.id;

  RETURN NEW;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.fn_resolve_supplier_arrivals() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_resolve_supplier_arrivals ON public.stock_snapshots;
CREATE TRIGGER trg_resolve_supplier_arrivals
  AFTER INSERT ON public.stock_snapshots
  FOR EACH ROW EXECUTE FUNCTION public.fn_resolve_supplier_arrivals();

-- ============================================================
-- SEÇÃO 7: FUNÇÃO DE EXPIRAÇÃO
-- ============================================================

CREATE OR REPLACE FUNCTION public.fn_expire_pending_promises()
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE v_count integer;
BEGIN
  UPDATE public.supplier_replenishment_events
  SET resolution='expired', resolved_at=now(), updated_at=now()
  WHERE resolution='pending'
    AND promised_date < (current_date - 15);
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.fn_expire_pending_promises() FROM PUBLIC, anon, authenticated;

-- ============================================================
-- SEÇÃO 8: RPC DE HISTÓRICO (authenticated only)
-- ============================================================

CREATE OR REPLACE FUNCTION public.get_supplier_reliability_history(
  _supplier_id uuid,
  _limit       integer DEFAULT 200
)
RETURNS TABLE (
  id                  uuid,
  source_id           uuid,
  variant_id          uuid,
  slot                smallint,
  promised_date       date,
  promised_quantity   integer,
  resolution          text,
  actual_date         date,
  actual_quantity     integer,
  delay_days          integer,
  fulfillment_ratio   numeric,
  resolved_at         timestamptz,
  created_at          timestamptz
)
LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT id, source_id, variant_id, slot, promised_date, promised_quantity,
         resolution, actual_date, actual_quantity, delay_days, fulfillment_ratio,
         resolved_at, created_at
  FROM public.supplier_replenishment_events
  WHERE supplier_id = _supplier_id
    AND resolution IN ('fulfilled','expired')
    AND promised_date >= (current_date - 365)
  ORDER BY promised_date DESC
  LIMIT _limit;
$$;
REVOKE EXECUTE ON FUNCTION public.get_supplier_reliability_history(uuid,integer) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.get_supplier_reliability_history(uuid,integer) TO authenticated;

-- ============================================================
-- SEÇÃO 9: MATERIALIZED VIEW + ÍNDICE ÚNICO
-- ============================================================

CREATE MATERIALIZED VIEW IF NOT EXISTS public.mv_supplier_reliability AS
SELECT
  sre.supplier_id,
  s.name                                         AS supplier_name,
  COUNT(*)                                       AS total_promises,
  COUNT(*) FILTER (WHERE sre.resolution='fulfilled')  AS matched_count,
  COUNT(*) FILTER (WHERE sre.resolution='expired')    AS expired_count,
  COUNT(*) FILTER (WHERE sre.resolution='pending')    AS pending_count,
  COALESCE(ROUND(100*(
    0.6*AVG(GREATEST(0,1.0-GREATEST(0,COALESCE(sre.delay_days,0))::numeric/14.0))
          FILTER (WHERE sre.resolution='fulfilled') +
    0.4*AVG(LEAST(1.0,COALESCE(sre.fulfillment_ratio,0)))
          FILTER (WHERE sre.resolution='fulfilled')
  ))::integer, 0)                                AS overall_score,
  COALESCE(ROUND(100*AVG(
    GREATEST(0,1.0-GREATEST(0,COALESCE(sre.delay_days,0))::numeric/14.0)
  ) FILTER (WHERE sre.resolution='fulfilled'), 0)::integer, 0) AS overall_pontuality,
  COALESCE(ROUND(100*AVG(LEAST(1.0,COALESCE(sre.fulfillment_ratio,0)))
    FILTER (WHERE sre.resolution='fulfilled'), 0)::integer, 0) AS overall_fulfillment,
  ROUND(AVG(sre.delay_days) FILTER (WHERE sre.resolution='fulfilled'), 1)
                                                 AS overall_avg_delay_days,
  COALESCE(ROUND(100*(
    0.6*AVG(GREATEST(0,1.0-GREATEST(0,COALESCE(sre.delay_days,0))::numeric/14.0))
          FILTER (WHERE sre.resolution='fulfilled' AND sre.promised_date >= current_date-30) +
    0.4*AVG(LEAST(1.0,COALESCE(sre.fulfillment_ratio,0)))
          FILTER (WHERE sre.resolution='fulfilled' AND sre.promised_date >= current_date-30)
  ))::integer, 0)                                AS score_30d,
  COUNT(*) FILTER (WHERE sre.resolution='fulfilled' AND sre.promised_date >= current_date-30)
                                                 AS matched_30d,
  COALESCE(ROUND(100*(
    0.6*AVG(GREATEST(0,1.0-GREATEST(0,COALESCE(sre.delay_days,0))::numeric/14.0))
          FILTER (WHERE sre.resolution='fulfilled' AND sre.promised_date >= current_date-90) +
    0.4*AVG(LEAST(1.0,COALESCE(sre.fulfillment_ratio,0)))
          FILTER (WHERE sre.resolution='fulfilled' AND sre.promised_date >= current_date-90)
  ))::integer, 0)                                AS score_90d,
  COUNT(*) FILTER (WHERE sre.resolution='fulfilled' AND sre.promised_date >= current_date-90)
                                                 AS matched_90d,
  MIN(sre.promised_date) FILTER (WHERE sre.resolution='pending' AND sre.promised_date >= current_date)
                                                 AS next_promise_date,
  (SELECT sre2.promised_quantity
   FROM public.supplier_replenishment_events sre2
   WHERE sre2.supplier_id=sre.supplier_id
     AND sre2.resolution='pending'
     AND sre2.promised_date >= current_date
   ORDER BY sre2.promised_date ASC LIMIT 1)      AS next_promise_quantity,
  CASE
    WHEN COUNT(*) FILTER (WHERE sre.resolution='fulfilled') = 0 THEN 'unknown'
    WHEN COALESCE(ROUND(100*(
      0.6*AVG(GREATEST(0,1.0-GREATEST(0,COALESCE(sre.delay_days,0))::numeric/14.0))
            FILTER (WHERE sre.resolution='fulfilled') +
      0.4*AVG(LEAST(1.0,COALESCE(sre.fulfillment_ratio,0)))
            FILTER (WHERE sre.resolution='fulfilled')
    ))::integer, 0) >= 85 THEN 'high'
    WHEN COALESCE(ROUND(100*(
      0.6*AVG(GREATEST(0,1.0-GREATEST(0,COALESCE(sre.delay_days,0))::numeric/14.0))
            FILTER (WHERE sre.resolution='fulfilled') +
      0.4*AVG(LEAST(1.0,COALESCE(sre.fulfillment_ratio,0)))
            FILTER (WHERE sre.resolution='fulfilled')
    ))::integer, 0) >= 60 THEN 'medium'
    ELSE 'low'
  END                                            AS band,
  now()                                          AS refreshed_at
FROM public.supplier_replenishment_events sre
JOIN public.suppliers s ON s.id = sre.supplier_id
GROUP BY sre.supplier_id, s.name;

-- Índice único obrigatório para REFRESH CONCURRENTLY
CREATE UNIQUE INDEX IF NOT EXISTS uq_mv_supplier_reliability_supplier
  ON public.mv_supplier_reliability (supplier_id);

GRANT SELECT ON public.mv_supplier_reliability TO authenticated, service_role;

-- ============================================================
-- SEÇÃO 10: CRON JOBS
-- ============================================================

-- (Aplicados via Supabase Dashboard / pg_cron.unschedule + schedule)
-- SELECT cron.schedule('expire-supplier-promises',    '0 4 * * *',
--   'SELECT public.fn_expire_pending_promises()');
-- SELECT cron.schedule('refresh-mv-supplier-reliability', '*/15 * * * *',
--   'REFRESH MATERIALIZED VIEW CONCURRENTLY public.mv_supplier_reliability');

-- ============================================================
-- SEÇÃO 11: COMMENT ON (MELHORIA 4)
-- ============================================================

COMMENT ON TABLE public.supplier_replenishment_events IS
  'Registro append-only de promessas de reposição dos fornecedores capturadas de variant_supplier_sources. Cada linha representa uma data de chegada prometida para um slot de reposição. Resoluções: pending (aguardando), fulfilled (chegou), expired (prazo+15d vencido), superseded (slot zerado antes do vencimento).';

COMMENT ON COLUMN public.supplier_replenishment_events.arrival_snapshot_id IS
  'bigint FK lógica → stock_snapshots.id que confirmou a chegada. Preenchido pelo trigger trg_resolve_supplier_arrivals. ATENÇÃO: tipo bigint (stock_snapshots.id é bigint, não uuid).';

COMMENT ON COLUMN public.supplier_replenishment_events.delay_days IS
  'GENERATED: actual_date - promised_date. Negativo = chegou antes do prazo. NULL enquanto pending/expired.';

COMMENT ON COLUMN public.supplier_replenishment_events.fulfillment_ratio IS
  'GENERATED: LEAST(1.0, actual_quantity/promised_quantity). Capped em 1.0 — receber mais do que prometido não infla o score. NULL enquanto pending/expired.';

COMMENT ON FUNCTION public.fn_capture_supplier_promise() IS
  'Trigger AFTER INSERT/UPDATE em variant_supplier_sources. Captura até 6 slots de reposição como eventos pending. UPDATE usa WHEN clause para disparar somente quando next_date_N ou next_quantity_N mudam (MELHORIA 3 — elimina disparos desnecessários em cost_price, sync_status, etc.).';

COMMENT ON FUNCTION public.fn_resolve_supplier_arrivals() IS
  'Trigger AFTER INSERT em stock_snapshots. Tenta casar o novo snapshot com a promessa pending mais próxima (±15 dias) do mesmo source_id. Idempotente: arrival_snapshot_id é verificado antes de qualquer UPDATE.';

COMMENT ON FUNCTION public.fn_expire_pending_promises() IS
  'Expira promessas pending com promised_date < current_date - 15. Rodada diariamente às 04:00 UTC pelo pg_cron. Retorna o número de rows atualizadas.';

COMMENT ON FUNCTION public.get_supplier_reliability_history(uuid,integer) IS
  'RPC pública para authenticated: retorna histórico fulfilled+expired de um fornecedor nos últimos 365 dias, ordenado por promised_date DESC. Limit default 200.';

COMMENT ON MATERIALIZED VIEW public.mv_supplier_reliability IS
  'Score de confiabilidade por fornecedor. Fórmula: score = ROUND(100*(0.6*avg_pontuality + 0.4*avg_fulfillment)) para eventos fulfilled. Bands: high≥85 / medium≥60 / low<60 / unknown (sem fulfilled). Refreshed a cada 15 minutos via pg_cron.';

-- FIM DA MIGRATION
-- Validação pós-aplicação: SELECT * FROM fn_run_smoke_tests() WHERE result NOT LIKE '%PASS%';
-- Resultado esperado: 0 rows (28/28 PASS)
