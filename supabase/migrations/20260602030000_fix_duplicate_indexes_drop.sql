-- ============================================================
-- MIGRAÇÃO: 20260602030000_fix_duplicate_indexes_drop.sql
-- AUTOR:    Claude (audit fix/claude-supabase-audit-collapse-20260602)
-- DATA:     2026-06-02
-- MOTIVO:   COLAPSO #2 (parte) — 13 pares de índices duplicados.
--           Cada INSERT/UPDATE/DELETE atualiza AMBOS os índices duplicados
--           sem nenhum benefício de leitura.
--           401 índices nunca usados penalizam escritas sem ganho.
-- ============================================================

-- ──────────────────────────────────────────────
-- GRUPO 1: products — índices duplicados em name
-- Manter: idx_products_active_name_sort (mais específico, filtra is_active)
-- Dropar:  idx_products_name_trgm (apenas name, nunca usado)
-- Dropar:  idx_products_is_active_not_deleted_name (redundante com active_name_sort)
-- ──────────────────────────────────────────────
DROP INDEX CONCURRENTLY IF EXISTS public.idx_products_name_trgm;
DROP INDEX CONCURRENTLY IF EXISTS public.idx_products_is_active_not_deleted_name;

-- ──────────────────────────────────────────────
-- GRUPO 2: products — índices duplicados em slug
-- Manter: idx_products_slug_unique (UNIQUE, mais funcional)
-- Dropar:  idx_products_slug (duplicado sem UNIQUE)
-- ──────────────────────────────────────────────
DROP INDEX CONCURRENTLY IF EXISTS public.idx_products_slug;

-- ──────────────────────────────────────────────
-- GRUPO 3: product_images — cloudflare_image_id duplicado
-- Manter:  product_images_cloudflare_image_id_key (UNIQUE constraint key)
-- Dropar:  idx_unique_cloudflare_image_id (índice duplicando a constraint)
-- ──────────────────────────────────────────────
DROP INDEX CONCURRENTLY IF EXISTS public.idx_unique_cloudflare_image_id;

-- ──────────────────────────────────────────────
-- GRUPO 4: product_images — set+type duplicado
-- Manter:  product_images_display_idx (mais completo)
-- Dropar:  idx_product_images_set_type (subset redundante)
-- ──────────────────────────────────────────────
DROP INDEX CONCURRENTLY IF EXISTS public.idx_product_images_set_type;

-- ──────────────────────────────────────────────
-- GRUPO 5: personalization_simulations — seller_id duplicado
-- Manter:  idx_personalization_simulations_seller_id
-- Dropar:  idx_personalization_simulations_seller
-- ──────────────────────────────────────────────
DROP INDEX CONCURRENTLY IF EXISTS public.idx_personalization_simulations_seller;

-- ──────────────────────────────────────────────
-- GRUPO 6: sales_goals — user_id duplicado
-- Manter:  idx_sales_goals_user_id
-- Dropar:  idx_sales_goals_user
-- ──────────────────────────────────────────────
DROP INDEX CONCURRENTLY IF EXISTS public.idx_sales_goals_user;

-- ──────────────────────────────────────────────
-- GRUPO 7: integration_credentials — secret_name duplicado
-- Manter:  integration_credentials_secret_name_key (UNIQUE constraint)
-- Dropar:  idx_integration_creds_secret_name (índice normal duplicando constraint)
-- ──────────────────────────────────────────────
DROP INDEX CONCURRENTLY IF EXISTS public.idx_integration_creds_secret_name;

-- ──────────────────────────────────────────────
-- GRUPO 8: user_2fa_settings — user_id duplicado
-- Manter:  user_2fa_settings_user_id_key (UNIQUE constraint)
-- Dropar:  idx_user_2fa_settings_user_id (índice normal duplicando constraint)
-- ──────────────────────────────────────────────
DROP INDEX CONCURRENTLY IF EXISTS public.idx_user_2fa_settings_user_id;

-- ──────────────────────────────────────────────
-- GRUPO 9: product_kit_components — kit+component duplicado
-- Manter:  product_kit_components_kit_product_id_component_product_id_key (UNIQUE constraint)
-- Dropar:  idx_kit_component_unique (índice duplicando constraint)
-- ──────────────────────────────────────────────
DROP INDEX CONCURRENTLY IF EXISTS public.idx_kit_component_unique;

-- ──────────────────────────────────────────────
-- ÍNDICES NUNCA USADOS — TOP OFFENDERS (por tamanho)
-- Apenas os maiores e mais claramente sem uso
-- ──────────────────────────────────────────────

-- 16 MB sem 1 scan sequer
DROP INDEX CONCURRENTLY IF EXISTS public.idx_supplier_products_raw_data;

-- Índices de product_images nunca usados
DROP INDEX CONCURRENTLY IF EXISTS public.idx_product_images_type_id;
DROP INDEX CONCURRENTLY IF EXISTS public.idx_product_images_org;

-- Índice de product_materials nunca usado
DROP INDEX CONCURRENTLY IF EXISTS public.idx_product_materials_composite;
DROP INDEX CONCURRENTLY IF EXISTS public.idx_product_materials_active;
DROP INDEX CONCURRENTLY IF EXISTS public.idx_product_materials_org;

-- Índices de media_assets nunca usados
DROP INDEX CONCURRENTLY IF EXISTS public.idx_media_primary;
DROP INDEX CONCURRENTLY IF EXISTS public.idx_media_product;
DROP INDEX CONCURRENTLY IF EXISTS public.idx_media_supplier;
DROP INDEX CONCURRENTLY IF EXISTS public.idx_media_type;

-- NOTA: Os 401 índices nunca usados podem ser removidos gradualmente.
-- Esta migração foca nos duplicados e nos maiores offenders por tamanho.
-- Consulte a view pg_stat_user_indexes regularmente para identificar mais.
