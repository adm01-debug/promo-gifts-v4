-- Restore the BEFORE INSERT trigger that auto-generates public.quotes.quote_number.
-- The trigger was lost during the migration-replay drift cleanup while
-- public.generate_quote_number() survived. Without it, quote_number (NOT NULL,
-- no default) is never populated and every quote INSERT from the app fails.
DROP TRIGGER IF EXISTS set_quote_number ON public.quotes;

CREATE TRIGGER set_quote_number
  BEFORE INSERT ON public.quotes
  FOR EACH ROW
  WHEN (NEW.quote_number IS NULL OR NEW.quote_number = '')
  EXECUTE FUNCTION public.generate_quote_number();
