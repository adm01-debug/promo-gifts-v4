-- Migration: add primary keys to public-schema backup/archive tables lacking them
-- Eliminates "no_primary_key" Supabase advisor warnings for 12 tables.
-- All guards use IF EXISTS + NOT EXISTS constraint check so this is safe to run
-- against preview DBs that may not have these tables.

DO $$
BEGIN

  -- ── Tables using existing `id` surrogate column ──────────────────────────

  IF EXISTS(SELECT 1 FROM pg_tables WHERE schemaname='public' AND tablename='_backup_stock_daily_summary_20260618')
     AND NOT EXISTS(SELECT 1 FROM pg_constraint c
                    JOIN pg_class cl ON c.conrelid = cl.oid
                    JOIN pg_namespace n ON cl.relnamespace = n.oid
                    WHERE n.nspname='public' AND cl.relname='_backup_stock_daily_summary_20260618' AND c.contype='p') THEN
    ALTER TABLE public._backup_stock_daily_summary_20260618
      ADD CONSTRAINT bkp_stock_daily_summary_pkey PRIMARY KEY (id);
  END IF;

  IF EXISTS(SELECT 1 FROM pg_tables WHERE schemaname='public' AND tablename='_archive_supplier_price_tiers_20260626')
     AND NOT EXISTS(SELECT 1 FROM pg_constraint c
                    JOIN pg_class cl ON c.conrelid = cl.oid
                    JOIN pg_namespace n ON cl.relnamespace = n.oid
                    WHERE n.nspname='public' AND cl.relname='_archive_supplier_price_tiers_20260626' AND c.contype='p') THEN
    ALTER TABLE public._archive_supplier_price_tiers_20260626
      ADD CONSTRAINT archive_supplier_price_tiers_pkey PRIMARY KEY (id);
  END IF;

  IF EXISTS(SELECT 1 FROM pg_tables WHERE schemaname='public' AND tablename='_bkp_kcvs_pre_normalize_20260624')
     AND NOT EXISTS(SELECT 1 FROM pg_constraint c
                    JOIN pg_class cl ON c.conrelid = cl.oid
                    JOIN pg_namespace n ON cl.relnamespace = n.oid
                    WHERE n.nspname='public' AND cl.relname='_bkp_kcvs_pre_normalize_20260624' AND c.contype='p') THEN
    ALTER TABLE public._bkp_kcvs_pre_normalize_20260624
      ADD CONSTRAINT bkp_kcvs_pre_normalize_pkey PRIMARY KEY (id);
  END IF;

  IF EXISTS(SELECT 1 FROM pg_tables WHERE schemaname='public' AND tablename='_bkp_kit_color_from_name_20260624')
     AND NOT EXISTS(SELECT 1 FROM pg_constraint c
                    JOIN pg_class cl ON c.conrelid = cl.oid
                    JOIN pg_namespace n ON cl.relnamespace = n.oid
                    WHERE n.nspname='public' AND cl.relname='_bkp_kit_color_from_name_20260624' AND c.contype='p') THEN
    ALTER TABLE public._bkp_kit_color_from_name_20260624
      ADD CONSTRAINT bkp_kit_color_from_name_pkey PRIMARY KEY (id);
  END IF;

  IF EXISTS(SELECT 1 FROM pg_tables WHERE schemaname='public' AND tablename='_bkp_kit_dims_20260619')
     AND NOT EXISTS(SELECT 1 FROM pg_constraint c
                    JOIN pg_class cl ON c.conrelid = cl.oid
                    JOIN pg_namespace n ON cl.relnamespace = n.oid
                    WHERE n.nspname='public' AND cl.relname='_bkp_kit_dims_20260619' AND c.contype='p') THEN
    ALTER TABLE public._bkp_kit_dims_20260619
      ADD CONSTRAINT bkp_kit_dims_pkey PRIMARY KEY (id);
  END IF;

  IF EXISTS(SELECT 1 FROM pg_tables WHERE schemaname='public' AND tablename='_bkp_kit_packing_type_20260624')
     AND NOT EXISTS(SELECT 1 FROM pg_constraint c
                    JOIN pg_class cl ON c.conrelid = cl.oid
                    JOIN pg_namespace n ON cl.relnamespace = n.oid
                    WHERE n.nspname='public' AND cl.relname='_bkp_kit_packing_type_20260624' AND c.contype='p') THEN
    ALTER TABLE public._bkp_kit_packing_type_20260624
      ADD CONSTRAINT bkp_kit_packing_type_pkey PRIMARY KEY (id);
  END IF;

  IF EXISTS(SELECT 1 FROM pg_tables WHERE schemaname='public' AND tablename='_bkp_kit_pkg_material_20260624')
     AND NOT EXISTS(SELECT 1 FROM pg_constraint c
                    JOIN pg_class cl ON c.conrelid = cl.oid
                    JOIN pg_namespace n ON cl.relnamespace = n.oid
                    WHERE n.nspname='public' AND cl.relname='_bkp_kit_pkg_material_20260624' AND c.contype='p') THEN
    ALTER TABLE public._bkp_kit_pkg_material_20260624
      ADD CONSTRAINT bkp_kit_pkg_material_pkey PRIMARY KEY (id);
  END IF;

  IF EXISTS(SELECT 1 FROM pg_tables WHERE schemaname='public' AND tablename='_bkp_orphan_active_variants_20260619')
     AND NOT EXISTS(SELECT 1 FROM pg_constraint c
                    JOIN pg_class cl ON c.conrelid = cl.oid
                    JOIN pg_namespace n ON cl.relnamespace = n.oid
                    WHERE n.nspname='public' AND cl.relname='_bkp_orphan_active_variants_20260619' AND c.contype='p') THEN
    ALTER TABLE public._bkp_orphan_active_variants_20260619
      ADD CONSTRAINT bkp_orphan_active_variants_pkey PRIMARY KEY (id);
  END IF;

  IF EXISTS(SELECT 1 FROM pg_tables WHERE schemaname='public' AND tablename='backup_produto_ramo_atividade_20260625')
     AND NOT EXISTS(SELECT 1 FROM pg_constraint c
                    JOIN pg_class cl ON c.conrelid = cl.oid
                    JOIN pg_namespace n ON cl.relnamespace = n.oid
                    WHERE n.nspname='public' AND cl.relname='backup_produto_ramo_atividade_20260625' AND c.contype='p') THEN
    ALTER TABLE public.backup_produto_ramo_atividade_20260625
      ADD CONSTRAINT backup_produto_ramo_atividade_pkey PRIMARY KEY (id);
  END IF;

  -- ── Tables using `product_id` as natural PK ──────────────────────────────
  -- Verified: 0 duplicates in both tables (6610 rows each, all distinct product_ids)

  IF EXISTS(SELECT 1 FROM pg_tables WHERE schemaname='public' AND tablename='_archive_product_ai_20260626')
     AND NOT EXISTS(SELECT 1 FROM pg_constraint c
                    JOIN pg_class cl ON c.conrelid = cl.oid
                    JOIN pg_namespace n ON cl.relnamespace = n.oid
                    WHERE n.nspname='public' AND cl.relname='_archive_product_ai_20260626' AND c.contype='p') THEN
    ALTER TABLE public._archive_product_ai_20260626
      ADD CONSTRAINT archive_product_ai_pkey PRIMARY KEY (product_id);
  END IF;

  IF EXISTS(SELECT 1 FROM pg_tables WHERE schemaname='public' AND tablename='_archive_product_seo_20260626')
     AND NOT EXISTS(SELECT 1 FROM pg_constraint c
                    JOIN pg_class cl ON c.conrelid = cl.oid
                    JOIN pg_namespace n ON cl.relnamespace = n.oid
                    WHERE n.nspname='public' AND cl.relname='_archive_product_seo_20260626' AND c.contype='p') THEN
    ALTER TABLE public._archive_product_seo_20260626
      ADD CONSTRAINT archive_product_seo_pkey PRIMARY KEY (product_id);
  END IF;

  -- ── schema_signature_drift_allowlist: surrogate PK ──────────────────────
  -- column_name is nullable (table-level allowlist entries have column_name=NULL),
  -- so composite (table_name, column_name) cannot be a PK. Add surrogate id instead.

  IF EXISTS(SELECT 1 FROM pg_tables WHERE schemaname='public' AND tablename='schema_signature_drift_allowlist')
     AND NOT EXISTS(SELECT 1 FROM pg_constraint c
                    JOIN pg_class cl ON c.conrelid = cl.oid
                    JOIN pg_namespace n ON cl.relnamespace = n.oid
                    WHERE n.nspname='public' AND cl.relname='schema_signature_drift_allowlist' AND c.contype='p') THEN
    -- Add surrogate id only if it doesn't already exist
    IF NOT EXISTS(SELECT 1 FROM information_schema.columns
                  WHERE table_schema='public' AND table_name='schema_signature_drift_allowlist' AND column_name='id') THEN
      ALTER TABLE public.schema_signature_drift_allowlist
        ADD COLUMN id BIGSERIAL;
    END IF;
    ALTER TABLE public.schema_signature_drift_allowlist
      ADD CONSTRAINT schema_signature_drift_allowlist_pkey PRIMARY KEY (id);
  END IF;

END $$;
