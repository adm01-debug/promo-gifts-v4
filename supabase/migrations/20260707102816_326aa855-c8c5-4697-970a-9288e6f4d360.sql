ALTER TABLE public.crm_callback_events
  ADD CONSTRAINT chk_crm_callback_events_event_type
  CHECK (event_type IN ('approved','rejected','order_created','sent_to_client','expired'));