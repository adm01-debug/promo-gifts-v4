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
CREATE INDEX IF NOT EXISTS idx_user_known_devices_fingerprint ON public.user_known_devices USING btree (fingerprint);
CREATE INDEX IF NOT EXISTS idx_user_known_devices_user_id ON public.user_known_devices USING btree (user_id);
ALTER TABLE public.user_known_devices ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can manage their own devices" ON public.user_known_devices;
CREATE POLICY "Users can manage their own devices" ON public.user_known_devices FOR ALL TO public USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can view their own devices" ON public.user_known_devices;
CREATE POLICY "Users can view their own devices" ON public.user_known_devices FOR SELECT TO public USING (auth.uid() = user_id);
