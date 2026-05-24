-- =============================================================
-- Restaura public.companies consumida por src/lib/pdf/whitelabel-comparison.ts
-- (busca branding do cliente: name, brand_logo_url, brand_color por id).
-- Inexistente no banco. Tabela vazia faz o PDF cair para o branding genérico
-- (o código já trata null), restaurando a exportação sem erro.
-- Idempotente. RLS: leitura autenticada; escrita admin+.
-- =============================================================

create table if not exists public.companies (
  id             uuid primary key default gen_random_uuid(),
  name           text,
  brand_logo_url text,
  brand_color    text,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

alter table public.companies enable row level security;
revoke all on table public.companies from anon;
grant select, insert, update, delete on table public.companies to authenticated;

drop policy if exists "companies_select_authenticated" on public.companies;
create policy "companies_select_authenticated" on public.companies
  for select to authenticated using (true);

drop policy if exists "companies_write_admin" on public.companies;
create policy "companies_write_admin" on public.companies
  for all to authenticated
  using (public.is_admin_or_above(auth.uid()))
  with check (public.is_admin_or_above(auth.uid()));

comment on table public.companies is
  'Branding white-label por cliente. Consumida por src/lib/pdf/whitelabel-comparison.ts.';
