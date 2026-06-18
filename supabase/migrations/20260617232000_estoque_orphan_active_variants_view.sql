-- Auditoria do módulo Estoque (2026-06-17) — observabilidade NÃO destrutiva.
-- Variantes is_active=true cujo produto-pai está deletado/inativo. São invisíveis
-- no dashboard (v_products_public exclui o pai), mas o estado diverge. As que estão
-- sob produto apenas INATIVO (reversível) são preservadas de propósito p/ reativação;
-- as sob produto DELETADO (terminal) foram desativadas na auditoria (19 linhas).
create or replace view public.vw_orphan_active_variants
with (security_invoker = true) as
select
  v.id           as variant_id,
  v.sku          as variant_sku,
  v.color_name,
  v.product_id,
  p.sku          as product_sku,
  p.name         as product_name,
  p.is_deleted   as product_is_deleted,
  p.is_active    as product_is_active,
  coalesce(v.stock_quantity,0) as variant_stock,
  case when p.is_deleted is true then 'under_deleted_product'
       else 'under_inactive_product' end as reason
from public.product_variants v
join public.products p on p.id = v.product_id
where v.is_active is true and (p.is_deleted is true or p.is_active is not true);

comment on view public.vw_orphan_active_variants is
  'Observabilidade (read-only): variantes ativas sob produto deletado/inativo (invisíveis no dashboard). reason=under_deleted_product são candidatas a desativação; under_inactive_product são preservadas p/ reativação. Auditoria Estoque 2026-06-17.';

grant select on public.vw_orphan_active_variants to authenticated;
