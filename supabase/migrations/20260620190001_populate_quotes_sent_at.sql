-- Populate quotes.sent_at so the quote-followup-reminders cron actually fires.
--
-- Bug: the edge fn filters `.not('sent_at','is',null).lte('sent_at', twoDaysAgo)`, but
-- NOTHING ever wrote quotes.sent_at — the send flows only set status='sent', and no trigger
-- populated it. The query therefore returned zero rows for every real quote and no follow-up
-- reminder was ever created. We populate sent_at at the DB layer (one source of truth) instead
-- of patching each send call site.

create or replace function public.set_quote_sent_at()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Stamp the first time a quote enters 'sent' (covers INSERT-as-sent and UPDATE-to-sent),
  -- and never overwrite an existing timestamp.
  if new.status = 'sent' and new.sent_at is null
     and (tg_op = 'INSERT' or old.status is distinct from 'sent') then
    new.sent_at := now();
  end if;
  return new;
end;
$$;

drop trigger if exists trg_set_quote_sent_at on public.quotes;
create trigger trg_set_quote_sent_at
  before insert or update on public.quotes
  for each row
  execute function public.set_quote_sent_at();

-- Backfill quotes already in 'sent' so they re-enter the reminder window. updated_at is the
-- best available proxy for when the status was set; created_at is the fallback.
update public.quotes
set sent_at = coalesce(updated_at, created_at)
where sent_at is null
  and status = 'sent';
