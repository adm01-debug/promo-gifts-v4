-- Adds missing top-level columns to generated_mockups and tightens storage security.
--
-- Bugs fixed:
--   BUG-CLIENT-ID  : client_id / client_name were never persisted at the row level —
--                    they lived only inside area_config JSONB, making CRM linkage
--                    and server-side filtering impossible.
--   BUG-MISSING-COLS: logo_rotation / logo_scale had no dedicated columns; reads fell
--                    back to area_config which breaks for rows inserted before that JSONB
--                    key existed.
--   BUG-STORAGE-SEC: mockup-assets bucket had no file-size or MIME-type enforcement.
--   BUG-MISSING-IDX : no index on client_id or approval_status — full scans on admin
--                    dashboards that filter by those columns.
--
-- All ALTER TABLE clauses are guarded with IF NOT EXISTS so the migration is idempotent.

DO $$
BEGIN
  -- client_id: stored as text (no FK) to avoid cascade issues when CRM clients are deleted.
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'generated_mockups' AND column_name = 'client_id'
  ) THEN
    ALTER TABLE public.generated_mockups ADD COLUMN client_id TEXT;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'generated_mockups' AND column_name = 'client_name'
  ) THEN
    ALTER TABLE public.generated_mockups ADD COLUMN client_name TEXT;
  END IF;

  -- logo_rotation in degrees (−360 … 360). NUMERIC to allow sub-degree precision.
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'generated_mockups' AND column_name = 'logo_rotation'
  ) THEN
    ALTER TABLE public.generated_mockups ADD COLUMN logo_rotation NUMERIC DEFAULT 0;
  END IF;

  -- logo_scale as percentage (0 … 200).
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'generated_mockups' AND column_name = 'logo_scale'
  ) THEN
    ALTER TABLE public.generated_mockups ADD COLUMN logo_scale NUMERIC DEFAULT 100;
  END IF;
END $$;

-- Backfill client_name from area_config JSONB for existing rows that already have it.
-- Runs only where client_name is still NULL so the UPDATE is safe to re-run.
UPDATE public.generated_mockups
SET client_name = (area_config ->> 'clientName')
WHERE client_name IS NULL
  AND area_config ? 'clientName'
  AND (area_config ->> 'clientName') IS NOT NULL
  AND (area_config ->> 'clientName') <> '';

-- Backfill logo_rotation / logo_scale from area_config for older rows.
-- NOTE: `ADD COLUMN ... DEFAULT <const>` above already filled every existing row with
-- 0/100, so these columns are never NULL. A `WHERE logo_rotation IS NULL` clause would
-- therefore match nothing and silently leave older rows clobbered at the default while
-- their real values still sit in area_config. Backfill wherever the JSONB carries the
-- authoritative value instead, falling back to the current (default) column value.
UPDATE public.generated_mockups
SET
  logo_rotation = COALESCE((area_config ->> 'logoRotation')::numeric, logo_rotation),
  logo_scale    = COALESCE((area_config ->> 'logoScale')::numeric, logo_scale)
WHERE area_config IS NOT NULL
  AND (area_config ? 'logoRotation' OR area_config ? 'logoScale');

-- Index on client_id speeds up admin queries like "all mockups for client X".
CREATE INDEX IF NOT EXISTS idx_generated_mockups_client_id
  ON public.generated_mockups (client_id)
  WHERE client_id IS NOT NULL;

-- Index on approval_status for approval-workflow dashboard queries.
CREATE INDEX IF NOT EXISTS idx_generated_mockups_approval_status
  ON public.generated_mockups (approval_status)
  WHERE approval_status IS NOT NULL;

-- Index on product_id for product-level mockup history views.
CREATE INDEX IF NOT EXISTS idx_generated_mockups_product_id
  ON public.generated_mockups (product_id)
  WHERE product_id IS NOT NULL;

-- Storage bucket: enforce 10 MB limit and restrict to image MIME types.
-- Prevents malicious actors from uploading arbitrary file types (e.g. scripts, executables)
-- and prevents accidental storage-cost blowouts from huge uploads.
UPDATE storage.buckets
SET
  file_size_limit   = 10485760,   -- 10 MB in bytes
  allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']
WHERE id = 'mockup-assets';
