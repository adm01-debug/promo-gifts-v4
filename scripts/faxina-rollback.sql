-- Comprehensive rollback for the database faxina (2026-06-20) — supersedes faxina-rollback-tier1.sql.
-- Restores EVERY object archived in the session (tables, views, functions) back to public,
-- driven by archive._cleanup_manifest. Safe & idempotent.
--
-- Usage (Supabase SQL editor or psql):
--   \i scripts/faxina-rollback.sql
-- Restore a single object manually:
--   ALTER TABLE archive.<t>    SET SCHEMA public;
--   ALTER VIEW  archive.<v>    SET SCHEMA public;
--   ALTER FUNCTION archive.<f>(<args>) SET SCHEMA public;

do $$
declare
  r record; sig text; fn_bare text;
begin
  for r in
    select object_type, object_name
    from archive._cleanup_manifest
    where session = 'claude-faxina-2026-06-20'
    order by id desc
  loop
    begin
      if r.object_type = 'table' then
        if exists (select 1 from information_schema.tables where table_schema='archive' and table_name=r.object_name)
           and not exists (select 1 from information_schema.tables where table_schema='public' and table_name=r.object_name) then
          execute format('alter table archive.%I set schema public', r.object_name);
          raise notice 'RESTORED table %', r.object_name;
        end if;

      elsif r.object_type = 'view' then
        if exists (select 1 from information_schema.views where table_schema='archive' and table_name=r.object_name)
           and not exists (select 1 from information_schema.views where table_schema='public' and table_name=r.object_name) then
          execute format('alter view archive.%I set schema public', r.object_name);
          raise notice 'RESTORED view %', r.object_name;
        end if;

      elsif r.object_type = 'function' then
        fn_bare := split_part(r.object_name, '(', 1);
        for sig in
          select pg_get_function_identity_arguments(p.oid)
          from pg_proc p join pg_namespace n on n.oid = p.pronamespace
          where n.nspname='archive' and p.proname = fn_bare
        loop
          execute format('alter function archive.%I(%s) set schema public', fn_bare, sig);
          raise notice 'RESTORED function %(%)', fn_bare, sig;
        end loop;
      end if;
    exception when others then
      raise notice 'SKIP % % : %', r.object_type, r.object_name, sqlerrm;
    end;
  end loop;
end $$;
