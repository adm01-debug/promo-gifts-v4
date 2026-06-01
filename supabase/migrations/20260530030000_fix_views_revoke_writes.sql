-- HOTFIX: VIEWs com security_invoker=false permitem writes via PostgREST!
-- Revogar INSERT/UPDATE/DELETE em todas as VIEWs publicas.
-- Descoberto durante teste exaustivo em 2026-05-30.

REVOKE INSERT, UPDATE, DELETE ON v_products_public FROM anon, authenticated, public;
REVOKE INSERT, UPDATE, DELETE ON v_suppliers_public FROM anon, authenticated, public;
REVOKE INSERT, UPDATE, DELETE ON v_print_area_techniques_public FROM anon, authenticated, public;
