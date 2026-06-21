-- FAXINA DB — Tier 1d: archive tables freed after the Tier-3b function purge (reversible).
--
-- Applied to production (doufsxqlfjyuvxuezpln) on 2026-06-20 via Supabase MCP. DETERMINISTIC mirror:
-- moves the EXACT tables archived in production, guarded by "only if still in public" (idempotent),
-- so a shadow DB / `supabase db reset` reproduces production exactly (no schema drift).
-- (Other Tier-1d candidates were preserved in production because a live view/function still references
-- them; they are intentionally NOT listed here.)
--
-- Evidence (computed at archive time): 0 refs in db (view/fn/cron/policy/inbound-FK) and repo,
-- 0 writes lifetime, not realtime/partition. Rollback: scripts/faxina-rollback.sql.
create schema if not exists archive;
do $$
declare
  t text; v_rows bigint; moved int := 0;
  tables text[] := array[
    'category_accessory_categories','classify_functions_registry','edge_function_invocations',
    'enrichment_log','magic_up_reactions','quote_drafts','supplier_customization_options_raw'
  ];
begin
  foreach t in array tables loop
    if not exists (select 1 from information_schema.tables where table_schema='public' and table_name=t) then
      raise notice 'SKIP % (not in public)', t; continue; end if;
    if exists (select 1 from information_schema.tables where table_schema='archive' and table_name=t) then
      raise notice 'SKIP % (collision in archive)', t; continue; end if;
    execute format('select count(*) from public.%I', t) into v_rows;
    execute format('alter table public.%I set schema archive', t);
    insert into archive._cleanup_manifest(object_type,object_name,rows_at_move,reason,evidence,session)
    values ('table', t, v_rows,
            'tier1d orphan (deterministic mirror): freed after fn purge; 0 refs db+repo, 0 writes lifetime, not realtime/partition',
            jsonb_build_object('phase','tier1d_orphan'), 'claude-faxina-2026-06-20');
    moved := moved + 1; raise notice 'ARCHIVED public.% -> archive (% rows)', t, v_rows;
  end loop;
  raise notice 'Tier1d mirror archived % tables', moved;
end $$;
NOTIFY pgrst, 'reload schema';
