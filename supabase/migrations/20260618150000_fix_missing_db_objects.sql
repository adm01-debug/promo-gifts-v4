-- ============================================================
-- Migration: fix_missing_db_objects
-- Data: 2026-06-18
-- Bugs corrigidos:
--   BUG-STATS-01 · v_catalog_stats 404 → view nunca criada
--   BUG-DAR-401  · discount_approval_requests 401 anon → sem GRANT SELECT
-- ============================================================

-- ----
-- FIX 1: CREATE VIEW v_catalog_stats
-- ----
-- useCatalogRealStats.ts referencia esta view mas ela nunca foi deployada ao
-- banco (planejada em 2026-06-17, auditoria catálogo). Causa: 404 repetido com
-- retry 3× no startup → badges "variantes/fornecedores" travavam em 0.
--
-- Retorna 1 linha com: total_variants (bigint), total_suppliers (bigint).
-- Filtra: is_deleted IS NOT TRUE, is_active = TRUE, pv.is_active IS NOT FALSE.
-- SECURITY INVOKER: executa no contexto do caller; anon e authenticated têm
-- acesso efetivo às tabelas base (products, product_variants).
CREATE OR REPLACE VIEW public.v_catalog_stats
WITH (security_invoker = on)
AS
SELECT
  COUNT(pv.id)::bigint                   AS total_variants,
  COUNT(DISTINCT p.supplier_id)::bigint  AS total_suppliers
FROM public.product_variants pv
JOIN public.products p ON p.id = pv.product_id
WHERE (p.is_deleted IS NOT TRUE)
  AND (p.is_active = TRUE)
  AND (pv.is_active IS NOT FALSE);

COMMENT ON VIEW public.v_catalog_stats IS
  'Contagem de variantes e fornecedores VISÍVEIS no catálogo público. '
  'Exclui produtos is_active=false, is_deleted=true e variantes is_active=false. '
  'Usada por useCatalogRealStats (src/hooks/products/useCatalogRealStats.ts). '
  'FIX BUG-STATS-01: 2026-06-18 — view ausente causava 404 no startup.';

GRANT SELECT ON public.v_catalog_stats TO anon, authenticated;

-- ----
-- FIX 2: GRANT SELECT anon em discount_approval_requests
-- ----
-- DiscountApprovalHeaderBadge + SidebarReorganized fazem HEAD em
-- discount_approval_requests logo após montar. Se o JWT ainda não foi
-- anexado ao supabase-js (race condition auth), o request vai como anon.
-- Sem GRANT SELECT para anon → HTTP 401 "permission denied" → console
-- "Falha ao carregar Buscar", badge trava em 0 por até 60s.
--
-- Fix DB: conceder SELECT anon (RLS com políticas apenas para authenticated
-- → anon sempre recebe [] por DENY-by-default implícito → sem regressão).
-- Fix código: rolesLoaded guard em DiscountApprovalHeaderBadge.tsx e
-- SidebarReorganized.tsx (PR fix/missing-db-objects-20260618).
GRANT SELECT ON public.discount_approval_requests TO anon;

-- Recarregar cache do PostgREST
NOTIFY pgrst, 'reload schema';
