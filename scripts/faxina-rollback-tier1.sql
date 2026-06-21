-- Rollback for the Tier-1 database faxina (2026-06-20).
-- Moves every table archived in that session back to the public schema.
-- Safe & idempotent: only restores objects currently in archive and absent from public.
--
-- Usage (Supabase SQL editor or psql):
--   \i scripts/faxina-rollback-tier1.sql
-- Or restore a single table:
--   ALTER TABLE archive.<table_name> SET SCHEMA public;

do $$
declare r record;
begin
  for r in
    select object_name
    from archive._cleanup_manifest
    where session = 'claude-faxina-2026-06-20'
      and object_type = 'table'
    order by id desc
  loop
    if exists (select 1 from information_schema.tables where table_schema='archive' and table_name=r.object_name)
       and not exists (select 1 from information_schema.tables where table_schema='public' and table_name=r.object_name)
    then
      execute format('alter table archive.%I set schema public', r.object_name);
      raise notice 'RESTORED archive.% -> public.%', r.object_name, r.object_name;
    else
      raise notice 'SKIP % (not in archive, or already in public)', r.object_name;
    end if;
  end loop;
end $$;
