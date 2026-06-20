-- FAXINA DB — Tier 3c: archive only the unambiguously-safe dead functions.
--
-- Applied to production (doufsxqlfjyuvxuezpln) on 2026-06-20 via Supabase MCP. Mirrors DB state.
-- Archived 17 functions (public functions 1159 -> 1142).
--
-- Method: combined STATIC analysis (no FK/trigger/policy/view/default deps, no cron refs, no other
-- function-body refs, non-dynamic/feature/versioned families) with 12 days of RUNTIME call data from
-- pg_stat_statements (0 real calls), then INDIVIDUALLY reviewed the survivors. Only pure stateless
-- converters/formatters, DETACHED duplicate updated_at trigger functions, and dev diagnostics were kept.
-- Each is re-gated at run time (skips on ANY dependency/trigger/caller). Reversible: scripts/faxina-rollback.sql.
--
-- NOTE: ~314 further functions are statically "dead" but could NOT be proven safe automatically because
-- (a) pg_stat_statements is at capacity (4985/5000) and evicts moderate-frequency calls, and
-- (b) the codebase uses dynamic dispatch (.rpc(var), classify_* registry, pipeline dynamic SQL).
-- See docs/FAXINA_DB_2026-06-20_TIER3C.md for the safe path to finish them.

do $$
declare r record; n int := 0;
  fns text[] := array[
    'cm_to_mm','mm_to_cm','g_to_kg','kg_to_g','l_to_ml','ml_to_l','m_to_cm',
    'fn_circumference_to_diameter','fn_hex_to_rgb','convert_string_to_unit',
    'fn_format_capacity_display','fn_format_dimensions_display',
    'tg_set_updated_at','trigger_set_updated_at','fn_cor_updated_at',
    'fn_index_usage_report','fn_assert_public_contract'
  ];
begin
  for r in
    select p.oid, p.proname, pg_get_function_identity_arguments(p.oid) as args
    from pg_proc p join pg_namespace nsp on nsp.oid=p.pronamespace
    where nsp.nspname='public' and p.proname = any(fns)
  loop
    if (select count(*) from pg_depend d where d.refobjid=r.oid and d.deptype in ('n','a') and d.classid <> 'pg_proc'::regclass) > 0 then
      raise notice 'SKIP % (structural deps)', r.proname; continue; end if;
    if (select count(*) from pg_trigger t where t.tgfoid=r.oid and not t.tgisinternal) > 0 then
      raise notice 'SKIP % (attached trigger)', r.proname; continue; end if;
    if (select count(*) from cron.job j where j.command ~ ('\m'||r.proname||'\M')) > 0 then
      raise notice 'SKIP % (cron ref)', r.proname; continue; end if;
    if (select count(*) from pg_proc p2 join pg_namespace n2 on n2.oid=p2.pronamespace where n2.nspname='public' and p2.oid<>r.oid and p2.prosrc ~ ('\m'||r.proname||'\M')) > 0 then
      raise notice 'SKIP % (fn-body ref)', r.proname; continue; end if;
    if exists (select 1 from pg_proc p3 join pg_namespace n3 on n3.oid=p3.pronamespace where n3.nspname='archive' and p3.proname=r.proname) then
      raise notice 'SKIP % (archive collision)', r.proname; continue; end if;
    execute format('alter function public.%I(%s) set schema archive', r.proname, r.args);
    insert into archive._cleanup_manifest(object_type,object_name,reason,evidence,session)
    values ('function', r.proname||'('||r.args||')',
            'Tier 3c: pure utility / detached trigger / diagnostic; static-dead + 0 calls in 12d pgss; individually reviewed',
            jsonb_build_object('phase','tier3c_function'),'claude-faxina-2026-06-20');
    n := n + 1;
    raise notice 'ARCHIVED %()', r.proname;
  end loop;
  raise notice 'Tier-3c archived % functions', n;
end $$;
