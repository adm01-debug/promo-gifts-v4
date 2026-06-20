-- FAXINA DB — Tier 1c: archive further provably-dead tables (reversible: ALTER TABLE ... SET SCHEMA).
--
-- Applied to production (doufsxqlfjyuvxuezpln) on 2026-06-20 via Supabase MCP apply_migration.
-- This file mirrors the applied migration so repo == database.
-- Continuation of docs/FAXINA_DB_2026-06-20.md (same session/manifest/rollback).
--
-- Self-verifying: re-checks every evidence gate at runtime and skips on any doubt
--   (0 writes lifetime, not in realtime publication, no inbound FK from an active table,
--    0 refs in any public view / public function body / cron command / RLS policy).
-- Rollback: scripts/faxina-rollback.sql (session='claude-faxina-2026-06-20').
create schema if not exists archive;
do $$
declare
  t text; v_rows bigint; v_writes bigint;
  cands text[] := array[
    'analytics_events','attribute_definitions','attribute_groups',
    'category_target_audiences','company_email_patterns','target_audiences'
  ];
begin
  foreach t in array cands loop
    if not exists (select 1 from information_schema.tables where table_schema='public' and table_name=t) then
      raise notice 'SKIP % (not in public)', t; continue; end if;
    if exists (select 1 from information_schema.tables where table_schema='archive' and table_name=t) then
      raise notice 'SKIP % (collision in archive)', t; continue; end if;
    select coalesce(n_tup_ins,0)+coalesce(n_tup_upd,0)+coalesce(n_tup_del,0) into v_writes
      from pg_stat_user_tables where schemaname='public' and relname=t;
    if coalesce(v_writes,0) > 0 then raise notice 'SKIP % (writes=%)', t, v_writes; continue; end if;
    if exists (select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename=t) then
      raise notice 'SKIP % (realtime)', t; continue; end if;
    if exists (
      select 1 from pg_constraint k
      join pg_class child on child.oid=k.conrelid
      join pg_namespace cn on cn.oid=child.relnamespace
      where k.contype='f' and k.confrelid = ('public.'||quote_ident(t))::regclass
        and cn.nspname not in ('archive','backup')
        and not (cn.nspname='public' and child.relname = any(cands))
    ) then raise notice 'SKIP % (inbound FK from active table)', t; continue; end if;
    if exists (select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace
               where n.nspname='public' and c.relkind in ('v','m') and pg_get_viewdef(c.oid) ~ ('\m'||t||'\M')) then
      raise notice 'SKIP % (referenced by a view)', t; continue; end if;
    if exists (select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace
               where n.nspname='public' and p.prosrc ~ ('\m'||t||'\M')) then
      raise notice 'SKIP % (referenced by a function)', t; continue; end if;
    if exists (select 1 from cron.job where command ~ ('\m'||t||'\M')) then
      raise notice 'SKIP % (referenced by cron)', t; continue; end if;
    if exists (select 1 from pg_policies where tablename<>t and (coalesce(qual,'') ~ ('\m'||t||'\M') or coalesce(with_check,'') ~ ('\m'||t||'\M'))) then
      raise notice 'SKIP % (referenced by RLS policy)', t; continue; end if;

    execute format('select count(*) from public.%I', t) into v_rows;
    execute format('alter table public.%I set schema archive', t);
    insert into archive._cleanup_manifest(object_type,object_name,rows_at_move,reason,evidence,session)
    values ('table', t, v_rows,
            'tier1c orphan: 0 refs in db (view/fn/cron/policy/inbound-FK) and repo, 0 rows, 0 writes lifetime, not in realtime',
            jsonb_build_object('phase','tier1c_orphan'), 'claude-faxina-2026-06-20');
    raise notice 'ARCHIVED public.% -> archive (% rows)', t, v_rows;
  end loop;
end $$;
-- NOTE: analytics_events was intentionally preserved by the runtime gate (it received writes — live telemetry).
NOTIFY pgrst, 'reload schema';
