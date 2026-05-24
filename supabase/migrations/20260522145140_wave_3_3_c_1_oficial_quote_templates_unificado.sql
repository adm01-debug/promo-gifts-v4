-- Wave 3.3.C.1 - quote_templates unificado
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'quote_templates'
      AND column_name = 'default_payment_terms'
  ) AND NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'quote_templates'
      AND column_name = 'payment_terms'
  ) THEN
    EXECUTE 'ALTER TABLE public.quote_templates RENAME COLUMN default_payment_terms TO payment_terms';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'quote_templates'
      AND column_name = 'default_delivery_terms'
  ) AND NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'quote_templates'
      AND column_name = 'delivery_time'
  ) THEN
    EXECUTE 'ALTER TABLE public.quote_templates RENAME COLUMN default_delivery_terms TO delivery_time';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'quote_templates'
      AND column_name = 'default_notes'
  ) AND NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'quote_templates'
      AND column_name = 'notes'
  ) THEN
    EXECUTE 'ALTER TABLE public.quote_templates RENAME COLUMN default_notes TO notes';
  END IF;
END $$;

ALTER TABLE public.quote_templates
  ADD COLUMN IF NOT EXISTS seller_id uuid,
  ADD COLUMN IF NOT EXISTS template_data jsonb DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS discount_percent numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS discount_amount numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS internal_notes text,
  ADD COLUMN IF NOT EXISTS is_default boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS validity_days integer DEFAULT 30;
