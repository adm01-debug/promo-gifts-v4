-- =============================================================================
-- APLICADO em 2026-06-21 via Supabase MCP (apply_migration).
-- Este arquivo é o REGISTRO da migration já executada em produção.
-- Projeto: doufsxqlfjyuvxuezpln (sa-east-1)
-- =============================================================================
--
-- CONTEXTO / CAUSA RAIZ
-- A migration 20260621100100_faxina_restore_active_tables_from_archive.sql
-- restaurou de archive→public apenas as tabelas com referência .from() detectadas
-- por um scan de código. Esse scan teve DOIS pontos cegos:
--   1) Deixou custom_kits e kit_comments em archive MESMO tendo .from() ativo:
--        • custom_kits   → 10 arquivos: useCustomKitPersistence, useKitAutoSave,
--          useGlobalSearch, KitLibraryPage, useDuplicateKitDetector, RecentKitsWidget,
--          KitHealthCard, KitSmartSuggestions, etc.
--        • kit_comments  → useKitComments faz SELECT/INSERT/UPDATE
--      Resultado: 404 PGRST205 ao abrir/salvar kit e ao comentar (mesma classe do
--      bug de expert_conversations).
--   2) O critério ".from() apenas" não cobre tabelas referenciadas SÓ via realtime
--      (.channel().on('postgres_changes',{table})). Ver nota no fim do arquivo.
--
-- ESCOPO DESTA MIGRATION
-- Restaura a família kit-builder como UNIDADE COESA DE FK:
--   custom_kits (parent) + kit_comments + kit_variants + kit_share_tokens
-- kit_collaborators e kit_templates já estavam em public.
-- Deixar dependentes em archive com o parent em public criaria FK cross-schema
-- archive→public. Mover custom_kits p/ public também CORRIGE a FK cross-schema
-- public.kit_collaborators → archive.custom_kits (a constraint segue a tabela por OID).
--
-- SEGURANÇA
-- Todas as 4 tabelas já tinham RLS habilitado com policies owner-scoped
-- (custom_kits: ck_*_own_or_coord; kit_comments: owner/collab; kit_variants: owner;
-- kit_share_tokens: sellers own). Por isso GRANT full DML a authenticated é seguro:
-- o RLS filtra as linhas por dono.
-- =============================================================================

DO $$
DECLARE
  tbl text;
  kit_tables text[] := ARRAY['custom_kits','kit_comments','kit_variants','kit_share_tokens'];
BEGIN
  -- 1) Parent primeiro (custom_kits → FK só p/ auth.users)
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='archive' AND table_name='custom_kits') THEN
    EXECUTE 'ALTER TABLE archive.custom_kits SET SCHEMA public';
  END IF;
  -- 2) Dependentes (FK -> custom_kits)
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='archive' AND table_name='kit_comments') THEN
    EXECUTE 'ALTER TABLE archive.kit_comments SET SCHEMA public';
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='archive' AND table_name='kit_variants') THEN
    EXECUTE 'ALTER TABLE archive.kit_variants SET SCHEMA public';
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='archive' AND table_name='kit_share_tokens') THEN
    EXECUTE 'ALTER TABLE archive.kit_share_tokens SET SCHEMA public';
  END IF;

  -- 3) RLS + grants padrão (idempotente). RLS já estava on; policies seguem no SET SCHEMA.
  FOREACH tbl IN ARRAY kit_tables LOOP
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name=tbl) THEN
      EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', tbl);
      EXECUTE format('REVOKE ALL ON public.%I FROM anon', tbl);
      EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON public.%I TO authenticated', tbl);
      EXECUTE format('GRANT ALL ON public.%I TO service_role', tbl);
    END IF;
  END LOOP;
END $$;

-- 4) Realtime: custom_kits (useCustomKitsRealtime) e kit_comments (useKitComments) assinam postgres_changes
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND schemaname='public' AND tablename='custom_kits') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.custom_kits;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND schemaname='public' AND tablename='kit_comments') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.kit_comments;
  END IF;
END $$;

-- 5) Recarrega o cache de schema do PostgREST
NOTIFY pgrst, 'reload schema';

-- =============================================================================
-- VERIFICAÇÃO PÓS-APLICAÇÃO (todas PASS)
--   • 4 tabelas em public + RLS on
--   • authenticated com DML completo; anon revogado
--   • FK kit_collaborators → public.custom_kits (cross-schema landmine resolvido)
--   • realtime publication inclui custom_kits + kit_comments
--   • zero FK cross-schema public→archive restantes
--   • queries .from() reproduzidas sem PGRST205
--
-- PENDÊNCIA P/ ARQUITETO (NÃO aplicada aqui — fora de escopo):
--   usePushNotifications assina realtime em notifications, device_login_notifications
--   (ambas só em archive). Como o hook é realtime-only (sem .from()), NÃO há 404 REST;
--   com o tópico único já aplicado, a falha é graciosa (CHANNEL_ERROR → warn). Suspeita
--   de que foram substituídas por workspace_notifications (já em public+realtime).
--   Decisão de restaurar/remover essas tabelas e o listener fica para o arquiteto.
-- =============================================================================
