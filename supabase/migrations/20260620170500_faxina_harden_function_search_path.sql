-- FAXINA DB — Security hardening: pin search_path on mutable-search_path functions.
--
-- Applied to production (doufsxqlfjyuvxuezpln) on 2026-06-20 via Supabase MCP. Mirrors DB state.
-- Pinned 47 functions -> clears the advisor "function_search_path_mutable" findings (49 -> 0 for the safe set).
--
-- Scope (conservative, behaviour-preserving): public functions (plpgsql/sql), SECURITY INVOKER, with NO
-- search_path set, whose bodies reference NO other schema (net/vault/cron/auth/storage/graphql/pgmq/realtime).
-- For these, pinning to 'public, extensions, pg_temp' cannot change name resolution. SECURITY DEFINER
-- functions already had search_path pinned and were intentionally left untouched.
-- Reversible: ALTER FUNCTION <f>(<args>) RESET search_path.

do $$
declare r record; n int := 0;
begin
  for r in
    select p.proname, pg_get_function_identity_arguments(p.oid) as args
    from pg_proc p
    join pg_namespace nsp on nsp.oid=p.pronamespace
    join pg_language  l  on l.oid=p.prolang
    where nsp.nspname='public' and p.prokind='f' and p.prosecdef = false
      and l.lanname in ('plpgsql','sql')
      and not exists (select 1 from unnest(coalesce(p.proconfig,'{}'::text[])) c where c like 'search_path=%')
      and p.prosrc !~* '(net\.|vault\.|cron\.|auth\.|storage\.|graphql|pgmq|realtime|supabase_)'
  loop
    execute format('alter function public.%I(%s) set search_path = public, extensions, pg_temp', r.proname, r.args);
    n := n + 1;
  end loop;
  raise notice 'Pinned search_path on % public-scoped SECURITY INVOKER functions', n;
end $$;
