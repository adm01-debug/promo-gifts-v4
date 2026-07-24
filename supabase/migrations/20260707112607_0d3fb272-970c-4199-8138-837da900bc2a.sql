ALTER TABLE public.crm_callback_events
  ADD CONSTRAINT chk_crm_callback_events_result
  CHECK (result IN ('applied', 'error', 'duplicate_ignored'));