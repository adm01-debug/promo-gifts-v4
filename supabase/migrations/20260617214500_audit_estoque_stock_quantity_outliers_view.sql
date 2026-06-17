-- Auditoria do módulo Estoque (2026-06-17) — observabilidade NÃO destrutiva.
--
-- Contexto: a auditoria identificou que o "Estoque Futuro" e o total de unidades
-- do dashboard são dominados por outliers de quantidade vindos de feeds de
-- fornecedor (ex.: uma única variação com 2.234.529 un.). Em vez de sobrescrever
-- dados de fornecedor (que podem ser legítimos para itens a granel), expomos uma
-- VIEW de revisão manual. Read-only, security_invoker (sem novo lint
-- security_definer_view), sem grant para anon (somente authenticated/admin).
create or replace view public.vw_stock_quantity_outliers
with (security_invoker = true) as
select
  vss.id          as source_id,
  vss.variant_id,
  pv.product_id,
  p.sku           as product_sku,
  p.name          as product_name,
  vss.supplier_id,
  vsp.name        as supplier_name,
  vss.quantity    as current_quantity,
  greatest(
    coalesce(vss.next_quantity_1,0), coalesce(vss.next_quantity_2,0), coalesce(vss.next_quantity_3,0),
    coalesce(vss.next_quantity_4,0), coalesce(vss.next_quantity_5,0), coalesce(vss.next_quantity_6,0)
  )               as max_future_quantity,
  vss.updated_at,
  case
    when vss.quantity >= 1000000 then 'extreme'
    when vss.quantity >= 100000  then 'high'
    else 'elevated'
  end             as severity
from public.variant_supplier_sources vss
join public.product_variants pv on pv.id = vss.variant_id
join public.products p          on p.id  = pv.product_id
left join public.v_suppliers_public vsp on vsp.id = vss.supplier_id
where vss.is_active
  and (
    vss.quantity >= 50000
    or greatest(
        coalesce(vss.next_quantity_1,0), coalesce(vss.next_quantity_2,0), coalesce(vss.next_quantity_3,0),
        coalesce(vss.next_quantity_4,0), coalesce(vss.next_quantity_5,0), coalesce(vss.next_quantity_6,0)
       ) >= 50000
  );

comment on view public.vw_stock_quantity_outliers is
  'Observabilidade (read-only): linhas de variant_supplier_sources com quantidade atual/futura implausivel (>=50k un.) para revisao manual de erros de feed de fornecedor. Nao altera dados. Criada na auditoria do modulo Estoque 2026-06-17.';

grant select on public.vw_stock_quantity_outliers to authenticated;
