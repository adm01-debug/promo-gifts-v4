-- Wave 3.1.B - adicionar colunas para alinhar ao Lovable

ALTER TABLE public.organizations
  ADD COLUMN IF NOT EXISTS slug text,
  ADD COLUMN IF NOT EXISTS logo_url text,
  ADD COLUMN IF NOT EXISTS description text,
  ADD COLUMN IF NOT EXISTS is_active boolean DEFAULT true NOT NULL,
  ADD COLUMN IF NOT EXISTS settings jsonb DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now() NOT NULL;

UPDATE public.organizations
SET slug = lower(regexp_replace(name,'[^a-zA-Z0-9]+','-','g'))
WHERE slug IS NULL OR btrim(slug) = '';
ALTER TABLE public.organizations ALTER COLUMN slug SET NOT NULL;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='organizations_slug_key' AND conrelid='public.organizations'::regclass) THEN
    ALTER TABLE public.organizations ADD CONSTRAINT organizations_slug_key UNIQUE (slug);
  END IF;
END$$;

ALTER TABLE public.product_sync_logs
  ADD COLUMN IF NOT EXISTS products_received integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS products_created integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS products_updated integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS products_failed integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS completed_at timestamptz;

ALTER TABLE public.system_settings ADD COLUMN IF NOT EXISTS description text;
