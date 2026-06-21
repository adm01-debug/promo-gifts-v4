-- ============================================================
-- Catalog Critical Bug Fixes — 2026-06-20
-- ============================================================

-- FIX #1 (CRITICAL): fn_autolink_canonical_on_content_hash
-- Bug: fallback path could set canonical_image_id = NEW.id
-- (self-reference) when orphaned dependents point back to
-- the current row. Violates chk_pi_canonical_not_self,
-- causing ~30+ errors/min in postgres logs and 400 responses
-- from the hash-product-images edge function batch pipeline.
-- Fix: add AND pi2.canonical_image_id <> NEW.id guard in fallback.
CREATE OR REPLACE FUNCTION public.fn_autolink_canonical_on_content_hash()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public'
AS $function$
DECLARE
  v_root_id               uuid;
  v_existing_canonical_hash text;
  v_old_group_root        uuid;
  v_elected_dep_root      uuid;
BEGIN
  IF NEW.content_hash IS NULL OR (OLD.content_hash IS NOT NULL AND OLD.content_hash = NEW.content_hash) THEN
    RETURN NEW;
  END IF;

  IF NEW.canonical_image_id IS NOT NULL THEN
    IF OLD.content_hash IS NOT NULL AND OLD.content_hash IS DISTINCT FROM NEW.content_hash THEN
      NEW.canonical_image_id := NULL;
      NEW.is_shared := false;
    ELSE
      SELECT content_hash INTO v_existing_canonical_hash
      FROM public.product_images
      WHERE id = NEW.canonical_image_id;
      IF v_existing_canonical_hash IS NOT DISTINCT FROM NEW.content_hash THEN
        RETURN NEW;
      END IF;
      NEW.canonical_image_id := NULL;
      NEW.is_shared := false;
    END IF;
  END IF;

  SELECT id INTO v_root_id
  FROM public.product_images
  WHERE content_hash = NEW.content_hash
    AND deleted_at IS NULL
    AND canonical_image_id IS NULL
    AND id <> NEW.id
    AND is_shared = false
  ORDER BY created_at ASC, id ASC
  LIMIT 1;

  IF v_root_id IS NOT NULL THEN
    NEW.canonical_image_id := v_root_id;
    NEW.is_shared := true;
  ELSE
    -- GUARD: exclude rows whose canonical_image_id = NEW.id to prevent
    -- self-reference (chk_pi_canonical_not_self violation).
    -- This edge case fires when this row was previously the root, its
    -- content_hash was cleared to NULL, and orphaned dependents still point to it.
    SELECT pi2.canonical_image_id INTO v_root_id
    FROM public.product_images pi2
    WHERE pi2.content_hash = NEW.content_hash
      AND pi2.deleted_at IS NULL
      AND pi2.canonical_image_id IS NOT NULL
      AND pi2.id <> NEW.id
      AND pi2.canonical_image_id <> NEW.id
    LIMIT 1;

    IF v_root_id IS NOT NULL THEN
      NEW.canonical_image_id := v_root_id;
      NEW.is_shared := true;
    END IF;
    -- If only member (or all dependents point back to NEW.id as orphans):
    -- remain as standalone root (canonical_image_id stays NULL)
  END IF;

  -- GAP-C5 / GAP-C5b: former deps need re-grouping when this row changes hash
  IF OLD.canonical_image_id IS NULL AND OLD.content_hash IS NOT NULL THEN
    SELECT id INTO v_old_group_root
    FROM public.product_images
    WHERE content_hash = OLD.content_hash
      AND deleted_at IS NULL
      AND canonical_image_id IS NULL
      AND id <> NEW.id
    ORDER BY created_at ASC, id ASC
    LIMIT 1;

    IF v_old_group_root IS NOT NULL THEN
      UPDATE public.product_images
      SET canonical_image_id = v_old_group_root,
          is_shared           = true,
          updated_at          = now()
      WHERE canonical_image_id = NEW.id
        AND id <> NEW.id
        AND deleted_at IS NULL;
    ELSE
      SELECT id INTO v_elected_dep_root
      FROM public.product_images
      WHERE canonical_image_id = NEW.id
        AND id <> NEW.id
        AND deleted_at IS NULL
      ORDER BY created_at ASC, id ASC
      LIMIT 1;

      IF v_elected_dep_root IS NOT NULL THEN
        UPDATE public.product_images
        SET canonical_image_id = NULL,
            is_shared           = false,
            updated_at          = now()
        WHERE id = v_elected_dep_root;

        UPDATE public.product_images
        SET canonical_image_id = v_elected_dep_root,
            is_shared           = true,
            updated_at          = now()
        WHERE canonical_image_id = NEW.id
          AND id <> NEW.id
          AND id <> v_elected_dep_root
          AND deleted_at IS NULL;
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END;
$function$;

