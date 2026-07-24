-- ============================================================================
-- Issue #339 — Colunas de personalização ausentes (persistência silenciosa)
-- ============================================================================
-- Contexto
-- ----------------------------------------------------------------------------
-- A migration 20260524223000_restore_group_personalization_and_sales_goals.sql
-- recriou as tabelas de personalização com um schema mínimo, OMITINDO 6 colunas
-- que o front-end ainda referencia. Os call-sites foram anotados com
-- `@deprecated TODO(#339): coluna não existe` em vez de corrigidos, deixando
-- a UI com comportamento quebrado:
--
--   • upload de imagem de área (`area_image_url`) → write falha (PGRST204) ou
--     read sempre retorna undefined;
--   • toggle "definir como padrão" (`is_default`) → não persiste;
--   • campo de área máxima em component_locations (`max_area_cm2`) → não persiste;
--   • toggle "personalizável" em grupos (`is_personalizable`) → não persiste.
--
-- Arquivos afetados (referência):
--   src/components/admin/personalization/usePersonalizationData.ts
--   src/components/admin/personalization-manager/usePersonalizationManager.ts
--   src/components/admin/hooks/useGroupPersonalization.ts
--   src/components/products/ProductPersonalizationRules.tsx
--   src/lib/external-db/techniques.ts
--
-- Esta migration adiciona EXATAMENTE as colunas faltantes, todas aditivas,
-- nullable ou com default, e idempotentes (`add column if not exists`).
-- Não há backfill destrutivo e nenhuma policy/grant é alterada.
--
-- ⚠️ Deploy: revisar e aplicar pelo pipeline normal de migrations. Não foi
-- aplicada diretamente no banco de produção por esta sessão.
-- ----------------------------------------------------------------------------

-- 1) product_component_locations — imagem da área + área máxima
alter table public.product_component_locations
  add column if not exists area_image_url text,
  add column if not exists max_area_cm2 numeric;

-- 2) product_component_location_techniques — técnica padrão
alter table public.product_component_location_techniques
  add column if not exists is_default boolean not null default false;

-- 3) product_group_locations — imagem da área (grupo já tem max_area_cm2)
alter table public.product_group_locations
  add column if not exists area_image_url text;

-- 4) product_group_components — flag de personalizável
alter table public.product_group_components
  add column if not exists is_personalizable boolean not null default true;

-- 5) product_group_location_techniques — técnica padrão
alter table public.product_group_location_techniques
  add column if not exists is_default boolean not null default false;

-- ----------------------------------------------------------------------------
-- Validação esperada (auditoria futura)
-- ----------------------------------------------------------------------------
-- select table_name, column_name
--   from information_schema.columns
--  where table_schema='public'
--    and (table_name, column_name) in (
--      ('product_component_locations','area_image_url'),
--      ('product_component_locations','max_area_cm2'),
--      ('product_component_location_techniques','is_default'),
--      ('product_group_locations','area_image_url'),
--      ('product_group_components','is_personalizable'),
--      ('product_group_location_techniques','is_default')
--    );
-- Esperado: 6 linhas.
