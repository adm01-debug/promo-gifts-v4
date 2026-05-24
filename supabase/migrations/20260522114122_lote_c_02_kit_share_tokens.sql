-- LOTE C 2/2 - kit_share_tokens
CREATE TABLE IF NOT EXISTS public.kit_share_tokens (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  kit_id uuid NOT NULL, seller_id uuid NOT NULL,
  token text NOT NULL DEFAULT encode(gen_random_bytes(32),'hex'),
  client_name text NULL, client_email text NULL,
  status text NOT NULL DEFAULT 'active',
  expires_at timestamptz NULL DEFAULT (now()+'30 days'::interval),
  viewed_at timestamptz NULL,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT kit_share_tokens_pkey PRIMARY KEY (id),
  CONSTRAINT kit_share_tokens_token_key UNIQUE (token),
  CONSTRAINT kit_share_tokens_kit_id_fkey FOREIGN KEY (kit_id) REFERENCES public.custom_kits(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_kit_share_tokens_kit_id ON public.kit_share_tokens(kit_id);
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname='trg_owner__kit_share_tokens__seller_id' AND tgrelid='public.kit_share_tokens'::regclass) THEN
  CREATE TRIGGER trg_owner__kit_share_tokens__seller_id BEFORE INSERT ON public.kit_share_tokens FOR EACH ROW EXECUTE FUNCTION public.enforce_seller_id_owner();
END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname='trg_validate_kit_share_token_status' AND tgrelid='public.kit_share_tokens'::regclass) THEN
  CREATE TRIGGER trg_validate_kit_share_token_status BEFORE INSERT OR UPDATE ON public.kit_share_tokens FOR EACH ROW EXECUTE FUNCTION public.validate_status_fields();
END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname='trg_dispatch_webhook_kit_share' AND tgrelid='public.kit_share_tokens'::regclass) THEN
  CREATE TRIGGER trg_dispatch_webhook_kit_share AFTER INSERT ON public.kit_share_tokens FOR EACH ROW EXECUTE FUNCTION public.dispatch_quote_webhook_event();
END IF; END $$;
ALTER TABLE public.kit_share_tokens ENABLE ROW LEVEL SECURITY;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='kit_share_tokens' AND policyname='Sellers can manage own kit share tokens'
  ) THEN
    CREATE POLICY "Sellers can manage own kit share tokens" ON public.kit_share_tokens FOR ALL TO authenticated
      USING (seller_id=auth.uid()) WITH CHECK (seller_id=auth.uid());
  END IF;
END
$$;
