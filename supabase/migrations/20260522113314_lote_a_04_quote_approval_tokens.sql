-- LOTE A 4/6 - quote_approval_tokens
CREATE TABLE IF NOT EXISTS public.quote_approval_tokens (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  quote_id text NOT NULL,
  token text NOT NULL DEFAULT encode(gen_random_bytes(32),'hex'),
  seller_id uuid NOT NULL,
  client_name text NULL, client_email text NULL,
  status text NOT NULL DEFAULT 'active',
  expires_at timestamptz NULL DEFAULT (now() + '30 days'::interval),
  viewed_at timestamptz NULL, responded_at timestamptz NULL,
  response text NULL, response_notes text NULL,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
  signer_name text NULL, signer_document text NULL, signer_ip text NULL,
  signer_user_agent text NULL, signature_hash text NULL, signed_at timestamptz NULL,
  CONSTRAINT quote_approval_tokens_pkey PRIMARY KEY (id),
  CONSTRAINT quote_approval_tokens_token_key UNIQUE (token),
  CONSTRAINT quote_approval_tokens_seller_id_fkey FOREIGN KEY (seller_id) REFERENCES auth.users(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_approval_tokens_quote ON public.quote_approval_tokens(quote_id);
CREATE INDEX IF NOT EXISTS idx_approval_tokens_token_status ON public.quote_approval_tokens(token,status) WHERE status='active';
CREATE INDEX IF NOT EXISTS idx_quote_approval_tokens_seller_id ON public.quote_approval_tokens(seller_id);
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname='trg_generate_secure_approval_token' AND tgrelid='public.quote_approval_tokens'::regclass) THEN
  CREATE TRIGGER trg_generate_secure_approval_token BEFORE INSERT ON public.quote_approval_tokens FOR EACH ROW EXECUTE FUNCTION public.generate_secure_token();
END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname='trg_invalidate_used_approval_token' AND tgrelid='public.quote_approval_tokens'::regclass) THEN
  CREATE TRIGGER trg_invalidate_used_approval_token BEFORE UPDATE ON public.quote_approval_tokens FOR EACH ROW EXECUTE FUNCTION public.invalidate_used_approval_token();
END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname='trg_notify_quote_client_response' AND tgrelid='public.quote_approval_tokens'::regclass) THEN
  CREATE TRIGGER trg_notify_quote_client_response AFTER UPDATE ON public.quote_approval_tokens FOR EACH ROW EXECUTE FUNCTION public.notify_quote_client_response();
END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname='trg_owner__quote_approval_tokens__seller_id' AND tgrelid='public.quote_approval_tokens'::regclass) THEN
  CREATE TRIGGER trg_owner__quote_approval_tokens__seller_id BEFORE INSERT ON public.quote_approval_tokens FOR EACH ROW EXECUTE FUNCTION public.enforce_seller_id_owner();
END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname='trg_validate_approval_token_status' AND tgrelid='public.quote_approval_tokens'::regclass) THEN
  CREATE TRIGGER trg_validate_approval_token_status BEFORE INSERT OR UPDATE ON public.quote_approval_tokens FOR EACH ROW EXECUTE FUNCTION public.validate_status_fields();
END IF; END $$;
ALTER TABLE public.quote_approval_tokens ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='quote_approval_tokens' AND policyname='qatokens_select_scope') THEN
  CREATE POLICY qatokens_select_scope ON public.quote_approval_tokens FOR SELECT TO authenticated USING (
    public.has_role((select auth.uid()), 'admin'::public.app_role)
    OR public.has_role((select auth.uid()), 'manager'::public.app_role)
    OR public.has_role((select auth.uid()), 'supervisor'::public.app_role)
    OR public.has_role((select auth.uid()), 'dev'::public.app_role)
    OR seller_id = (select auth.uid())
  );
END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='quote_approval_tokens' AND policyname='qatokens_insert_scope') THEN
  CREATE POLICY qatokens_insert_scope ON public.quote_approval_tokens FOR INSERT TO authenticated WITH CHECK (
    public.has_role((select auth.uid()), 'admin'::public.app_role)
    OR public.has_role((select auth.uid()), 'manager'::public.app_role)
    OR public.has_role((select auth.uid()), 'supervisor'::public.app_role)
    OR public.has_role((select auth.uid()), 'dev'::public.app_role)
    OR seller_id = (select auth.uid())
  );
END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='quote_approval_tokens' AND policyname='qatokens_update_scope') THEN
  CREATE POLICY qatokens_update_scope ON public.quote_approval_tokens FOR UPDATE TO authenticated USING (
    public.has_role((select auth.uid()), 'admin'::public.app_role)
    OR public.has_role((select auth.uid()), 'manager'::public.app_role)
    OR public.has_role((select auth.uid()), 'supervisor'::public.app_role)
    OR public.has_role((select auth.uid()), 'dev'::public.app_role)
    OR seller_id = (select auth.uid())
  ) WITH CHECK (
    public.has_role((select auth.uid()), 'admin'::public.app_role)
    OR public.has_role((select auth.uid()), 'manager'::public.app_role)
    OR public.has_role((select auth.uid()), 'supervisor'::public.app_role)
    OR public.has_role((select auth.uid()), 'dev'::public.app_role)
    OR seller_id = (select auth.uid())
  );
END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='quote_approval_tokens' AND policyname='qatokens_delete_scope') THEN
  CREATE POLICY qatokens_delete_scope ON public.quote_approval_tokens FOR DELETE TO authenticated USING (
    public.has_role((select auth.uid()), 'admin'::public.app_role)
    OR public.has_role((select auth.uid()), 'manager'::public.app_role)
    OR public.has_role((select auth.uid()), 'supervisor'::public.app_role)
    OR public.has_role((select auth.uid()), 'dev'::public.app_role)
    OR seller_id = (select auth.uid())
  );
END IF; END $$;
