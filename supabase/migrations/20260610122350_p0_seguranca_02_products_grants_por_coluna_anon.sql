-- O REVOKE de coluna não vence grant de TABELA: anon tinha SELECT na tabela
-- products inteira. Corrige: remove o grant de tabela e concede lista explícita
-- de colunas (todas exceto cost_price e ipi_rate).
-- Verificado pós-aplicação via REST com a chave anon:
--   products?select=cost_price -> 42501 permission denied
--   products?select=id,name,sale_price -> 200
--   v_products_public (SECDEF, campos sensíveis já anulados) -> 200
--   GraphQL: campo cost_price deixa de existir no tipo products p/ anon
DO $$
DECLARE v_cols text;
BEGIN
  SELECT string_agg(quote_ident(column_name), ', ' ORDER BY ordinal_position)
    INTO v_cols
  FROM information_schema.columns
  WHERE table_schema='public' AND table_name='products'
    AND column_name NOT IN ('cost_price','ipi_rate');

  REVOKE SELECT ON public.products FROM anon;
  EXECUTE format('GRANT SELECT (%s) ON public.products TO anon', v_cols);
END $$;
