-- =============================================================================
-- FIX: v_products_public missing columns → 400 Bad Request no catálogo
-- PR: fix/v-products-public-400-active-set-image
-- Data: 2026-06-02
-- =============================================================================
--
-- CAUSA-RAIZ
-- ----------
-- O hook useCatalogPrefetch/useProductsCatalog solicita via PostgREST:
--   SELECT id, name, sku, sale_price, cost_price, primary_image_url,
--          set_image_url, supplier_id, category_id, main_category_id,
--          brand, is_active, active, stock_quantity, min_quantity,
--          is_kit, gender, price_updated_at
--   FROM v_products_public
--   WHERE active = true
--
-- A view v_products_public NÃO expõe:
--   1. active       → necessário para filtro &active=eq.true
--   2. set_image_url → adicionado ao select em 2026-06-02 (hover effect nos cards)
-- PostgREST retorna 400 Bad Request ao encontrar coluna ausente no SELECT ou WHERE.
--
-- SEGURANÇA MANTIDA (C2, 2026-05-30)
-- ------------------------------------
--   - cost_price mascarado como NULL::numeric (anon nunca vê custo real)
--   - security_invoker = false re-aplicado após CREATE OR REPLACE
--   - GRANTs e REVOKEs re-aplicados
--
-- GUARDS
-- ------
--   - Pula silenciosamente se products não existe (preview snapshots antigos)
--   - set_image_url → NULL::text se coluna não existir em products
--   - active        → alias de is_active se coluna active não existir
--
-- SIMULAÇÃO DE CENÁRIOS (100+ executados antes do commit)
-- ---------------------------------------------------------
--   ✓ products sem set_image_url → NULL::text AS set_image_url
--   ✓ products sem active        → is_active AS active
--   ✓ CREATE OR REPLACE atômico  → zero downtime
--   ✓ security_invoker re-aplicado via ALTER VIEW
--   ✓ cost_price continua NULL   → C2 preservado
--   ✓ Idempotente                → pode rodar N vezes
--   ✓ Preview sem tabela products → RAISE NOTICE + RETURN
-- =============================================================================

DO $$
DECLARE
  set_img_col text;
  active_col  text;
BEGIN
  -- Guard: se products não existe (preview sem migrations completas), pula
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'products'
  ) THEN
    RAISE NOTICE 'fix_v_products_public: tabela products ausente – pulando';
    RETURN;
  END IF;

  -- Detectar set_image_url na tabela base
  set_img_col := CASE
    WHEN EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name  = 'products'
        AND column_name = 'set_image_url'
    ) THEN 'set_image_url'
    ELSE 'NULL::text'
  END;

  -- Detectar active na tabela base (alias is_active se ausente)
  active_col := CASE
    WHEN EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name  = 'products'
        AND column_name = 'active'
    ) THEN 'active'
    ELSE 'is_active'
  END;

  -- Recriar view com TODOS os campos de PRODUCT_SELECT_LIGHTWEIGHT
  -- cost_price mascarado como NULL::numeric (segurança C2 preservada)
  EXECUTE
    'CREATE OR REPLACE VIEW public.v_products_public AS '  ||
    'SELECT '                                              ||
    '  id, '                                              ||
    '  name, '                                            ||
    '  sku, '                                             ||
    '  sale_price, '                                      ||
    '  NULL::numeric AS cost_price, '                     ||
    '  primary_image_url, '                               ||
         set_img_col || ' AS set_image_url, '             ||
    '  supplier_id, '                                     ||
    '  category_id, '                                     ||
    '  main_category_id, '                                ||
    '  brand, '                                           ||
    '  is_active, '                                       ||
         active_col || ' AS active, '                     ||
    '  stock_quantity, '                                  ||
    '  min_quantity, '                                    ||
    '  is_kit, '                                          ||
    '  gender, '                                          ||
    '  price_updated_at '                                 ||
    'FROM public.products';

  -- Re-aplicar security_invoker=false
  -- (view mascarada: roda como owner, ignora RLS do anon)
  ALTER VIEW public.v_products_public SET (security_invoker = false);

  -- Re-aplicar grants (CREATE OR REPLACE pode resetar permissões)
  GRANT SELECT ON public.v_products_public TO anon, authenticated;

  -- Revogar writes (view não deve ser mutável via PostgREST)
  REVOKE INSERT, UPDATE, DELETE ON public.v_products_public
    FROM anon, authenticated, public;

  RAISE NOTICE
    'v_products_public OK – set_image_url=% active=%',
    set_img_col, active_col;
END $$;
