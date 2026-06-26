-- 20260626120000_add_ordem_exibicao_tabela_preco_gravacao_oficial.sql
--
-- Fix: PostgREST 400 (Bad Request) on
--   GET /rest/v1/tabela_preco_gravacao_oficial?select=*&order=ordem_exibicao.asc&offset=0&limit=200
--
-- ROOT CAUSE
--   The frontend reads this table through the bridge alias 'tecnica_gravacao'
--   (src/lib/db/postgrest.ts -> BRIDGE_ALIASES: tecnica_gravacao -> tabela_preco_gravacao_oficial)
--   in two call sites that ORDER BY ordem_exibicao:
--     - src/hooks/tecnicas/useTecnicasList.ts::fetchTecnicasExterno   (orderBy ordem_exibicao, limit 200)  <- request in the console log
--     - src/lib/external-db/techniques.ts::fetchPromobrindTechniques  (orderBy ordem_exibicao, limit 100)
--   ordem_exibicao existed ONLY on the sibling catalog table tecnicas_gravacao, so Postgres raised
--   42703 (undefined_column) and PostgREST returned HTTP 400.
--
-- FIX
--   Add ordem_exibicao to tabela_preco_gravacao_oficial, mirroring tecnicas_gravacao.ordem_exibicao
--   (integer DEFAULT 99). Backfill a deterministic display order by codigo_tabela so ORDER BY is
--   stable across paginated requests. Purely additive; regression-proof against the recurring
--   reintroduction of .order('ordem_exibicao') by the Lovable bot.
--
-- Idempotent (guarded by pg_attribute existence check). Applied to production 2026-06-26.

DO $mig$
DECLARE
  v_exists boolean;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM pg_attribute
    WHERE attrelid = 'public.tabela_preco_gravacao_oficial'::regclass
      AND attname = 'ordem_exibicao'
      AND NOT attisdropped
  ) INTO v_exists;

  IF NOT v_exists THEN
    ALTER TABLE public.tabela_preco_gravacao_oficial
      ADD COLUMN ordem_exibicao integer NOT NULL DEFAULT 99;

    WITH ranked AS (
      SELECT id, row_number() OVER (ORDER BY codigo_tabela, id) AS rn
      FROM public.tabela_preco_gravacao_oficial
    )
    UPDATE public.tabela_preco_gravacao_oficial t
    SET ordem_exibicao = r.rn
    FROM ranked r
    WHERE r.id = t.id;

    COMMENT ON COLUMN public.tabela_preco_gravacao_oficial.ordem_exibicao IS
      'ANTI-REGRESSION (fix 2026-06-26): display order for the technique-list UI. Frontend reads this table via bridge alias tecnica_gravacao (dbInvoke BRIDGE_ALIASES) and ORDERs BY ordem_exibicao; column previously existed only on tecnicas_gravacao, causing PostgREST 400 (42703). Mirrors tecnicas_gravacao.ordem_exibicao (integer default 99). DO NOT DROP.';
  END IF;
END
$mig$;

-- Critical: refresh PostgREST schema cache so the new column is queryable immediately.
NOTIFY pgrst, 'reload schema';
