-- Aplicada via Supabase dashboard em 2026-05-25 17:47 UTC
-- Recuperada do schema_migrations para sincronizar o repo
ALTER TABLE public.mockup_drafts
  ADD CONSTRAINT mockup_drafts_user_id_draft_key_key UNIQUE (user_id, draft_key);
