-- HEAL: reverse the part of the faxina (20260620150000_faxina_tier1) that archived three
-- LIVE tables, and re-run the backfills/objects affected. Idempotent and safe on a fresh DB
-- (the orphans list no longer archives these, so no `archive.<t>` copy exists and every
-- block below is a no-op).
--
-- Why these three were not orphans:
--   * notification_preferences  — read by is_dnd_active() (SECURITY DEFINER, 20260620180000),
--     called by the send-notification edge fn. With the table in `archive`, the DND check
--     throws "relation notification_preferences does not exist" at runtime.
--   * product_target_audiences  — indexed by 20260620150000_fix_catalog_critical_bugs.sql.
--   * user_favorites            — policy recreated by 20260620160000_fix_favorites_bugs_all.sql.

-- 1) Move the tables back to public if a prior faxina run archived them, and restore the
--    API-role grants that tier1b revoked while they sat in `archive`. RLS still governs
--    row access; service_role/postgres (crons, edge fns, SECURITY DEFINER) are unaffected.
do $$
declare t text;
begin
  foreach t in array array['notification_preferences','product_target_audiences','user_favorites'] loop
    if exists (select 1 from information_schema.tables where table_schema = 'archive' and table_name = t)
       and not exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = t) then
      execute format('alter table archive.%I set schema public', t);
      -- product_target_audiences is reference data (read-only for the API roles); the two
      -- user-scoped tables keep full DML behind RLS.
      if t = 'product_target_audiences' then
        execute 'grant select on public.product_target_audiences to authenticated';
      else
        execute format('grant select, insert, update, delete on public.%I to authenticated', t);
      end if;
      delete from archive._cleanup_manifest where object_name = t and to_schema = 'archive';
      raise notice 'HEAL: restored public.% from archive', t;
    end if;
  end loop;
end $$;

-- 2) Re-assert the objects the sibling migrations create on these tables, in case the
--    original CREATE was skipped/failed on an environment where the table was archived.
do $$
begin
  if exists (select 1 from information_schema.tables
             where table_schema = 'public' and table_name = 'product_target_audiences') then
    execute 'create index if not exists idx_product_target_audiences_category_id '
         || 'on public.product_target_audiences (category_id)';
  end if;

  if exists (select 1 from information_schema.tables
             where table_schema = 'public' and table_name = 'user_favorites')
     and not exists (select 1 from pg_policies
             where schemaname = 'public' and tablename = 'user_favorites'
               and policyname = 'users_create_own_favorites') then
    execute 'create policy users_create_own_favorites on public.user_favorites '
         || 'for insert to authenticated with check (user_id = auth.uid())';
  end if;
end $$;

-- 3) Re-backfill generated_mockups.logo_rotation / logo_scale from area_config. The original
--    20260620000001 migration added the columns with DEFAULT 0/100, so its `WHERE ... IS NULL`
--    backfill matched nothing and clobbered older rows to the default while the real values
--    still live in area_config.
update public.generated_mockups
set
  logo_rotation = coalesce((area_config ->> 'logoRotation')::numeric, logo_rotation),
  logo_scale    = coalesce((area_config ->> 'logoScale')::numeric, logo_scale)
where area_config is not null
  and (area_config ? 'logoRotation' or area_config ? 'logoScale');
