-- =============================================================
-- Restaura public.bitrix_clients e public.personalization_simulations.
-- - bitrix_clients: lista de clientes (CRM) usada no filtro do Kanban de
--   cotações (src/pages/quotes/QuotesKanbanPage.tsx) e no embed do simulador.
-- - personalization_simulations: simulações salvas (src/hooks/simulation/useSimulation.ts),
--   que faz embed PostgREST `*, bitrix_clients (id, name, ramo)` — exige FK local.
-- Ambas inexistentes no banco (cliente sem tipos). Idempotente.
-- =============================================================

-- bitrix_clients (precisa existir antes pela FK)
create table if not exists public.bitrix_clients (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  ramo       text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.bitrix_clients enable row level security;
revoke all on table public.bitrix_clients from anon;
grant select, insert, update, delete on table public.bitrix_clients to authenticated;

-- Qualquer usuário autenticado pode ler a lista de clientes (filtro de cotações);
-- escrita restrita a admin+ (sync por service_role ignora RLS).
drop policy if exists "bitrix_clients_select_authenticated" on public.bitrix_clients;
create policy "bitrix_clients_select_authenticated" on public.bitrix_clients
  for select to authenticated using (true);

drop policy if exists "bitrix_clients_write_admin" on public.bitrix_clients;
create policy "bitrix_clients_write_admin" on public.bitrix_clients
  for all to authenticated
  using (public.is_admin_or_above(auth.uid()))
  with check (public.is_admin_or_above(auth.uid()));

comment on table public.bitrix_clients is
  'Cache local de clientes do CRM (Bitrix). Consumida por QuotesKanbanPage e useSimulation.';

-- personalization_simulations
create table if not exists public.personalization_simulations (
  id                 uuid primary key default gen_random_uuid(),
  seller_id          uuid not null references auth.users (id) on delete cascade,
  client_id          uuid references public.bitrix_clients (id) on delete set null,
  product_id         uuid references public.products (id) on delete set null,
  product_name       text,
  product_sku        text,
  quantity           integer,
  product_unit_price numeric,
  simulation_data    jsonb not null default '[]'::jsonb,
  notes              text,
  created_at         timestamptz not null default now()
);

create index if not exists idx_personalization_simulations_seller
  on public.personalization_simulations (seller_id);
create index if not exists idx_personalization_simulations_client
  on public.personalization_simulations (client_id);

alter table public.personalization_simulations enable row level security;
revoke all on table public.personalization_simulations from anon;
grant select, insert, update, delete on table public.personalization_simulations to authenticated;

drop policy if exists "persim_select_own_or_supervisor" on public.personalization_simulations;
create policy "persim_select_own_or_supervisor" on public.personalization_simulations
  for select to authenticated
  using (seller_id = auth.uid() or public.is_supervisor_or_above(auth.uid()));

drop policy if exists "persim_insert_own" on public.personalization_simulations;
create policy "persim_insert_own" on public.personalization_simulations
  for insert to authenticated
  with check (seller_id = auth.uid());

drop policy if exists "persim_update_own_or_admin" on public.personalization_simulations;
create policy "persim_update_own_or_admin" on public.personalization_simulations
  for update to authenticated
  using (seller_id = auth.uid() or public.is_admin_or_above(auth.uid()))
  with check (seller_id = auth.uid() or public.is_admin_or_above(auth.uid()));

drop policy if exists "persim_delete_own_or_admin" on public.personalization_simulations;
create policy "persim_delete_own_or_admin" on public.personalization_simulations
  for delete to authenticated
  using (seller_id = auth.uid() or public.is_admin_or_above(auth.uid()));

comment on table public.personalization_simulations is
  'Simulações de personalização salvas por vendedor. Consumida por src/hooks/simulation/useSimulation.ts.';
