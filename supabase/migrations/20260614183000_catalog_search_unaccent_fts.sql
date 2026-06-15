-- Catalogo: busca acento-insensivel (unaccent + FTS) - search_vector em products
-- Data: 2026-06-14 | Autoria: catalog-search-audit (Promo Gifts v4)
-- PROBLEMA: name ILIKE '%ecologico%' -> 3 produtos; com acento -> 41 (38 invisiveis).
-- SOLUCAO: search_vector sem acento + indice GIN. Aditivo + idempotente.
-- METODO: dry-run (BEGIN/ROLLBACK) recomendado; exige service role.

create extension if not exists unaccent;

create or replace function public.immutable_unaccent(txt text)
returns text language sql immutable parallel safe
set search_path = extensions, public, pg_catalog
as $$ select unaccent('unaccent'::regdictionary, coalesce(txt, '')) $$;

alter table public.products
  add column if not exists search_vector tsvector
  generated always as (
    setweight(to_tsvector('portuguese'::regconfig, public.immutable_unaccent(coalesce(name, ''))), 'A') ||
    setweight(to_tsvector('portuguese'::regconfig, public.immutable_unaccent(coalesce(sku, ''))), 'B') ||
    setweight(to_tsvector('portuguese'::regconfig, public.immutable_unaccent(coalesce(supplier_reference, ''))), 'B') ||
    setweight(to_tsvector('portuguese'::regconfig, public.immutable_unaccent(coalesce(short_description, ''))), 'C')
  ) stored;

create index if not exists idx_products_search_vector on public.products using gin (search_vector);

do $$
declare v_def text; v_from int; v_new text;
begin
  select pg_get_viewdef('public.v_products_public'::regclass, true) into v_def;
  if v_def is null then raise notice 'view inexistente';
  elsif position('search_vector' in v_def) > 0 then raise notice 'ja exposto';
  elsif v_def ~* '\*\s+from' or v_def ~ '\.\*' then raise notice 'SELECT * - flui automaticamente';
  else
    v_from := position(' FROM ' in upper(v_def));
    if v_from = 0 then raise exception 'FROM nao localizado'; end if;
    v_new := left(v_def, v_from - 1) || ', search_vector' || substr(v_def, v_from);
    execute 'create or replace view public.v_products_public as ' || v_new;
    raise notice 'view recriada com search_vector';
  end if;
end $$;

grant select on public.v_products_public to anon, authenticated;

-- VERIFICACAO pos-apply (esperado AMBOS ~41):
-- select count(*) from v_products_public where search_vector @@ websearch_to_tsquery('portuguese','ecologico') and active;
