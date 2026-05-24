-- Wave 3.2.C - quotes add Lovable columns
ALTER TABLE public.quotes
  ADD COLUMN IF NOT EXISTS parent_quote_id uuid,
  ADD COLUMN IF NOT EXISTS is_latest_version boolean DEFAULT true NOT NULL,
  ADD COLUMN IF NOT EXISTS payment_method text,
  ADD COLUMN IF NOT EXISTS sent_at timestamptz;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='quotes_parent_quote_id_fkey' AND conrelid='public.quotes'::regclass) THEN
    ALTER TABLE public.quotes ADD CONSTRAINT quotes_parent_quote_id_fkey FOREIGN KEY (parent_quote_id) REFERENCES public.quotes(id) ON DELETE SET NULL;
  END IF;
END$$;
