-- =============================================================
-- TELEMETRIA — registro de hits do kill-switch (front + back)
--
-- Permite responder perguntas como:
--   - Quantas chamadas ao external-db-bridge foram bloqueadas?
--   - De quais origens (componentes/páginas) vinham as chamadas?
--   - Em que momento posso desligar o switch sem quebrar UX?
--
-- Tabela enxuta: sem PII, retention curta (rotação semanal).
-- =============================================================

CREATE TABLE IF NOT EXISTS public.kill_switch_hits (
  id         bigserial PRIMARY KEY,
  switch_name text NOT NULL,
  source     text NOT NULL CHECK (source IN ('front', 'back')),
  operation  text,                     -- 'select', 'rpc:fn_x', 'invoke', etc.
  target     text,                     -- nome da tabela/rpc alvo
  origin     text,                     -- URL/rota do front (sem query string)
  user_role  text DEFAULT 'anon',      -- 'anon', 'authenticated', 'admin'
  occurred_at timestamptz NOT NULL DEFAULT now()
);

-- Índice para consultas agregadas por janela
CREATE INDEX IF NOT EXISTS idx_kill_switch_hits_occurred_at
  ON public.kill_switch_hits (occurred_at DESC);

CREATE INDEX IF NOT EXISTS idx_kill_switch_hits_switch_source
  ON public.kill_switch_hits (switch_name, source, occurred_at DESC);

-- RLS: anon e authenticated podem INSERT (telemetria), só admin lê
ALTER TABLE public.kill_switch_hits ENABLE ROW LEVEL SECURITY;

CREATE POLICY kill_switch_hits_insert_all
  ON public.kill_switch_hits FOR INSERT
  TO anon, authenticated, service_role
  WITH CHECK (true);

CREATE POLICY kill_switch_hits_read_admin
  ON public.kill_switch_hits FOR SELECT
  TO authenticated
  USING (is_admin_or_above((SELECT auth.uid())));

CREATE POLICY kill_switch_hits_delete_admin
  ON public.kill_switch_hits FOR DELETE
  TO authenticated
  USING (is_admin_or_above((SELECT auth.uid())));

-- GRANT mínimo (RLS faz o resto)
GRANT INSERT ON public.kill_switch_hits TO anon;
GRANT INSERT ON public.kill_switch_hits TO authenticated;
GRANT SELECT, DELETE ON public.kill_switch_hits TO authenticated;
GRANT USAGE, SELECT ON SEQUENCE public.kill_switch_hits_id_seq TO anon, authenticated;

-- View de resumo para o admin dashboard (joins prontos)
CREATE OR REPLACE VIEW public.v_kill_switch_hits_summary AS
SELECT
  switch_name,
  source,
  operation,
  target,
  count(*)                                              AS hits,
  count(*) FILTER (WHERE occurred_at > now() - interval '1 hour')  AS hits_1h,
  count(*) FILTER (WHERE occurred_at > now() - interval '24 hours') AS hits_24h,
  count(*) FILTER (WHERE occurred_at > now() - interval '7 days')   AS hits_7d,
  max(occurred_at)                                      AS last_hit
FROM public.kill_switch_hits
WHERE occurred_at > now() - interval '30 days'
GROUP BY switch_name, source, operation, target;

GRANT SELECT ON public.v_kill_switch_hits_summary TO authenticated;

COMMENT ON TABLE public.kill_switch_hits IS
'Telemetria de hits do kill-switch (front-end e back-end). Sem PII.
Permite decidir quando é seguro desligar definitivamente uma função descontinuada.
Rotação semanal via cron — ver kill_switch_hits_purge_weekly.';

-- Rotação semanal (mantém últimos 30d, mesma janela da view)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'kill_switch_hits_purge_weekly') THEN
    PERFORM cron.schedule(
      'kill_switch_hits_purge_weekly',
      '0 4 * * 0',  -- domingo 04h UTC
      $cron$
        DELETE FROM public.kill_switch_hits
        WHERE occurred_at < now() - interval '30 days';
      $cron$
    );
  END IF;
END $$;
