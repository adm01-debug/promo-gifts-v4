-- Aplicada via Supabase dashboard em 2026-05-25 17:47 UTC
-- Recuperada do schema_migrations para sincronizar o repo
-- Replay-safe: em preview-branches a constraint pode já existir → um ADD
-- CONSTRAINT cru falharia com "already exists" (42710). Guard via pg_constraint.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'mockup_drafts_user_id_draft_key_key'
      AND conrelid = 'public.mockup_drafts'::regclass
  ) THEN
    ALTER TABLE public.mockup_drafts
      ADD CONSTRAINT mockup_drafts_user_id_draft_key_key UNIQUE (user_id, draft_key);
  END IF;
END $$;
