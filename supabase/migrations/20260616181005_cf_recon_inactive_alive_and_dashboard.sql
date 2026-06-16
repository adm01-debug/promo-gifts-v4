-- ============================================================================
-- CF-RECON 5 (D5) — Inativas vivas (custo potencial) + painel de saude
-- Aplicado em prod via MCP em 2026-06-16; este arquivo espelha o estado.
-- D5 tratado por VIEW (798 linhas nao poluem a fila). Painel KPI unico.
-- https://claude.ai/code/session_01MAV1SvJ69G694NWUzo2XeG
-- ============================================================================
create or replace view cf_recon.v_inactive_alive as
select pi.id, pi.product_id, pi.cloudflare_image_id, pi.cf_sync_status,
       pi.source_supplier, pi.cf_id_scheme, pi.updated_at
from public.product_images pi
where pi.is_active is false and pi.deleted_at is null;
comment on view cf_recon.v_inactive_alive is 'Imagens fora do catalogo (inativas) mas nao soft-deletadas. Candidatas a arquivamento.';

-- Custo recuperavel: inativas vivas cujo asset AINDA existe no Cloudflare (requer crawl).
create or replace view cf_recon.v_inactive_alive_cf_cost as
select ia.id, ia.product_id, ia.cloudflare_image_id, ia.cf_sync_status, ia.source_supplier
from cf_recon.v_inactive_alive ia
join cf_recon.cf_image ci on ci.image_id = ia.cloudflare_image_id;
comment on view cf_recon.v_inactive_alive_cf_cost is 'Inativas vivas que ocupam storage no CF (custo recuperavel apos revisao). Requer crawl populado.';

-- Painel consolidado de saude da reconciliacao
create or replace view cf_recon.v_health_dashboard as
select
  (select count(*) from public.product_images) as db_total,
  (select count(*) from public.product_images where is_active) as db_active,
  (select count(*) from public.product_images where cf_sync_status='verified') as verified,
  (select count(*) from public.product_images where cf_sync_status='pending') as pending,
  (select count(*) from public.product_images where cf_sync_status='missing') as missing,
  (select count(*) from public.product_images where cf_sync_status='missing' and is_active) as missing_active,
  (select count(*) from cf_recon.v_verification_queue) as queue_real,
  (select count(*) from cf_recon.remediation where status='open') as remediation_open,
  (select count(*) from cf_recon.cf_image) as cf_crawled,
  (select count(*) from cf_recon.action_log) as actions_logged;
comment on view cf_recon.v_health_dashboard is 'KPI unico da reconciliacao CF x product_images.';
