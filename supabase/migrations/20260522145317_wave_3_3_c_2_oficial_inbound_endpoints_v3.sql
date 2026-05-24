-- Wave 3.3.C.2 v3 - inbound_webhook_endpoints
ALTER TABLE public.inbound_webhook_endpoints ALTER COLUMN secret_key DROP NOT NULL;
ALTER TABLE public.inbound_webhook_endpoints
  ADD COLUMN IF NOT EXISTS source_system text,
  ADD COLUMN IF NOT EXISTS hmac_secret_ref text,
  ADD COLUMN IF NOT EXISTS allowed_events text[] DEFAULT ARRAY[]::text[],
  ADD COLUMN IF NOT EXISTS last_received_at timestamptz,
  ADD COLUMN IF NOT EXISTS total_received integer DEFAULT 0 NOT NULL,
  ADD COLUMN IF NOT EXISTS total_invalid integer DEFAULT 0 NOT NULL;
ALTER TABLE public.inbound_webhook_endpoints ALTER COLUMN created_by DROP NOT NULL;

INSERT INTO public.inbound_webhook_endpoints (id,slug,name,source_system,hmac_secret_ref,allowed_events,is_active,last_received_at,total_received,total_invalid,created_by,created_at,updated_at,metadata)
VALUES
  ('80675b8f-2c87-40f0-a963-2c0564db2390','simulation-test','Simulation Test Endpoint','simulation','SUPABASE_SERVICE_ROLE_KEY',ARRAY['test'],true,'2026-05-21 17:39:45.821+00',298,15,NULL,'2026-05-19 16:22:29.259029+00','2026-05-21 17:39:45.889639+00','{"_migrated_from":"lovable"}'::jsonb),
  ('71170cf1-224c-4525-aa47-755ccfc55966','test-automated','Automated Test Endpoint','TEST_SYSTEM','SIMULATION_BYPASS_KEY',ARRAY[]::text[],true,'2026-05-21 16:07:00.603+00',4,3,NULL,'2026-05-21 16:05:43.371653+00','2026-05-21 16:07:00.67979+00','{"_migrated_from":"lovable"}'::jsonb)
ON CONFLICT (id) DO NOTHING;
