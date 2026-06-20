-- FAXINA DB — Tier 3: archive provably-dead FUNCTIONS (reversible: ALTER FUNCTION ... SET SCHEMA)
--
-- Applied to production (doufsxqlfjyuvxuezpln) on 2026-06-20 via Supabase MCP. Mirrors DB state.
-- Archived 11 functions (public functions 1170 -> 1159).
--
-- Narrow, high-confidence set only: explicitly __deprecated__-dated + debug/test/dryrun helpers.
-- Re-verifies at run time: 0 structural deps (pg_depend: triggers/policies/views/defaults),
-- 0 refs in other function bodies, 0 cron refs; repo-gated separately (0 .rpc()/string refs in code).
-- NOTE: ~570 further functions are DB-side-dead but are reachable via frontend .rpc(); they require
-- a per-batch repo .rpc() gate before archiving (see docs/FAXINA_DB_2026-06-20_TIER3.md). Not touched here.
-- Idempotent + manifest-logged. Rollback: scripts/faxina-rollback.sql.

do $$
declare
  r record; n int := 0;
  fn_names text[] := array[
    'fn_silver_to_gold__deprecated_20260606','fn_silver_batch_to_gold__deprecated_20260606',
    'debug_automations','debug_link_material','fn_test_dimension_parsers','fn_test_guc_visibility',
    'test_classify_batch','fn_dryrun_raw_v2','fn_dryrun_standardize_supplier',
    'fn_ingest_asia_hg_batch_debug','fn_ingest_asia_hg_debug_sample'
  ];
begin
  for r in
    select p.oid, p.proname, pg_get_function_identity_arguments(p.oid) as args
    from pg_proc p join pg_namespace nsp on nsp.oid=p.pronamespace
    where nsp.nspname='public' and p.proname = any(fn_names)
  loop
    if (select count(*) from pg_depend d where d.refobjid=r.oid and d.deptype in ('n','a') and d.classid <> 'pg_proc'::regclass) > 0 then
      raise notice 'SKIP fn % (structural deps)', r.proname; continue; end if;
    if (select count(*) from pg_proc p2 join pg_namespace n2 on n2.oid=p2.pronamespace where n2.nspname='public' and p2.oid<>r.oid and p2.prosrc ~ ('\m'||r.proname||'\M')) > 0 then
      raise notice 'SKIP fn % (fn-body ref)', r.proname; continue; end if;
    if (select count(*) from cron.job j where j.command ~ ('\m'||r.proname||'\M')) > 0 then
      raise notice 'SKIP fn % (cron ref)', r.proname; continue; end if;
    if exists (select 1 from pg_proc p3 join pg_namespace n3 on n3.oid=p3.pronamespace where n3.nspname='archive' and p3.proname=r.proname) then
      raise notice 'SKIP fn % (collision in archive)', r.proname; continue; end if;
    execute format('alter function public.%I(%s) set schema archive', r.proname, r.args);
    insert into archive._cleanup_manifest(object_type,object_name,reason,evidence,session)
    values ('function', r.proname||'('||r.args||')',
            'dead fn: deprecated/debug/test, 0 db refs (deps/fnbody/cron) + 0 repo refs',
            jsonb_build_object('phase','tier3_function'),'claude-faxina-2026-06-20');
    n := n + 1;
    raise notice 'ARCHIVED function public.%(%)', r.proname, r.args;
  end loop;
  raise notice 'Tier-3 archived % functions', n;
end $$;
