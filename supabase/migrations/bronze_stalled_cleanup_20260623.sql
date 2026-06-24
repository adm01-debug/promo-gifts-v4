-- BRONZE STALLED CLEANUP (2026-06-23): 396 rows Bronze de Só Marcas
-- marcadas como skipped (range: 2026-02-26 a 2026-06-07).
-- 374/396 produtos já existem no Gold (redundantes).
-- Deadlocks no promote e fn_sm_stock_guard bloqueios como causa.
-- Aplicado em produção via SQL direto às ~18:40 UTC 2026-06-23.
SELECT 1; -- operação DML já aplicada diretamente
