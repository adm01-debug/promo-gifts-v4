-- HOTFIX: VIEWs com security_invoker=false permitem writes via PostgREST!
-- Revogar INSERT/UPDATE/DELETE em todas as VIEWs publicas.
-- Descoberto durante teste exaustivo em 2026-05-30.
-- Guards: views podem não existir em preview snapshots (criadas condicionalmente
-- em 20260530001500 via guards de coluna).

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.views WHERE table_schema='public' AND table_name='v_products_public') THEN
    REVOKE INSERT, UPDATE, DELETE ON public.v_products_public FROM anon, authenticated, public;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.views WHERE table_schema='public' AND table_name='v_suppliers_public') THEN
    REVOKE INSERT, UPDATE, DELETE ON public.v_suppliers_public FROM anon, authenticated, public;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.views WHERE table_schema='public' AND table_name='v_print_area_techniques_public') THEN
    REVOKE INSERT, UPDATE, DELETE ON public.v_print_area_techniques_public FROM anon, authenticated, public;
  END IF;
END $$;
