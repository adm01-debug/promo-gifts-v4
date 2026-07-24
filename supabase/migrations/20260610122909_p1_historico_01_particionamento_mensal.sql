-- P1: Particionamento do histórico do Bronze (5 GB / 3,18M linhas; purga via
-- DELETE em tabela única = bloat permanente). Estratégia de corte por rename:
--   • tabela atual -> supplier_products_raw_history_legacy (purgável por DELETE
--     até esvaziar; depois DROP manual)
--   • novo supplier_products_raw_history PARTITION BY RANGE(captured_at),
--     partições mensais, purga por DROP PARTITION (instantânea, sem bloat)
-- O trigger trg_spr_history insere pelo nome — passa a alimentar a particionada.
-- Sem FKs no histórico novo: trilha de auditoria deve sobreviver à origem.

ALTER TABLE public.supplier_products_raw_history
  RENAME TO supplier_products_raw_history_legacy;

CREATE TABLE public.supplier_products_raw_history (
  id                 uuid        NOT NULL DEFAULT gen_random_uuid(),
  raw_id             uuid,
  supplier_id        uuid,
  supplier_reference varchar,
  content_hash       text,
  raw_data           jsonb,
  captured_at        timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (id, captured_at)
) PARTITION BY RANGE (captured_at);

COMMENT ON TABLE public.supplier_products_raw_history IS
  'Versões anteriores de raw_data quando content_hash canônico muda (trg_spr_history). Particionada por mês; retenção via DROP PARTITION em fn_purge_spr_history. Legado pré-2026-06-10 em supplier_products_raw_history_legacy.';

CREATE INDEX idx_sprh_raw_captured ON public.supplier_products_raw_history (raw_id, captured_at DESC);

CREATE TABLE public.supplier_products_raw_history_p2026_06 PARTITION OF public.supplier_products_raw_history
  FOR VALUES FROM ('2026-06-01') TO ('2026-07-01');
CREATE TABLE public.supplier_products_raw_history_p2026_07 PARTITION OF public.supplier_products_raw_history
  FOR VALUES FROM ('2026-07-01') TO ('2026-08-01');
CREATE TABLE public.supplier_products_raw_history_p2026_08 PARTITION OF public.supplier_products_raw_history
  FOR VALUES FROM ('2026-08-01') TO ('2026-09-01');
CREATE TABLE public.supplier_products_raw_history_p2026_09 PARTITION OF public.supplier_products_raw_history
  FOR VALUES FROM ('2026-09-01') TO ('2026-10-01');
CREATE TABLE public.supplier_products_raw_history_p2026_10 PARTITION OF public.supplier_products_raw_history
  FOR VALUES FROM ('2026-10-01') TO ('2026-11-01');

ALTER TABLE public.supplier_products_raw_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY hist_all_service ON public.supplier_products_raw_history
  FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY hist_select_admin ON public.supplier_products_raw_history
  FOR SELECT TO authenticated USING (is_admin_or_above((SELECT auth.uid())));

REVOKE ALL ON public.supplier_products_raw_history FROM anon;
GRANT SELECT ON public.supplier_products_raw_history TO authenticated;
GRANT ALL    ON public.supplier_products_raw_history TO service_role;
REVOKE ALL ON public.supplier_products_raw_history_legacy FROM anon;

DROP FUNCTION IF EXISTS public.fn_purge_spr_history(integer);

CREATE FUNCTION public.fn_purge_spr_history(p_keep_days integer DEFAULT 90)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_cutoff   timestamptz := now() - make_interval(days => p_keep_days);
  v_deleted  integer := 0;
  v_n        integer;
  r          RECORD;
  v_m        date;
  v_nome     text;
BEGIN
  FOR r IN
    SELECT c.oid::regclass::text AS part,
           (regexp_match(pg_get_expr(c.relpartbound, c.oid),
                         'TO \(''([^'']+)''\)'))[1]::timestamptz AS ub
    FROM pg_inherits i
    JOIN pg_class c ON c.oid = i.inhrelid
    WHERE i.inhparent = 'public.supplier_products_raw_history'::regclass
  LOOP
    IF r.ub IS NOT NULL AND r.ub <= v_cutoff THEN
      EXECUTE format('DROP TABLE %s', r.part);
    END IF;
  END LOOP;

  IF to_regclass('public.supplier_products_raw_history_legacy') IS NOT NULL THEN
    DELETE FROM public.supplier_products_raw_history_legacy
     WHERE captured_at < v_cutoff;
    GET DIAGNOSTICS v_n = ROW_COUNT;
    v_deleted := v_deleted + v_n;
  END IF;

  FOR i IN 0..3 LOOP
    v_m := (date_trunc('month', now()) + (i || ' months')::interval)::date;
    v_nome := 'supplier_products_raw_history_p' || to_char(v_m, 'YYYY_MM');
    IF to_regclass('public.'||v_nome) IS NULL THEN
      EXECUTE format(
        'CREATE TABLE public.%I PARTITION OF public.supplier_products_raw_history FOR VALUES FROM (%L) TO (%L)',
        v_nome, v_m, (v_m + interval '1 month')::date);
    END IF;
  END LOOP;

  RETURN v_deleted;
END $$;

REVOKE ALL ON FUNCTION public.fn_purge_spr_history(integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.fn_purge_spr_history(integer) TO service_role;
