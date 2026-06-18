-- Follow-up de revisão (CodeRabbit/Cubic P2): severidade do outlier view passa a
-- usar GREATEST(atual, futuro) — linhas admitidas pela janela de FUTURO já não
-- ficam subclassificadas. Espelha o que foi aplicado em produção.
create or replace view public.vw_stock_quantity_outliers
with (security_invoker = true) as
select
  vss.id            as source_id,
  vss.variant_id,
  pv.product_id,
  p.sku             as product_sku,
  p.name            as product_name,
  vss.supplier_id,
  vsp.name          as supplier_name,
  vss.quantity      as current_quantity,
  greatest(coalesce(vss.next_quantity_1,0), coalesce(vss.next_quantity_2,0), coalesce(vss.next_quantity_3,0),
           coalesce(vss.next_quantity_4,0), coalesce(vss.next_quantity_5,0), coalesce(vss.next_quantity_6,0)) as max_future_quantity,
  vss.updated_at,
  case
    when greatest(coalesce(vss.quantity,0), coalesce(vss.next_quantity_1,0), coalesce(vss.next_quantity_2,0), coalesce(vss.next_quantity_3,0),
                  coalesce(vss.next_quantity_4,0), coalesce(vss.next_quantity_5,0), coalesce(vss.next_quantity_6,0)) >= 1000000 then 'extreme'
    when greatest(coalesce(vss.quantity,0), coalesce(vss.next_quantity_1,0), coalesce(vss.next_quantity_2,0), coalesce(vss.next_quantity_3,0),
                  coalesce(vss.next_quantity_4,0), coalesce(vss.next_quantity_5,0), coalesce(vss.next_quantity_6,0)) >= 100000 then 'high'
    else 'elevated'
  end as severity
from variant_supplier_sources vss
join product_variants pv on pv.id = vss.variant_id
join products p on p.id = pv.product_id
left join v_suppliers_public vsp on vsp.id = vss.supplier_id
where vss.is_active and (
  vss.quantity >= 50000
  or greatest(coalesce(vss.next_quantity_1,0), coalesce(vss.next_quantity_2,0), coalesce(vss.next_quantity_3,0),
              coalesce(vss.next_quantity_4,0), coalesce(vss.next_quantity_5,0), coalesce(vss.next_quantity_6,0)) >= 50000
);

comment on view public.vw_stock_quantity_outliers is
  'Observabilidade (read-only): linhas de vss com quantidade atual OU futura implausivelmente alta (>=50k). Severidade = GREATEST(atual, futuro). NÃO altera dados. Auditoria Estoque 2026-06-17.';

-- Backfill único (item revisão P2): em ambientes já populados, o trigger BEFORE só
-- saneia escritas futuras. Aqui limpamos datas vencidas/qty órfã pré-existentes.
-- Idempotente; em DB recriado é no-op (sem dados).
do $$
declare tbl text; col_d text; col_q text; i int;
begin
  foreach tbl in array array['variant_supplier_sources','product_variants'] loop
    for i in 1..6 loop
      col_d := format('next_date_%s', i); col_q := format('next_quantity_%s', i);
      execute format('update public.%I set %I = null where %I is not null and %I < current_date', tbl, col_d, col_d, col_d);
      execute format('update public.%I set %I = null where %I is not null and %I is null', tbl, col_q, col_q, col_d);
    end loop;
  end loop;
end $$;
