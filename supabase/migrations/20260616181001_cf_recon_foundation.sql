-- ============================================================================
-- CF-RECON 0 — Fundacao de Reconciliacao Cloudflare x product_images
-- Aplicado em prod via MCP em 2026-06-16; este arquivo espelha o estado.
-- Schema isolado `cf_recon`, aditivo e idempotente. Nada em public e mutado.
-- Nao exposto via PostgREST (schema fora do search_path da API).
-- https://claude.ai/code/session_01MAV1SvJ69G694NWUzo2XeG
-- ============================================================================
create schema if not exists cf_recon;
comment on schema cf_recon is 'Reconciliacao product_images x Cloudflare Images. Mantido por Claude/pipeline. Nao exposto via PostgREST.';

-- Inventario do crawl do Cloudflare (espelho do estado do CF)
create table if not exists cf_recon.cf_image (
  image_id      text primary key,
  uploaded_at   timestamptz,
  filename      text,
  meta          jsonb,
  crawl_run_id  uuid,
  first_seen_at timestamptz not null default now(),
  last_seen_at  timestamptz not null default now()
);
comment on table cf_recon.cf_image is 'Inventario de imagens existentes no Cloudflare (preenchido por crawl paginado).';

-- Execucoes de crawl (resumivel/auditavel)
create table if not exists cf_recon.crawl_run (
  id            uuid primary key default gen_random_uuid(),
  started_at    timestamptz not null default now(),
  finished_at   timestamptz,
  pages_scanned int not null default 0,
  images_seen   int not null default 0,
  cf_total_reported int,
  status        text not null default 'running' check (status in ('running','completed','failed','partial')),
  notes         text
);

-- Trilha de auditoria: TODA alteracao feita pela reconciliacao
create table if not exists cf_recon.action_log (
  id            bigserial primary key,
  acted_at      timestamptz not null default now(),
  actor         text not null default 'claude',
  action        text not null,
  image_db_id   uuid,
  cf_image_id   text,
  old_status    text,
  new_status    text,
  evidence      jsonb,
  reversible    boolean not null default true
);
comment on table cf_recon.action_log is 'Auditoria imutavel de cada reclassificacao/quarentena aplicada.';

-- Snapshots de metricas ao longo do tempo
create table if not exists cf_recon.metric_snapshot (
  id        bigserial primary key,
  taken_at  timestamptz not null default now(),
  metrics   jsonb not null
);

-- View: fila canonica de verificacao (exclui deletados/hash_legacy = ruido)
create or replace view cf_recon.v_verification_queue as
select pi.id, pi.cloudflare_image_id, pi.cf_sync_status, pi.cf_id_scheme,
       pi.source_supplier, pi.cf_check_attempts, pi.is_active, pi.created_at
from public.product_images pi
where pi.cf_sync_status <> 'verified'
  and pi.deleted_at is null
  and coalesce(pi.cf_id_scheme,'') <> 'hash_legacy';
comment on view cf_recon.v_verification_queue is 'Fila real de verificacao CF: pendentes vivos, sem deletados/hash_legacy.';

-- View: divergencias DB x CF (util apos crawl popular cf_image)
create or replace view cf_recon.v_divergence as
select
  pi.id              as db_id,
  pi.cloudflare_image_id,
  pi.cf_sync_status,
  pi.cf_id_scheme,
  pi.source_supplier,
  pi.is_active,
  pi.deleted_at is not null as is_deleted,
  (ci.image_id is not null) as exists_in_cf,
  case
    when ci.image_id is not null and pi.cf_sync_status <> 'verified' then 'cf_present_db_unverified'
    when ci.image_id is null and pi.deleted_at is not null then 'deleted_noise'
    when ci.image_id is null and pi.is_active then 'broken_reference_active'
    when ci.image_id is null and not pi.is_active then 'broken_reference_inactive'
    else 'ok'
  end as divergence_class
from public.product_images pi
left join cf_recon.cf_image ci on ci.image_id = pi.cloudflare_image_id;
comment on view cf_recon.v_divergence is 'Classificacao de divergencia por linha (requer cf_image populado via crawl).';

-- View: orfas do lado Cloudflare (imagens no CF sem dono no DB)
create or replace view cf_recon.v_cf_orphans as
select ci.image_id, ci.uploaded_at, ci.filename
from cf_recon.cf_image ci
left join public.product_images pi on pi.cloudflare_image_id = ci.image_id
where pi.id is null;
comment on view cf_recon.v_cf_orphans is 'Imagens existentes no Cloudflare sem referencia em product_images (candidatas a custo recuperavel).';
