-- FAXINA DB — Tier 1d: archive tables freed after the Tier-3b function purge (reversible).
--
-- Applied to production (doufsxqlfjyuvxuezpln) on 2026-06-20 via Supabase MCP apply_migration.
-- This file mirrors the applied migration so repo == database.
-- Same self-verifying gates as Tier 1c + partition-safety. Skips anything still wired
-- (a live view/function still references many of these candidates, so they are intentionally preserved).
-- Rollback: scripts/faxina-rollback.sql (session='claude-faxina-2026-06-20').
create schema if not exists archive;
do $$
declare
  t text; v_rows bigint; v_writes bigint; v_oid oid; moved int:=0; skipped int:=0;
  cands text[] := array[
    'category_accessory_categories','classify_functions_registry','commemorative_date_colors',
    'conversation_audit_logs','conversation_event_history','e2e_cleanup_rate_limit','edge_function_invocations',
    'enriched_contacts','enrichment_log','import_pipeline_steps','kit_share_tokens','magic_up_reactions',
    'mcp_access_violations','mockup_approval_links','mockup_credit_transactions','mockup_credits',
    'optimization_queue_runs','packaging_types','quote_approval_tokens','quote_drafts','quote_versions',
    'recently_viewed_products','schema_drift_allowlist','seo_redirects','supplier_customization_options_raw',
    'supplier_products_raw_history','supplier_unit_conversions','user_search_history','video_types'
  ];
begin
  foreach t in array cands loop
    select c.oid into v_oid from pg_class c join pg_namespace n on n.oid=c.relnamespace
      where n.nspname='public' and c.relname=t and c.relkind in ('r','p');
    if v_oid is null then raise notice 'SKIP % (not a public table)', t; skipped:=skipped+1; continue; end if;
    if exists (select 1 from pg_class c where c.oid=v_oid and (c.relkind='p' or c.relispartition))
       or exists (select 1 from pg_inherits where inhparent=v_oid) then
       raise notice 'SKIP % (partitioned/has children)', t; skipped:=skipped+1; continue; end if;
    if exists (select 1 from information_schema.tables where table_schema='archive' and table_name=t) then
       raise notice 'SKIP % (collision)', t; skipped:=skipped+1; continue; end if;
    select coalesce(n_tup_ins,0)+coalesce(n_tup_upd,0)+coalesce(n_tup_del,0) into v_writes
      from pg_stat_user_tables where schemaname='public' and relname=t;
    if coalesce(v_writes,0) > 0 then raise notice 'SKIP % (writes=%)', t, v_writes; skipped:=skipped+1; continue; end if;
    if exists (select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename=t) then
       raise notice 'SKIP % (realtime)', t; skipped:=skipped+1; continue; end if;
    if exists (select 1 from pg_constraint k join pg_class child on child.oid=k.conrelid join pg_namespace cn on cn.oid=child.relnamespace
               where k.contype='f' and k.confrelid=v_oid and cn.nspname not in ('archive','backup')
                 and not (cn.nspname='public' and child.relname = any(cands))) then
       raise notice 'SKIP % (inbound FK from active)', t; skipped:=skipped+1; continue; end if;
    if exists (select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace
               where n.nspname='public' and c.relkind in ('v','m') and pg_get_viewdef(c.oid) ~ ('\m'||t||'\M')) then
       raise notice 'SKIP % (view ref)', t; skipped:=skipped+1; continue; end if;
    if exists (select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace
               where n.nspname='public' and p.prosrc ~ ('\m'||t||'\M')) then
       raise notice 'SKIP % (public fn ref)', t; skipped:=skipped+1; continue; end if;
    if exists (select 1 from cron.job where command ~ ('\m'||t||'\M')) then
       raise notice 'SKIP % (cron ref)', t; skipped:=skipped+1; continue; end if;
    if exists (select 1 from pg_policies where tablename<>t and (coalesce(qual,'')~('\m'||t||'\M') or coalesce(with_check,'')~('\m'||t||'\M'))) then
       raise notice 'SKIP % (policy ref)', t; skipped:=skipped+1; continue; end if;

    execute format('select count(*) from public.%I', t) into v_rows;
    execute format('alter table public.%I set schema archive', t);
    insert into archive._cleanup_manifest(object_type,object_name,rows_at_move,reason,evidence,session)
    values ('table', t, v_rows,
            'tier1d orphan: freed after fn purge; 0 refs in db(view/fn/cron/policy/inbound-FK)+repo, 0 writes lifetime, not realtime/partition',
            jsonb_build_object('phase','tier1d_orphan'), 'claude-faxina-2026-06-20');
    moved:=moved+1; raise notice 'ARCHIVED public.% (% rows)', t, v_rows;
  end loop;
  raise notice 'Tier1d archived % tables (skipped %)', moved, skipped;
end $$;
NOTIFY pgrst, 'reload schema';
