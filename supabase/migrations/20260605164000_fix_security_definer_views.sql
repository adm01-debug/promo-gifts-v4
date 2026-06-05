
-- ════════════════════════════════════════════════════════════════
-- Security fix: security_definer_view (2 ERROR advisors)
--
-- v_products_public and somarcas_catalogo_publico were created
-- with SECURITY DEFINER semantics, meaning they execute as the
-- view owner and bypass the calling user's RLS policies.
-- Fix: switch to SECURITY INVOKER so RLS is enforced normally.
-- ════════════════════════════════════════════════════════════════

ALTER VIEW public.v_products_public SET (security_invoker = on);
ALTER VIEW public.somarcas_catalogo_publico SET (security_invoker = on);
