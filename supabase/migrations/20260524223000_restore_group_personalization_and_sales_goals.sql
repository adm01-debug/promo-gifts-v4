-- =============================================================
-- Restores five tables consumed by frontend untypedFrom() calls.
--
-- Source of the contract inference:
--   sales_goals                           -> useSalesGoals
--   product_group_components              -> useGroupPersonalization.addComponent
--   product_group_locations               -> useGroupPersonalization.addLocation
--   product_group_location_techniques     -> useGroupPersonalization.addTechnique
--   product_component_location_techniques -> admin personalization managers
--
-- Keep this migration replay-safe. Some of these tables were created by older
-- migrations with a narrower shape, so each table section also backfills
-- columns required by the current frontend contract and updated_at triggers.
-- =============================================================

-- ============ 1) sales_goals ============
create table if not exists public.sales_goals (
  id                  uuid primary key default gen_random_uuid(),
  user_id             uuid not null references auth.users(id) on delete cascade,
  goal_type           text not null check (goal_type in ('monthly', 'weekly', 'quarterly')),
  target_value        numeric not null default 0,
  current_value       numeric not null default 0,
  target_quotes       integer not null default 0,
  current_quotes      integer not null default 0,
  target_conversions  integer not null default 0,
  current_conversions integer not null default 0,
  start_date          date not null,
  end_date            date not null,
  is_achieved         boolean not null default false,
  achieved_at         timestamptz,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

create index if not exists idx_sales_goals_user on public.sales_goals (user_id);
create index if not exists idx_sales_goals_period on public.sales_goals (user_id, goal_type, start_date, end_date);

alter table public.sales_goals enable row level security;
revoke all on table public.sales_goals from anon;
grant select, insert, update, delete on table public.sales_goals to authenticated;

drop policy if exists "sales_goals_owner_all" on public.sales_goals;
create policy "sales_goals_owner_all" on public.sales_goals
  for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists "sales_goals_admin_read" on public.sales_goals;
create policy "sales_goals_admin_read" on public.sales_goals
  for select to authenticated
  using (public.is_admin_or_above(auth.uid()));

drop trigger if exists trg_sales_goals_updated_at on public.sales_goals;
create trigger trg_sales_goals_updated_at
  before update on public.sales_goals
  for each row execute function public.update_updated_at_column();

comment on table public.sales_goals is
  'Sales goals by seller and period. Consumed by useSalesGoals.';

-- ============ 2) product_group_components ============
create table if not exists public.product_group_components (
  id               uuid primary key default gen_random_uuid(),
  product_group_id uuid not null references public.product_groups(id) on delete cascade,
  component_code   text not null,
  component_name   text not null,
  description      text,
  is_active        boolean not null default true,
  sort_order       integer not null default 0,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  unique (product_group_id, component_code)
);

alter table public.product_group_components
  add column if not exists description text,
  add column if not exists updated_at timestamptz not null default now();

create index if not exists idx_pgcomp_group on public.product_group_components (product_group_id, sort_order);

alter table public.product_group_components enable row level security;
revoke all on table public.product_group_components from anon;
grant select, insert, update, delete on table public.product_group_components to authenticated;

drop policy if exists "pgcomp_select_authenticated" on public.product_group_components;
create policy "pgcomp_select_authenticated" on public.product_group_components
  for select to authenticated using (true);

drop policy if exists "pgcomp_write_admin" on public.product_group_components;
create policy "pgcomp_write_admin" on public.product_group_components
  for all to authenticated
  using (public.is_admin_or_above(auth.uid()))
  with check (public.is_admin_or_above(auth.uid()));

drop trigger if exists trg_pgcomp_updated_at on public.product_group_components;
create trigger trg_pgcomp_updated_at
  before update on public.product_group_components
  for each row execute function public.update_updated_at_column();

comment on table public.product_group_components is
  'Product-group component templates inherited by products in the group.';

-- ============ 3) product_group_locations ============
create table if not exists public.product_group_locations (
  id                  uuid primary key default gen_random_uuid(),
  group_component_id  uuid not null references public.product_group_components(id) on delete cascade,
  location_code       text not null,
  location_name       text not null,
  description         text,
  max_width_cm        numeric,
  max_height_cm       numeric,
  max_area_cm2        numeric,
  is_active           boolean not null default true,
  sort_order          integer not null default 0,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  unique (group_component_id, location_code)
);

