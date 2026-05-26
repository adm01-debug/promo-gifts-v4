-- LOTE A 2/6 - user_known_devices
CREATE TABLE IF NOT EXISTS public.user_known_devices (
  id           uuid        NOT NULL DEFAULT gen_random_uuid(),
  user_id      uuid        NOT NULL,
  fingerprint  text        NOT NULL,
  device_name  text        NULL,
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  created_at   timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT user_known_devices_pkey PRIMARY KEY (id),
  CONSTRAINT user_known_devices_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE
);
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'user_known_devices'
      AND column_name = 'fingerprint'
  ) THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_user_known_devices_fingerprint ON public.user_known_devices USING btree (fingerprint)';
  ELSIF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'user_known_devices'
      AND column_name = 'device_fingerprint'
  ) THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_user_known_devices_fingerprint ON public.user_known_devices USING btree (device_fingerprint)';
  ELSE
    RAISE NOTICE '[user_known_devices] Skipped fingerprint index: no fingerprint column is present';
  END IF;
END $$;
CREATE INDEX IF NOT EXISTS idx_user_known_devices_user_id ON public.user_known_devices USING btree (user_id);
ALTER TABLE public.user_known_devices ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname ='public' AND tablename ='user_known_devices' AND policyname ='Users can manage their own devices') THEN CREATE POLICY "Users can manage their own devices" ON public.user_known_devices FOR ALL TO public USING (auth.uid() = user_id); END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname ='public' AND tablename ='user_known_devices' AND policyname ='Users can view their own devices') THEN CREATE POLICY "Users can view their own devices" ON public.user_known_devices FOR SELECT TO public USING (auth.uid() = user_id); END IF; END $$;
