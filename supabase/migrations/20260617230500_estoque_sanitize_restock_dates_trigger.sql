-- Auditoria Estoque (follow-up revisão P1): garante os slots 4-6 mesmo em DB recriado do zero
-- (idempotente; em produção as colunas já existem). Necessário antes da view/trigger que os usa.
ALTER TABLE public.variant_supplier_sources ADD COLUMN IF NOT EXISTS next_quantity_4 integer;
ALTER TABLE public.variant_supplier_sources ADD COLUMN IF NOT EXISTS next_date_4 date;
ALTER TABLE public.variant_supplier_sources ADD COLUMN IF NOT EXISTS next_quantity_5 integer;
ALTER TABLE public.variant_supplier_sources ADD COLUMN IF NOT EXISTS next_date_5 date;
ALTER TABLE public.variant_supplier_sources ADD COLUMN IF NOT EXISTS next_quantity_6 integer;
ALTER TABLE public.variant_supplier_sources ADD COLUMN IF NOT EXISTS next_date_6 date;

ALTER TABLE public.product_variants ADD COLUMN IF NOT EXISTS next_quantity_4 integer;
ALTER TABLE public.product_variants ADD COLUMN IF NOT EXISTS next_date_4 date;
ALTER TABLE public.product_variants ADD COLUMN IF NOT EXISTS next_quantity_5 integer;
ALTER TABLE public.product_variants ADD COLUMN IF NOT EXISTS next_date_5 date;
ALTER TABLE public.product_variants ADD COLUMN IF NOT EXISTS next_quantity_6 integer;
ALTER TABLE public.product_variants ADD COLUMN IF NOT EXISTS next_date_6 date;

-- Auditoria do módulo Estoque (2026-06-17) — fix de CAUSA-RAIZ p/ "Estoque Futuro" fantasma.
--
-- Sintoma: o cron diário fn_purge_expired_restock_dates(false) (06:00 UTC) roda e
-- SUCEDE, mas 336 entradas com next_date vencida reapareceram ~16h depois. Causa:
-- os syncs de fornecedor (XBZ/SPOT/Asia) reinjetam datas já passadas do feed ao
-- longo do dia. O purge diário é band-aid; a correção é uma trigger BEFORE leve e
-- PURA que sanitiza TODA escrita, em qualquer caminho de ingestão (centralizada).
create or replace function public.trg_fn_sanitize_restock_dates()
returns trigger
language plpgsql
set search_path to 'public'
as $$
begin
  -- (1) Anula janelas com data já vencida (< hoje). Mantém datas de hoje/futuro.
  if NEW.next_date_1 is not null and NEW.next_date_1 < current_date then NEW.next_date_1 := null; NEW.next_quantity_1 := null; end if;
  if NEW.next_date_2 is not null and NEW.next_date_2 < current_date then NEW.next_date_2 := null; NEW.next_quantity_2 := null; end if;
  if NEW.next_date_3 is not null and NEW.next_date_3 < current_date then NEW.next_date_3 := null; NEW.next_quantity_3 := null; end if;
  if NEW.next_date_4 is not null and NEW.next_date_4 < current_date then NEW.next_date_4 := null; NEW.next_quantity_4 := null; end if;
  if NEW.next_date_5 is not null and NEW.next_date_5 < current_date then NEW.next_date_5 := null; NEW.next_quantity_5 := null; end if;
  if NEW.next_date_6 is not null and NEW.next_date_6 < current_date then NEW.next_date_6 := null; NEW.next_quantity_6 := null; end if;
  -- (2) Pares incoerentes: quantidade futura sem data não é reposição rastreável.
  if NEW.next_date_1 is null and NEW.next_quantity_1 is not null then NEW.next_quantity_1 := null; end if;
  if NEW.next_date_2 is null and NEW.next_quantity_2 is not null then NEW.next_quantity_2 := null; end if;
  if NEW.next_date_3 is null and NEW.next_quantity_3 is not null then NEW.next_quantity_3 := null; end if;
  if NEW.next_date_4 is null and NEW.next_quantity_4 is not null then NEW.next_quantity_4 := null; end if;
  if NEW.next_date_5 is null and NEW.next_quantity_5 is not null then NEW.next_quantity_5 := null; end if;
  if NEW.next_date_6 is null and NEW.next_quantity_6 is not null then NEW.next_quantity_6 := null; end if;
  return NEW;
end;
$$;

comment on function public.trg_fn_sanitize_restock_dates() is
  'BEFORE INS/UPD em product_variants e variant_supplier_sources: anula janelas de reposição com data vencida (<hoje) e quantidades órfãs (sem data). Impede reinjeção de "estoque futuro" fantasma via feeds de fornecedor entre rodadas do cron de purge. Auditoria Estoque 2026-06-17.';

drop trigger if exists trg_zz_sanitize_restock_dates on public.variant_supplier_sources;
create trigger trg_zz_sanitize_restock_dates
  before insert or update on public.variant_supplier_sources
  for each row execute function public.trg_fn_sanitize_restock_dates();

drop trigger if exists trg_zz_sanitize_restock_dates on public.product_variants;
create trigger trg_zz_sanitize_restock_dates
  before insert or update on public.product_variants
  for each row execute function public.trg_fn_sanitize_restock_dates();
