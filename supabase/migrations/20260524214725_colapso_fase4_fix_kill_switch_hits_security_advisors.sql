-- =============================================================
-- FIX dos 2 advisors introduzidos pelos migrations de telemetria:
--
-- 1) ERROR: v_kill_switch_hits_summary com SECURITY DEFINER
--    → Recriar como SECURITY INVOKER (default seguro)
--
-- 2) WARN: kill_switch_hits_insert_all com WITH CHECK (true)
--    → Adicionar validação que limita o que pode ser inserido
-- =============================================================

-- ============ FIX 1: SECURITY INVOKER na view ============
DROP VIEW IF EXISTS public.v_kill_switch_hits_summary;

CREATE VIEW public.v_kill_switch_hits_summary
WITH (security_invoker = on) AS
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

COMMENT ON VIEW public.v_kill_switch_hits_summary IS
'Resumo de kill_switch_hits. SECURITY INVOKER: respeita RLS do caller.';

-- ============ FIX 2: WITH CHECK validado ============
DROP POLICY IF EXISTS kill_switch_hits_insert_all ON public.kill_switch_hits;

CREATE POLICY kill_switch_hits_insert_validated
  ON public.kill_switch_hits FOR INSERT
  TO anon, authenticated, service_role
  WITH CHECK (
    -- Switch_name não pode ser vazio nem desconhecido
    switch_name IS NOT NULL
    AND length(switch_name) BETWEEN 3 AND 100
    -- Source obrigatório e enum-like (check constraint já garante front|back)
    AND source IS NOT NULL
    -- occurred_at não pode ser no futuro (defesa contra clock drift / abuse)
    AND occurred_at <= now() + interval '5 minutes'
    -- E não pode ser muito antigo (defesa contra spam retroativo)
    AND occurred_at >= now() - interval '1 hour'
    -- Origin tem limite de tamanho (defesa anti-bloat)
    AND (origin IS NULL OR length(origin) <= 500)
    -- Operation/target idem
    AND (operation IS NULL OR length(operation) <= 200)
    AND (target IS NULL OR length(target) <= 200)
  );

COMMENT ON POLICY kill_switch_hits_insert_validated ON public.kill_switch_hits IS
'INSERT permitido com validações: tamanhos limitados, occurred_at no janela ±1h, switch_name não vazio.
Previne abuso/spam por clientes anônimos.';
