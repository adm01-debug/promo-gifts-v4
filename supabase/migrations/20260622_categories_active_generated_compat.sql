-- ============================================================
-- categories.active — coluna gerada para compatibilidade retroativa
-- Data: 2026-06-22
--
-- CONTEXTO:
--   categories.active foi dropada em 20260622_drop_categories_active_legacy.sql.
--   A build em produção (c894b26e0, Vercel READY) ainda filtra por
--   active=eq.true → PostgREST retornava 400 Bad Request.
--   Builds novas estão bloqueadas (PR #1338 pendente).
--
-- SOLUÇÃO:
--   Recriar 'active' como GENERATED ALWAYS AS (is_active) STORED.
--   Leitura idêntica à antiga coluna, sem nenhum write manual.
--   Quando o PR #1338 fizer deploy, o código frontend migrará para
--   is_active; esta coluna gerada se tornará redundante mas inofensiva.
--
-- CLEANUP FUTURO:
--   Após deploy bem-sucedido do PR #1338, dropar com:
--   ALTER TABLE categories DROP COLUMN IF EXISTS active;
-- ============================================================

ALTER TABLE public.categories
  ADD COLUMN IF NOT EXISTS active boolean
    GENERATED ALWAYS AS (is_active) STORED;

-- Invariante: divergência deve ser sempre 0
DO $$
DECLARE
  v_divergencia integer;
BEGIN
  SELECT COUNT(*) INTO v_divergencia
  FROM public.categories
  WHERE active IS DISTINCT FROM is_active;

  IF v_divergencia > 0 THEN
    RAISE EXCEPTION 'BUG: categories.active diverge de is_active em % linhas', v_divergencia;
  END IF;
END $$;
