-- Onda 13 (B-3 da auditoria pre-prod, 10/mai/2026): fecha 2 audit logs publicamente legiveis.
--
-- CONTEXTO:
-- Auditoria profunda apontou que `audit_log_gravacao` e `seo_audit_log` tinham SELECT
-- liberado para qualquer usuario authenticated, expondo:
--   - `audit_log_gravacao`: usuario, valor_antes, valor_depois de mudancas em
--      tabela_preco_gravacao_oficial — vaza historico de precos e quem alterou.
--   - `seo_audit_log`: historico de auditorias SEO — info interna de melhorias.
--
-- INVESTIGACAO:
-- 1. Frontend (src/) NAO consulta nenhuma das 2 (code_search confirmou zero matches).
-- 2. Edge functions usam service_role que bypassa RLS, entao a mudanca eh transparente.
-- 3. Sao auditadas apenas via Supabase Dashboard pelo admin.
-- 4. Convencao: is_supervisor_or_above (alinhada com Ondas 5-10).
--
-- MUDANCA:
-- SELECT em ambas restrito a is_supervisor_or_above (dev, admin, supervisor, manager).
-- INSERT continua via triggers SECURITY DEFINER que bypassam RLS.
--
-- ESTADO DA B-3 APOS ESTA MIGRATION:
-- Auditoria pre-prod listou 7 tabelas overly-permissive. Estado final:
--   - audit_log: ja correta (supervisor_or_above) fechada antes
--   - analytics_events: ja correta (self ou coord) fechada antes
--   - product_views: ja correta (admin ou seller_id) fechada antes
--   - search_queries: ja correta (self ou coord) fechada antes
--   - quote_templates: ja correta (por created_by) fechada antes
--   - sync_jobs: tabela nao existe mais, N/A
--   - notification_templates: fechada em Onda 8 (PR #199)
--   - audit_log_gravacao (esta migration): supervisor_or_above
--   - seo_audit_log (esta migration): supervisor_or_above
-- B-3 ENCERRADA.
--
-- APLICADA EM PROD via MCP apply_migration (ADR 0006).
--
-- REPLAY: audit_log_gravacao e seo_audit_log foram criadas fora de migration
-- (out-of-band). Num replay limpo elas nao existem, entao cada bloco e guardado
-- por to_regclass(...) IS NOT NULL — no-op quando a tabela esta ausente, sem
-- alterar o comportamento em producao (onde as tabelas existem).

-- ─── audit_log_gravacao ───
DO $g$
BEGIN
  IF to_regclass('public.audit_log_gravacao') IS NOT NULL THEN
    DROP POLICY IF EXISTS audit_log_gravacao_read_authenticated ON public.audit_log_gravacao;
    DROP POLICY IF EXISTS audit_log_gravacao_select_supervisor_or_above ON public.audit_log_gravacao;

    CREATE POLICY audit_log_gravacao_select_supervisor_or_above
      ON public.audit_log_gravacao
      FOR SELECT
      TO authenticated
      USING ( is_supervisor_or_above((SELECT auth.uid())) );

    COMMENT ON POLICY audit_log_gravacao_select_supervisor_or_above ON public.audit_log_gravacao IS
      'Onda 13 (B-3): SELECT restrito a supervisor_or_above. Audit log de gravacao expoe usuario/valor_antes/depois e nao deve vazar para vendedores. Service_role (triggers SECDEF) continua bypassando.';
  END IF;
END $g$;

-- ─── seo_audit_log ───
DO $g$
BEGIN
  IF to_regclass('public.seo_audit_log') IS NOT NULL THEN
    DROP POLICY IF EXISTS auth_read_seo_audit_log ON public.seo_audit_log;
    DROP POLICY IF EXISTS seo_audit_log_select_supervisor_or_above ON public.seo_audit_log;

    CREATE POLICY seo_audit_log_select_supervisor_or_above
      ON public.seo_audit_log
      FOR SELECT
      TO authenticated
      USING ( is_supervisor_or_above((SELECT auth.uid())) );

    COMMENT ON POLICY seo_audit_log_select_supervisor_or_above ON public.seo_audit_log IS
      'Onda 13 (B-3): SELECT restrito a supervisor_or_above. Historico de auditoria SEO eh info operacional interna, nao deve ser legivel por vendedores.';
  END IF;
END $g$;
