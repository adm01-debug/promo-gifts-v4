-- =============================================================
-- HARDENING DO TRIGGER generate_quote_number (PROPOSTA — NÃO APLICADA)
-- =============================================================
-- Requer aprovação explícita do PO antes de rodar em
-- doufsxqlfjyuvxuezpln (banco externo é somente-leitura para o app).
--
-- Objetivos:
--   1) Garantir unicidade absoluta de quote_number por ano.
--   2) Eliminar a race condition entre INSERTs concorrentes.
--   3) Tornar a divergência prévia × salvo detectável no banco.
-- =============================================================

-- 1) UNIQUE INDEX por ano (defesa final).
--    Concurrent para não travar a tabela em produção.
CREATE UNIQUE INDEX CONCURRENTLY IF NOT EXISTS
  uniq_quotes_quote_number
  ON public.quotes (quote_number)
  WHERE quote_number IS NOT NULL;

-- 2) Trigger com advisory lock por ano (barato; serializa só o mesmo YY).
CREATE OR REPLACE FUNCTION public.generate_quote_number()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  year_short text;
  max_num    integer;
BEGIN
  year_short := to_char(now(), 'YY');

  -- Lock por (ano) — só serializa concorrência do MESMO ano.
  -- hashtext é determinístico; libera no fim da transação.
  PERFORM pg_advisory_xact_lock(hashtext('quote_number:' || year_short));

  SELECT COALESCE(MAX(
    CASE WHEN split_part(quote_number, '/', 1) ~ '^\d+$'
         THEN split_part(quote_number, '/', 1)::integer
         ELSE 0 END
  ), 10000)
  INTO max_num
  FROM public.quotes
  WHERE quote_number LIKE '%/' || year_short;

  IF NEW.quote_number IS NULL OR NEW.quote_number = '' THEN
    NEW.quote_number := (max_num + 1)::text || '/' || year_short;
  END IF;

  RETURN NEW;
END;
$function$;

-- 3) (Opcional) Não consumir número em rascunho.
-- DROP TRIGGER trigger_generate_quote_number ON public.quotes;
-- CREATE TRIGGER trigger_generate_quote_number
--   BEFORE INSERT ON public.quotes
--   FOR EACH ROW
--   WHEN (NEW.status IS DISTINCT FROM 'draft')
--   EXECUTE FUNCTION public.generate_quote_number();

-- 4) (Opcional, multi-tenant) Escopo por org_id:
--    Trocar o filtro do MAX e o índice unique para (org_id, quote_number).
