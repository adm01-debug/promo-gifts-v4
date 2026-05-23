-- Drop "Allow all" RLS policies on production tables
-- Extraido cirurgicamente do PR #98 (em conflito por baselines/testes)
--
-- A migration 20250102000000_gifts_production.sql criou:
--   CREATE POLICY "Allow all" ON public.{products,categories,suppliers,quotes}
--     FOR ALL USING (true);
--
-- Em RLS do Postgres, policies permissivas se combinam por OR.
-- Mesmo com policies restritivas posteriores, "Allow all" permite acesso total
-- inclusive para anon, expondo PII em quotes e catalogo gravavel.
--
-- Idempotente (IF EXISTS). RLS continua ativo (ALTER ENABLE eh no-op defensivo).

DROP POLICY IF EXISTS "Allow all" ON public.products;
DROP POLICY IF EXISTS "Allow all" ON public.categories;
DROP POLICY IF EXISTS "Allow all" ON public.suppliers;
DROP POLICY IF EXISTS "Allow all" ON public.quotes;

ALTER TABLE public.products    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.categories  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.suppliers   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quotes      ENABLE ROW LEVEL SECURITY;
