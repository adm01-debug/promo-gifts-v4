-- Restore the BEFORE INSERT trigger that auto-generates public.quotes.quote_number.
--
-- Context: quote_number is NOT NULL with no column default. Number generation is
-- handled by the public.generate_quote_number() trigger function (still present),
-- which sets NEW.quote_number when it is NULL or ''. The `set_quote_number` trigger
-- that invokes it was lost during the migration-replay drift cleanup, while the
-- function survived. Without the trigger, every INSERT into public.quotes from the
-- app (quoteService.createQuote, the Flow assistant, and the Kit Builder) fails with
-- "null value in column \"quote_number\" violates not-null constraint", so no quote
-- can be created. This restores the trigger as defined in migration
-- 20260219133353 to fix quote creation.

DROP TRIGGER IF EXISTS set_quote_number ON public.quotes;

CREATE TRIGGER set_quote_number
  BEFORE INSERT ON public.quotes
  FOR EACH ROW
  WHEN (NEW.quote_number IS NULL OR NEW.quote_number = '')
  EXECUTE FUNCTION public.generate_quote_number();
