-- ============================================================================
-- CF-RECON 4 (D6) — Produtos sem imagem ativa
-- Aplicado em prod via MCP em 2026-06-16; este arquivo espelha o estado.
-- View de cobertura + enfileira os ATIVOS (gap real de vitrine) para sourcing.
-- Dos 302 produtos sem imagem ativa, apenas ~5 sao produtos ATIVOS (vitrine).
-- https://claude.ai/code/session_01MAV1SvJ69G694NWUzo2XeG
-- ============================================================================
create or replace view cf_recon.v_products_without_active_image as
select p.id as product_id, p.name, p.is_active as product_active,
       (select count(*) from public.product_images pi where pi.product_id=p.id) as total_images,
       (select count(*) from public.product_images pi where pi.product_id=p.id and pi.cf_sync_status='missing') as broken_images
from public.products p
where not exists (select 1 from public.product_images pi where pi.product_id=p.id and pi.is_active);
comment on view cf_recon.v_products_without_active_image is 'Produtos sem nenhuma imagem ativa (D6). product_active=true = gap de vitrine prioritario.';

insert into cf_recon.remediation(kind, product_id, image_db_id, cf_image_id, detail)
select 'product_no_active_image', product_id, null, null,
       jsonb_build_object('product_name', name, 'total_images', total_images, 'broken_images', broken_images)
from cf_recon.v_products_without_active_image v
where v.product_active is true
  and not exists (
    select 1 from cf_recon.remediation r
    where r.kind='product_no_active_image' and r.product_id = v.product_id
  );
