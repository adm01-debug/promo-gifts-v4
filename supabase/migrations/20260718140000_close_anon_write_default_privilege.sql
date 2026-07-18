-- APLICADO: 2026-07-18 (via MCP)
-- GAP #1 (P1): fechar a torneira — default privilege do role postgres em public.
--
-- PROBLEMA: toda tabela/function/sequence nova criada por postgres em public nascia
-- com INSERT/UPDATE/DELETE/EXECUTE para anon. As 231 tabelas com write para anon eram
-- SINTOMA: cada migration de revogação era enxugar o chão com a torneira aberta.
--
-- LIMITAÇÃO: Supabase Cloud não permite ALTER DEFAULT PRIVILEGES FOR ROLE
-- supabase_admin. Tabelas criadas pelo Dashboard mantêm o default antigo.
-- A fix completa requer ação manual no Dashboard (Settings > Database).
--
-- IMPACTO REAL: mitigado pela RLS (387/387 tabelas com RLS, nenhuma policy
-- irrestrita). Mas gera alertas no advisor e neutraliza migrations de revogação.
--
-- REGRESSÃO TESTADA: 6 RPCs públicas do catálogo continuam funcionando para anon
-- (grants existentes não são afetados, só objetos FUTUROS).

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  REVOKE INSERT, UPDATE, DELETE ON TABLES FROM anon;

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  REVOKE EXECUTE ON FUNCTIONS FROM anon;

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  REVOKE USAGE ON SEQUENCES FROM anon;
