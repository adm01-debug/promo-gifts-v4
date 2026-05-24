-- =============================================================
-- Restaura tabelas de gestão de segurança de acesso consumidas por
-- src/hooks/auth/useAccessSecurity.ts e src/hooks/admin/useAllowedIPs.ts:
--   ip_whitelist, city_whitelist, access_blocked_log, user_allowed_ips.
-- (access_security_settings já existe — apenas garantimos 1 linha default
--  para o .single() do hook não falhar.)
-- Idempotente. RLS: ip/city/log = admin+; user_allowed_ips = dono ou admin+.
-- =============================================================

-- ip_whitelist (whitelist global de IPs)
create table if not exists public.ip_whitelist (
  id         uuid primary key default gen_random_uuid(),
  ip_address text not null unique,
  label      text,
  is_active  boolean not null default true,
  created_at timestamptz not null default now()
);
alter table public.ip_whitelist enable row level security;
revoke all on table public.ip_whitelist from anon;
grant select, insert, update, delete on table public.ip_whitelist to authenticated;
drop policy if exists "ip_whitelist_admin_all" on public.ip_whitelist;
create policy "ip_whitelist_admin_all" on public.ip_whitelist
  for all to authenticated
  using (public.is_admin_or_above(auth.uid()))
  with check (public.is_admin_or_above(auth.uid()));

-- city_whitelist (whitelist de cidades)
create table if not exists public.city_whitelist (
  id           uuid primary key default gen_random_uuid(),
  city_name    text not null,
  state        text,
  country_code text not null default 'BR',
  is_active    boolean not null default true,
  created_at   timestamptz not null default now(),
  constraint city_whitelist_unique unique (city_name, state, country_code)
);
alter table public.city_whitelist enable row level security;
revoke all on table public.city_whitelist from anon;
grant select, insert, update, delete on table public.city_whitelist to authenticated;
drop policy if exists "city_whitelist_admin_all" on public.city_whitelist;
create policy "city_whitelist_admin_all" on public.city_whitelist
  for all to authenticated
  using (public.is_admin_or_above(auth.uid()))
  with check (public.is_admin_or_above(auth.uid()));

-- access_blocked_log (log de bloqueios; escrito pelo backend/service_role)
create table if not exists public.access_blocked_log (
  id           uuid primary key default gen_random_uuid(),
  email        text,
  ip_address   text not null,
  city         text,
  state        text,
  country      text,
  block_reason text not null,
  user_agent   text,
  created_at   timestamptz not null default now()
);
create index if not exists idx_access_blocked_log_created_at
  on public.access_blocked_log (created_at desc);
alter table public.access_blocked_log enable row level security;
revoke all on table public.access_blocked_log from anon;
grant select, insert on table public.access_blocked_log to authenticated;
drop policy if exists "access_blocked_log_admin_read" on public.access_blocked_log;
create policy "access_blocked_log_admin_read" on public.access_blocked_log
  for select to authenticated
  using (public.is_admin_or_above(auth.uid()));
drop policy if exists "access_blocked_log_admin_insert" on public.access_blocked_log;
create policy "access_blocked_log_admin_insert" on public.access_blocked_log
  for insert to authenticated
  with check (public.is_admin_or_above(auth.uid()));

-- user_allowed_ips (IPs permitidos por usuário)
create table if not exists public.user_allowed_ips (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users (id) on delete cascade,
  ip_address text not null,
  label      text,
  is_active  boolean not null default true,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  constraint user_allowed_ips_user_ip_unique unique (user_id, ip_address)
);
create index if not exists idx_user_allowed_ips_user_id
  on public.user_allowed_ips (user_id);
alter table public.user_allowed_ips enable row level security;
revoke all on table public.user_allowed_ips from anon;
grant select, insert, update, delete on table public.user_allowed_ips to authenticated;
drop policy if exists "user_allowed_ips_select_own_or_admin" on public.user_allowed_ips;
create policy "user_allowed_ips_select_own_or_admin" on public.user_allowed_ips
  for select to authenticated
  using (user_id = auth.uid() or public.is_admin_or_above(auth.uid()));
drop policy if exists "user_allowed_ips_insert_own_or_admin" on public.user_allowed_ips;
create policy "user_allowed_ips_insert_own_or_admin" on public.user_allowed_ips
  for insert to authenticated
  with check (user_id = auth.uid() or public.is_admin_or_above(auth.uid()));
drop policy if exists "user_allowed_ips_update_own_or_admin" on public.user_allowed_ips;
create policy "user_allowed_ips_update_own_or_admin" on public.user_allowed_ips
  for update to authenticated
  using (user_id = auth.uid() or public.is_admin_or_above(auth.uid()))
  with check (user_id = auth.uid() or public.is_admin_or_above(auth.uid()));
drop policy if exists "user_allowed_ips_delete_own_or_admin" on public.user_allowed_ips;
create policy "user_allowed_ips_delete_own_or_admin" on public.user_allowed_ips
  for delete to authenticated
  using (user_id = auth.uid() or public.is_admin_or_above(auth.uid()));

-- Garante 1 linha default em access_security_settings (hook usa .single()).
insert into public.access_security_settings
  (ip_whitelist_enabled, city_whitelist_enabled, block_unknown_locations,
   max_failed_attempts, lockout_duration_minutes, strict_access_mode)
select false, false, false, 5, 30, false
where not exists (select 1 from public.access_security_settings);
