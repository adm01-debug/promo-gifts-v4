-- APLICADO: 2026-07-18 (via MCP)
-- GAP #1 (P1): fechar a torneira — default privilege do role postgres em public.
--
-- PROBLEMA: toda tabela nova criada por postgres nascia com INSERT/UPDATE/DELETE
-- para anon. As 231 tabelas com write para anon são SINTOMA desta causa raiz.
--
-- O QUE FUNCIONA:
-- - Tabelas: anon perde INSERT/UPDATE/DELETE em tabelas futuras ✅ (testado)
-- - Sequences: anon perde USAGE em sequences futuras ✅
--
-- O QUE NÃO FUNCIONA (limitação do PostgreSQL):
-- - Functions: ALTER DEFAULT PRIVILEGES ... REVOKE EXECUTE FROM PUBLIC NÃO remove
--   o default global de EXECUTE do pg_catalog. Toda function nova recebe =X (PUBLIC).
--   Para fechar functions seria necessário um EVENT TRIGGER em CREATE FUNCTION.
--   As 530 SECURITY DEFINER existentes já estão 520/530 sem anon (auditado).
--
-- LIMITAÇÃO DE PLATAFORMA:
-- - supabase_admin: não é alterável via SQL. Tabelas criadas pelo Dashboard mantêm
--   o default antigo. Fix requer Settings → Database no painel Supabase.
--
-- REGRESSÃO TESTADA: 6/6 RPCs públicas do catálogo continuam funcionando para anon.

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  REVOKE INSERT, UPDATE, DELETE ON TABLES FROM anon;

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  REVOKE USAGE ON SEQUENCES FROM anon;
