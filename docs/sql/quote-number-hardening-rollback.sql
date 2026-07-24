-- =============================================================
-- ROLLBACK do hardening de generate_quote_number
-- =============================================================
-- Reverte:
--   1) Remove UNIQUE INDEX uniq_quotes_quote_number
--   2) Restaura a função generate_quote_number() para a versão
--      pré-hardening (MAX+1 sem lock, sem advisory_lock).
--
-- Quando usar: se o lock estiver causando contenção inaceitável
-- em produção (improvável — advisory_xact_lock é barato e o
-- escopo é por ano).
--
-- IMPORTANTE: rodar dentro de transação. Se o índice tiver sido
-- criado com CONCURRENTLY, o DROP precisa ser CONCURRENTLY também
-- e FORA da transação:
--   DROP INDEX CONCURRENTLY IF EXISTS public.uniq_quotes_quote_number;
-- =============================================================

BEGIN;

-- 1) Restaurar a função original (sem lock)
CREATE OR REPLACE FUNCTION public.generate_quote_number()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  year_short text;
  max_num    integer;
  new_number text;
BEGIN
  year_short := to_char(now(), 'YY');

  SELECT COALESCE(MAX(
    CASE WHEN split_part(quote_number, '/', 1) ~ '^\d+$'
         THEN split_part(quote_number, '/', 1)::integer
         ELSE 0 END
  ), 10000)
  INTO max_num
  FROM public.quotes
  WHERE quote_number LIKE '%/' || year_short;

  new_number := (max_num + 1)::text || '/' || year_short;

  IF NEW.quote_number IS NULL OR NEW.quote_number = '' THEN
    NEW.quote_number := new_number;
  END IF;

  RETURN NEW;
END;
$function$;

COMMIT;

-- 2) Remover o índice unique (fora de transação)
-- Executar separadamente:
-- DROP INDEX CONCURRENTLY IF EXISTS public.uniq_quotes_quote_number;
