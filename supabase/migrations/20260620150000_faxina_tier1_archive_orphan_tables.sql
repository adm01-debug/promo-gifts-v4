-- FAXINA DB — Tier 1: archive provably-dead tables (reversible: ALTER TABLE ... SET SCHEMA)
--
-- Applied to production (doufsxqlfjyuvxuezpln) on 2026-06-20 via Supabase MCP apply_migration.
-- This file mirrors the applied migration so repo == database.
--
-- Selection evidence (ALL must hold) per archived table:
--   * 0 inbound foreign keys, 0 dependent views, not a partition child
--   * 0 live rows, 0 writes over the full DB lifetime (pg_stat never reset), < 250 scans
--   * 0 references in any function body (pg_proc.prosrc), cron command, or RLS policy
--   * 0 references in the repo (src/ + supabase/functions/ + tests/ + e2e/) as string literals
--   * not a member of the supabase_realtime publication
-- Backups: dated operational snapshots that were living in the public schema.
--
-- The block is idempotent: it skips tables not present in public or already present in archive.
-- Rollback: scripts/faxina-rollback-tier1.sql (or: ALTER TABLE archive.<name> SET SCHEMA public).

create schema if not exists archive;

create table if not exists archive._cleanup_manifest (
  id            bigint generated always as identity primary key,
  moved_at      timestamptz not null default now(),
  object_type   text not null,
  object_name   text not null,
  from_schema   text not null default 'public',
  to_schema     text not null default 'archive',
  rows_at_move  bigint,
  reason        text,
  evidence      jsonb,
  session       text
);
comment on table archive._cleanup_manifest is
  'Audit log of the database faxina (cleanup). One row per object moved public->archive, with evidence, enabling precise one-command rollback.';

do $$
declare
  t text; v_rows bigint;
  -- IMPORTANT: notification_preferences, product_target_audiences and user_favorites are
  -- intentionally NOT in this list — they are NOT orphans:
  --   * notification_preferences  -> read by the live SECURITY DEFINER fn is_dnd_active()
  --     (20260620180000), called by the send-notification edge fn (runtime DND check).
  --   * product_target_audiences  -> indexed by 20260620150000_fix_catalog_critical_bugs.sql.
  --   * user_favorites            -> policy recreated by 20260620160000_fix_favorites_bugs_all.sql.
  -- Archiving them aborted clean replay (`supabase db reset`/preview/DR) at the CREATE
  -- INDEX/POLICY steps and broke DND at runtime. See 20260620190000_heal_faxina_live_tables.
  orphans text[] := array[
    'sm_worker_partitions','conversation_delivery_status',
    'magic_up_comments','push_subscriptions','user_allowed_ips','user_filter_presets',
    'magic_up_public_shares','product_search_logs','comparison_reactions','notification_templates',
    'order_item_personalizations','favorite_item_reactions','system_changelog','category_relationships',
    'seo_audit_log','supplier_field_priority','collection_item_reactions','attribute_equivalences',
    'search_queries'
  ];
  backups text[] := array[
    '_backup_stock_daily_summary_20260618','_bkp_kit_dims_20260619','_bkp_orphan_active_variants_20260619'
  ];
begin
  foreach t in array orphans loop
    if not exists (select 1 from information_schema.tables where table_schema='public' and table_name=t) then
      raise notice 'SKIP % (not in public)', t; continue; end if;
    if exists (select 1 from information_schema.tables where table_schema='archive' and table_name=t) then
      raise notice 'SKIP % (name collision in archive)', t; continue; end if;
    execute format('select count(*) from public.%I', t) into v_rows;
    execute format('alter table public.%I set schema archive', t);
    insert into archive._cleanup_manifest(object_type,object_name,rows_at_move,reason,evidence,session)
    values ('table',t,v_rows,'orphan: zero refs in db+repo, 0 rows, 0 writes lifetime',
            jsonb_build_object('phase','tier1_orphan'),'claude-faxina-2026-06-20');
    raise notice 'ARCHIVED public.% -> archive.% (% rows)', t,t,v_rows;
  end loop;

  foreach t in array backups loop
    if not exists (select 1 from information_schema.tables where table_schema='public' and table_name=t) then
      raise notice 'SKIP % (not in public)', t; continue; end if;
    if exists (select 1 from information_schema.tables where table_schema='archive' and table_name=t) then
      raise notice 'SKIP % (name collision in archive)', t; continue; end if;
    execute format('select count(*) from public.%I', t) into v_rows;
    execute format('alter table public.%I set schema archive', t);
    insert into archive._cleanup_manifest(object_type,object_name,rows_at_move,reason,evidence,session)
    values ('table',t,v_rows,'dated operational backup snapshot living in public',
            jsonb_build_object('phase','tier1_backup'),'claude-faxina-2026-06-20');
    raise notice 'ARCHIVED public.% -> archive.% (% rows)', t,t,v_rows;
  end loop;
end $$;
