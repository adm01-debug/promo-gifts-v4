-- ============================================================
-- MIGRAÇÃO CORRETIVA: security_advisors_remediation_rls_initplan
-- DATA:   2026-06-20
-- ORIGEM: Auditoria exaustiva (200 commits) — análise dos advisors
--         Supabase do projeto SSOT canônico doufsxqlfjyuvxuezpln
--         (ver CLAUDE.md REGRA #1).
--
-- Esta migration espelha EXATAMENTE o que já foi aplicado em produção
-- via apply_migration (schema_migrations version 20260620110923). É
-- IDEMPOTENTE — um replay limpo (branch novo / DR rebuild) reaplica sem
-- efeito colateral.
--
-- ESCOPO (apenas correções SEGURAS e behavior-preserving):
--
--   1. public.category_ancestors  [ERROR 0013 rls_disabled_in_public]
--      Tabela VIVA do catálogo (closure de categorias, ~1k linhas,
--      repopulada pelo cron 'refresh-category-ancestors' via TRUNCATE+INSERT
--      rodando como owner/postgres). Estava com RLS DESABILITADO e GRANTs
--      de INSERT/UPDATE/DELETE para o papel `anon` → qualquer visitante
--      não autenticado podia corromper a árvore de categorias pela Data API.
--      O frontend NUNCA lê esta tabela diretamente (apenas via funções/
--      views SECURITY DEFINER, que rodam como owner e ignoram RLS).
--      Correção: ENABLE RLS + policy de SELECT público (taxonomia é
--      pública e inofensiva) + REVOKE de escrita para anon/authenticated.
--
--   2. Tabelas de backup esquecidas em public.*  [ERROR 0013]
--      _backup_stock_daily_summary_20260618, _bkp_kit_dims_20260619,
--      _bkp_orphan_active_variants_20260619 — snapshots datados que
--      vazaram para o schema exposto. RLS desabilitado; dois deles com
--      DML anônimo aberto. Nada na aplicação os lê. Correção: ENABLE RLS
--      (sem policy = invisíveis na Data API) + REVOKE ALL anon/authenticated.
--      OBS: candidatos a DROP em manutenção futura.
--
--   3. auth_rls_initplan  [PERF 0003] — product_views, quote_history
--      Policies user-facing reavaliavam auth.uid() por linha. Reescrita
--      para (SELECT auth.uid()) — mesmo resultado, avaliado uma vez.
--      100% behavior-preserving.
--
-- NÃO incluído de propósito (ver docs/AUDITORIA_200_COMMITS_2026-06-20.md):
--   • 78 security_definer_view (ERROR 0010): são as views *_public do
--     Medallion (Gold), expostas ao anon por DESIGN. Trocar para
--     security_invoker quebraria o catálogo público.
--   • 168 unused_index / 131 unindexed_foreign_keys: quase todos falso-
--     positivo. Tabelas-alvo minúsculas (2–15 linhas → seqscan é ótimo) ou
--     já cobertas por índices parciais/compostos (product_images já tem
--     índice em product_id, variant_id, color_id, image_type_id,
--     canonical_image_id). Criar índices novos só adicionaria write-
--     amplification numa tabela quente de 146 MB sem ganho de leitura.
--   • 53 function_search_path_mutable / 264+46 secdef RPC executáveis /
--     exposição GraphQL: hardening em lote, requer revisão por-objeto.
-- ============================================================

-- 1) category_ancestors — fechar DML anônimo
ALTER TABLE public.category_ancestors ENABLE ROW LEVEL SECURITY;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.category_ancestors FROM anon, authenticated;
DROP POLICY IF EXISTS category_ancestors_public_read ON public.category_ancestors;
CREATE POLICY category_ancestors_public_read
  ON public.category_ancestors FOR SELECT TO anon, authenticated USING (true);

-- 2) Tabelas de backup esquecidas em public.* — remover da Data API
ALTER TABLE public._backup_stock_daily_summary_20260618   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public._bkp_kit_dims_20260619                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE public._bkp_orphan_active_variants_20260619   ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public._backup_stock_daily_summary_20260618 FROM anon, authenticated;
REVOKE ALL ON public._bkp_kit_dims_20260619               FROM anon, authenticated;
REVOKE ALL ON public._bkp_orphan_active_variants_20260619 FROM anon, authenticated;

-- 3) auth_rls_initplan — product_views (envolver auth.uid())
ALTER POLICY "Users can read own views" ON public.product_views
  USING (seller_id = (SELECT auth.uid()));
ALTER POLICY "Admins can read all views" ON public.product_views
  USING (has_role((SELECT auth.uid()), 'admin'::app_role));

-- 3) auth_rls_initplan — quote_history (envolver auth.uid())
ALTER POLICY "Sellers and coord view quote_history" ON public.quote_history
  USING (
    is_coord_or_above((SELECT auth.uid()))
    OR EXISTS (
      SELECT 1 FROM public.quotes q
      WHERE q.id = quote_history.quote_id
        AND (q.seller_id = (SELECT auth.uid())
             OR q.created_by = (SELECT auth.uid())
             OR q.assigned_to = (SELECT auth.uid()))
    )
  );
ALTER POLICY "Sellers and coord create quote_history" ON public.quote_history
  WITH CHECK (
    user_id = (SELECT auth.uid())
    AND (
      is_coord_or_above((SELECT auth.uid()))
      OR EXISTS (
        SELECT 1 FROM public.quotes q
        WHERE q.id = quote_history.quote_id
          AND (q.seller_id = (SELECT auth.uid())
               OR q.created_by = (SELECT auth.uid())
               OR q.assigned_to = (SELECT auth.uid()))
      )
    )
  );
