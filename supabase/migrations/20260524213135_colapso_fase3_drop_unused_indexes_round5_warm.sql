-- =============================================================
-- FASE 3 (Round 5) — Drop dos 12 índices warm remanescentes.
-- Total a recuperar: ~1.1 MB.
-- =============================================================

DROP INDEX IF EXISTS public.idx_product_relationships_related_product_id;
DROP INDEX IF EXISTS public.idx_product_variants_size_id;
DROP INDEX IF EXISTS public.idx_categories_display_order;
DROP INDEX IF EXISTS public.idx_categories_org_parent_active;
DROP INDEX IF EXISTS public.idx_product_kit_components_component_product_id;
DROP INDEX IF EXISTS public.idx_categories_active;
DROP INDEX IF EXISTS public.idx_rate_limits_window_start;
DROP INDEX IF EXISTS public.idx_product_kit_components_secondary_material;
DROP INDEX IF EXISTS public.idx_categories_deleted;
DROP INDEX IF EXISTS public.idx_rate_limits_blocked_until;
DROP INDEX IF EXISTS public.frontend_telemetry_user_id_idx;
DROP INDEX IF EXISTS public.idx_categories_sync_status;
