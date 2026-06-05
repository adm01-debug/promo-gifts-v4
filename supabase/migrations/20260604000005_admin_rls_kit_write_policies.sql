-- Migration: Admin RLS write policies for kit_component_print_areas and kit_component_media
-- Problema: external-db-bridge usava service_role, contornando RLS.
-- Após a migração para REST nativo (user JWT), apenas SELECT estava coberto.
-- kit_component_print_areas: tinha INSERT/UPDATE para admin mas faltava DELETE.
-- kit_component_media: não tinha nenhuma policy de escrita para admin.
-- Fix: adiciona políticas idempotentes de INSERT/UPDATE/DELETE para admin.

DO $$
BEGIN
  -- -------------------------------------------------------------------------
  -- kit_component_print_areas: admin DELETE (INSERT/UPDATE já existem)
  -- -------------------------------------------------------------------------
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'kit_component_print_areas'
      AND policyname = 'kcpa_admin_delete'
  ) THEN
    IF EXISTS (
      SELECT 1 FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = 'kit_component_print_areas'
    ) THEN
      CREATE POLICY "kcpa_admin_delete"
        ON public.kit_component_print_areas FOR DELETE
        TO authenticated
        USING (is_admin_or_above((SELECT auth.uid())));
      RAISE NOTICE 'Created policy kcpa_admin_delete on kit_component_print_areas';
    ELSE
      RAISE NOTICE 'Table kit_component_print_areas not found — skipping kcpa_admin_delete';
    END IF;
  END IF;

  -- -------------------------------------------------------------------------
  -- kit_component_media: INSERT, UPDATE, DELETE para admin
  -- -------------------------------------------------------------------------
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'kit_component_media'
      AND policyname = 'kcm_admin_insert'
  ) THEN
    IF EXISTS (
      SELECT 1 FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = 'kit_component_media'
    ) THEN
      CREATE POLICY "kcm_admin_insert"
        ON public.kit_component_media FOR INSERT
        TO authenticated
        WITH CHECK (is_admin_or_above((SELECT auth.uid())));
      RAISE NOTICE 'Created policy kcm_admin_insert on kit_component_media';
    ELSE
      RAISE NOTICE 'Table kit_component_media not found — skipping kcm_admin_insert';
    END IF;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'kit_component_media'
      AND policyname = 'kcm_admin_update'
  ) THEN
    IF EXISTS (
      SELECT 1 FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = 'kit_component_media'
    ) THEN
      CREATE POLICY "kcm_admin_update"
        ON public.kit_component_media FOR UPDATE
        TO authenticated
        USING (is_admin_or_above((SELECT auth.uid())))
        WITH CHECK (is_admin_or_above((SELECT auth.uid())));
      RAISE NOTICE 'Created policy kcm_admin_update on kit_component_media';
    ELSE
      RAISE NOTICE 'Table kit_component_media not found — skipping kcm_admin_update';
    END IF;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'kit_component_media'
      AND policyname = 'kcm_admin_delete'
  ) THEN
    IF EXISTS (
      SELECT 1 FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = 'kit_component_media'
    ) THEN
      CREATE POLICY "kcm_admin_delete"
        ON public.kit_component_media FOR DELETE
        TO authenticated
        USING (is_admin_or_above((SELECT auth.uid())));
      RAISE NOTICE 'Created policy kcm_admin_delete on kit_component_media';
    ELSE
      RAISE NOTICE 'Table kit_component_media not found — skipping kcm_admin_delete';
    END IF;
  END IF;
END $$;
