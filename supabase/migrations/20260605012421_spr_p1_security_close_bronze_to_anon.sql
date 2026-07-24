-- 1) Blindar o gateway: security_invoker=false EXPLICITO (nao depender do default do Postgres)
ALTER VIEW public.somarcas_catalogo_publico SET (security_invoker = false);

COMMENT ON VIEW public.somarcas_catalogo_publico IS
  'Gateway publico (anon) do catalogo So Marcas. security_invoker=false POR DESIGN: roda como owner e expoe apenas colunas publicas (precos COM impostos, disponivel booleano), nunca custo sem impostos/ipi/ncm/estoque numerico. O lint security_definer_view e esperado e intencional aqui.';

-- 2) Enxugar grants do anon na VIEW: deixar apenas SELECT
REVOKE ALL ON public.somarcas_catalogo_publico FROM anon;
GRANT SELECT ON public.somarcas_catalogo_publico TO anon;

-- 3) Fechar a bronze ao anon: remover policy legada + revogar TODOS os privilegios
DROP POLICY IF EXISTS spr_select_anon_somarcas ON public.supplier_products_raw;
REVOKE ALL ON public.supplier_products_raw FROM anon;

-- 4) Enxugar privilegios excessivos do authenticated na bronze (manter SELECT, governado por spr_select_admin)
REVOKE DELETE, TRUNCATE, TRIGGER, REFERENCES, INSERT, UPDATE ON public.supplier_products_raw FROM authenticated;