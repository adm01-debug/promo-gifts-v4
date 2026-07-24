-- =============================================================
-- FASE 3 — Drop de 5 índices duplicados/redundantes
-- Critério: existe outro índice cobrindo a mesma coluna/predicate,
-- e o índice candidato tem menos scans (ou 0).
-- =============================================================

-- 1) idx_categories_slug_active (1 scan) — uq_categories_slug (UNIQUE) cobre
DROP INDEX IF EXISTS public.idx_categories_slug_active;

-- 2) idx_products_is_active (6 scans) — idx_products_active (parcial WHERE is_active=true) é melhor
DROP INDEX IF EXISTS public.idx_products_is_active;

-- 3) idx_pkg_compat_recommended (0 scans) — idx_pkg_compat_product (511 scans) cobre
DROP INDEX IF EXISTS public.idx_pkg_compat_recommended;

-- 4) idx_efi_errors (0 scans) — idx_efi_invoked_at já indexa invoked_at DESC
DROP INDEX IF EXISTS public.idx_efi_errors;

-- 5) idx_pfo_product_id (1 scan) — product_price_freshness_overrides_product_id_key (UNIQUE) cobre
DROP INDEX IF EXISTS public.idx_pfo_product_id;
