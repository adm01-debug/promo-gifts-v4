-- ============================================================================
-- ETAPA 18 — Políticas de SELECT para tabelas adicionadas ao
-- REST_NATIVE_SAFE_TABLES (read whitelist): kit_component_media,
-- kit_component_print_areas, product_tags.
--
-- Contexto: o external-db-bridge usava service_role, contornando RLS.
-- Com a migração para REST nativo, queries vêm do cliente com anon/authenticated
-- key — logo RLS é aplicada. Sem policy de SELECT, anon/authenticated recebem
-- array vazio silencioso.
-- Idempotente via DO $$ IF NOT EXISTS.
-- ============================================================================

DO $$
BEGIN
  -- kit_component_media
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'kit_component_media'
      AND policyname = 'kit_component_media_select_public'
  ) THEN
    IF EXISTS (
      SELECT 1 FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = 'kit_component_media'
    ) THEN
      CREATE POLICY "kit_component_media_select_public"
        ON public.kit_component_media FOR SELECT TO anon, authenticated USING (true);
      RAISE NOTICE 'Created policy kit_component_media_select_public';
    ELSE
      RAISE NOTICE 'Table kit_component_media not found — skipping policy';
    END IF;
  END IF;

  -- kit_component_print_areas
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'kit_component_print_areas'
      AND policyname = 'kit_component_print_areas_select_public'
  ) THEN
    IF EXISTS (
      SELECT 1 FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = 'kit_component_print_areas'
    ) THEN
      CREATE POLICY "kit_component_print_areas_select_public"
        ON public.kit_component_print_areas FOR SELECT TO anon, authenticated USING (true);
      RAISE NOTICE 'Created policy kit_component_print_areas_select_public';
    ELSE
      RAISE NOTICE 'Table kit_component_print_areas not found — skipping policy';
    END IF;
  END IF;

  -- product_tags
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'product_tags'
      AND policyname = 'product_tags_select_public'
  ) THEN
    IF EXISTS (
      SELECT 1 FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = 'product_tags'
    ) THEN
      CREATE POLICY "product_tags_select_public"
        ON public.product_tags FOR SELECT TO anon, authenticated USING (true);
      RAISE NOTICE 'Created policy product_tags_select_public';
    ELSE
      RAISE NOTICE 'Table product_tags not found — skipping policy';
    END IF;
  END IF;

  -- tags
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'tags'
      AND policyname = 'tags_select_public'
  ) THEN
    IF EXISTS (
      SELECT 1 FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = 'tags'
    ) THEN
      CREATE POLICY "tags_select_public"
        ON public.tags FOR SELECT TO anon, authenticated USING (true);
      RAISE NOTICE 'Created policy tags_select_public';
    ELSE
      RAISE NOTICE 'Table tags not found — skipping policy';
    END IF;
  END IF;
END $$;