alter table public.product_group_locations
  add column if not exists description text,
  add column if not exists sort_order integer not null default 0,
  add column if not exists updated_at timestamptz not null default now();

create index if not exists idx_pgloc_component on public.product_group_locations (group_component_id);

alter table public.product_group_locations enable row level security;
revoke all on table public.product_group_locations from anon;
grant select, insert, update, delete on table public.product_group_locations to authenticated;

drop policy if exists "pgloc_select_authenticated" on public.product_group_locations;
create policy "pgloc_select_authenticated" on public.product_group_locations
  for select to authenticated using (true);

drop policy if exists "pgloc_write_admin" on public.product_group_locations;
create policy "pgloc_write_admin" on public.product_group_locations
  for all to authenticated
  using (public.is_admin_or_above(auth.uid()))
  with check (public.is_admin_or_above(auth.uid()));

drop trigger if exists trg_pgloc_updated_at on public.product_group_locations;
create trigger trg_pgloc_updated_at
  before update on public.product_group_locations
  for each row execute function public.update_updated_at_column();

comment on table public.product_group_locations is
  'Product-group personalization locations inherited by group products.';

-- ============ 4) product_group_location_techniques ============
create table if not exists public.product_group_location_techniques (
  id                uuid primary key default gen_random_uuid(),
  group_location_id uuid not null references public.product_group_locations(id) on delete cascade,
  technique_id      uuid not null references public.personalization_techniques(id) on delete restrict,
  max_colors        integer,
  is_active         boolean not null default true,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  unique (group_location_id, technique_id)
);

alter table public.product_group_location_techniques
  add column if not exists updated_at timestamptz not null default now();

create index if not exists idx_pgloctech_location on public.product_group_location_techniques (group_location_id);
create index if not exists idx_pgloctech_technique on public.product_group_location_techniques (technique_id);

alter table public.product_group_location_techniques enable row level security;
revoke all on table public.product_group_location_techniques from anon;
grant select, insert, update, delete on table public.product_group_location_techniques to authenticated;

drop policy if exists "pgloctech_select_authenticated" on public.product_group_location_techniques;
create policy "pgloctech_select_authenticated" on public.product_group_location_techniques
  for select to authenticated using (true);

drop policy if exists "pgloctech_write_admin" on public.product_group_location_techniques;
create policy "pgloctech_write_admin" on public.product_group_location_techniques
  for all to authenticated
  using (public.is_admin_or_above(auth.uid()))
  with check (public.is_admin_or_above(auth.uid()));

drop trigger if exists trg_pgloctech_updated_at on public.product_group_location_techniques;
create trigger trg_pgloctech_updated_at
  before update on public.product_group_location_techniques
  for each row execute function public.update_updated_at_column();

comment on table public.product_group_location_techniques is
  'Personalization techniques available for each product-group location.';

-- ============ 5) product_component_location_techniques ============
create table if not exists public.product_component_location_techniques (
  id                    uuid primary key default gen_random_uuid(),
  component_location_id uuid not null references public.product_component_locations(id) on delete cascade,
  technique_id          uuid not null references public.personalization_techniques(id) on delete restrict,
  composed_code         text,
  max_colors            integer,
  is_active             boolean not null default true,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),
  unique (component_location_id, technique_id)
);

alter table public.product_component_location_techniques
  add column if not exists updated_at timestamptz not null default now();

create index if not exists idx_pcloctech_location on public.product_component_location_techniques (component_location_id);
create index if not exists idx_pcloctech_technique on public.product_component_location_techniques (technique_id);

alter table public.product_component_location_techniques enable row level security;
revoke all on table public.product_component_location_techniques from anon;
grant select, insert, update, delete on table public.product_component_location_techniques to authenticated;

drop policy if exists "pcloctech_select_authenticated" on public.product_component_location_techniques;
create policy "pcloctech_select_authenticated" on public.product_component_location_techniques
  for select to authenticated using (true);

drop policy if exists "pcloctech_write_admin" on public.product_component_location_techniques;
create policy "pcloctech_write_admin" on public.product_component_location_techniques
  for all to authenticated
  using (public.is_admin_or_above(auth.uid()))
  with check (public.is_admin_or_above(auth.uid()));

drop trigger if exists trg_pcloctech_updated_at on public.product_component_location_techniques;
create trigger trg_pcloctech_updated_at
  before update on public.product_component_location_techniques
  for each row execute function public.update_updated_at_column();

comment on table public.product_component_location_techniques is
  'Personalization techniques available for each product-component location.';