-- FIX #2: Add ASIA_INGESTION_CRON_SECRET to vault secret allowlist
-- Bug: asia-ingestion edge function calls get_edge_function_secret
-- with 'ASIA_INGESTION_CRON_SECRET' which was absent from the allowlist,
-- causing "Nome de secret nao autorizado" errors and blocking ASIA catalog sync.
CREATE OR REPLACE FUNCTION public.get_edge_function_secret(_name text)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'vault', 'public', 'pg_temp'
AS $function$
DECLARE
  _secret text;
BEGIN
  IF _name NOT IN (
    'WEBHOOK_DISPATCHER_SECRET',
    'CONNECTIONS_AUTO_TEST_SECRET',
    'CRON_SECRET',
    'HASH_PRODUCT_IMAGES_CRON_SECRET',
    'GENERATE_BLURHASHES_CRON_SECRET',
    'BACKFILL_DIM_CRON_SECRET',
    'ASIA_INGESTION_CRON_SECRET'
  ) THEN
    RAISE EXCEPTION 'Nome de secret nao autorizado: %', _name USING ERRCODE = 'insufficient_privilege';
  END IF;

  SELECT decrypted_secret INTO _secret
  FROM vault.decrypted_secrets
  WHERE name = _name
  LIMIT 1;

  IF _secret IS NULL THEN
    RAISE EXCEPTION 'Secret % nao encontrado no vault', _name USING ERRCODE = 'no_data_found';
  END IF;

  RETURN _secret;
END;
$function$;

-- FIX #3: Make admin_audit_log.user_id nullable
-- Bug: service-role cron jobs and edge functions call audit functions
-- without a user context (auth.uid() returns NULL), violating NOT NULL
-- and dropping audit records. NULL now means system/service-role actor.
ALTER TABLE public.admin_audit_log
  ALTER COLUMN user_id DROP NOT NULL;

COMMENT ON COLUMN public.admin_audit_log.user_id IS
  'NULL = system/service-role actor (cron, edge function, trigger). Use source column to identify.';

-- FIX #4: Add RLS policy for supplier_customization_raw
-- Bug: RLS enabled but 0 policies blocked all authenticated access.
-- Service_role (used by cron/imports) bypasses RLS; admins need SELECT.
CREATE POLICY "Admins can read supplier customization raw"
  ON public.supplier_customization_raw
  FOR SELECT
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR public.is_dev(auth.uid())
  );

-- FIX #5: Add missing FK indexes for catalog performance
-- These missing indexes cause full table scans during FK constraint
-- evaluation and in RLS policy checks (especially product_images.organization_id
-- which is checked on every product image fetch).

-- product_faqs.product_id → products
CREATE INDEX IF NOT EXISTS idx_product_faqs_product_id
  ON public.product_faqs (product_id);

-- product_faqs.category_id → categories
CREATE INDEX IF NOT EXISTS idx_product_faqs_category_id
  ON public.product_faqs (category_id);

-- product_group_members.product_group_id → product_groups
CREATE INDEX IF NOT EXISTS idx_product_group_members_group_id
  ON public.product_group_members (product_group_id);

-- product_images.organization_id → organizations (critical for RLS policy eval)
CREATE INDEX IF NOT EXISTS idx_product_images_organization_id
  ON public.product_images (organization_id);

-- product_kit_components.padronizacao_id → kit_component_padronizacao
CREATE INDEX IF NOT EXISTS idx_product_kit_components_padronizacao_id
  ON public.product_kit_components (padronizacao_id);

-- product_target_audiences.category_id → categories
CREATE INDEX IF NOT EXISTS idx_product_target_audiences_category_id
  ON public.product_target_audiences (category_id);

-- supplier_products_raw.import_batch_id → supplier_import_batches
CREATE INDEX IF NOT EXISTS idx_supplier_products_raw_import_batch_id
  ON public.supplier_products_raw (import_batch_id);
