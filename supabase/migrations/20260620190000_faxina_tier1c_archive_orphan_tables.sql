-- FAXINA DB — Tier 1c: archive further provably-dead tables (reversible: ALTER TABLE ... SET SCHEMA).
--
-- Applied to production (doufsxqlfjyuvxuezpln) on 2026-06-20 via Supabase MCP. DETERMINISTIC mirror:
-- moves the EXACT tables archived in production, guarded by "only if still in public" (idempotent),
-- so a shadow DB / `supabase db reset` reproduces production exactly (no schema drift).
-- NOTE: analytics_events was a candidate but is intentionally NOT here — the runtime gate preserved it
-- in production (it received writes; live telemetry).
--
-- Evidence (computed at archive time): 0 refs in db (view/fn/cron/policy/inbound-FK) and repo,
-- 0 rows, 0 writes lifetime, not in realtime. Rollback: scripts/faxina-rollback.sql.
create schema if not exists archive;
do $$
declare
  t text; v_rows bigint; moved int := 0;
  tables text[] := array[
    'attribute_definitions','attribute_groups','category_target_audiences',
    'company_email_patterns','target_audiences'
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
            'tier1c orphan (deterministic mirror): 0 refs db+repo, 0 rows, 0 writes lifetime, not realtime',
            jsonb_build_object('phase','tier1c_orphan'), 'claude-faxina-2026-06-20');
    moved := moved + 1; raise notice 'ARCHIVED public.% -> archive (% rows)', t, v_rows;
  end loop;
  raise notice 'Tier1c mirror archived % tables', moved;
end $$;
NOTIFY pgrst, 'reload schema';
