-- REST Native Migration: VIEWs, RLS policies, GRANTs
-- Applied 2026-05-29/30 | Phases 2, 3, 4 + cleanup

-- Phase 2: suppliers VIEW + RLS
-- Guard: colunas como trading_name/is_product_supplier/etc podem não existir
-- em preview snapshots (adicionadas out-of-band em produção).
DO $$
DECLARE
  desired text[] := ARRAY['id','name','code','trading_name','logo_url','website','active','is_product_supplier','is_engraving_supplier','state_uf'];
  available text;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='suppliers') THEN
    RAISE NOTICE 'v_suppliers_public não criada: tabela suppliers ausente';
  ELSE
    -- Build column list from intersection of desired columns and what actually exists.
    -- Garante que TABLE_ALIASES suppliers→v_suppliers_public sempre encontre a view,
    -- mesmo em preview snapshots onde colunas opcionais (trading_name, etc) estão ausentes.
    SELECT string_agg(quote_ident(column_name), ',' ORDER BY array_position(desired, column_name))
      INTO available
    FROM information_schema.columns
    WHERE table_schema='public' AND table_name='suppliers'
      AND column_name = ANY(desired);
    IF available IS NULL OR available = '' THEN
      RAISE NOTICE 'v_suppliers_public não criada: nenhuma coluna desejada presente em suppliers';
    ELSE
      EXECUTE format('CREATE OR REPLACE VIEW public.v_suppliers_public AS SELECT %s FROM public.suppliers', available);
      EXECUTE 'ALTER VIEW public.v_suppliers_public SET (security_invoker = false)';
      EXECUTE 'GRANT SELECT ON public.v_suppliers_public TO anon, authenticated';
    END IF;
  END IF;
END $$;
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='color_variations')
     AND NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'color_variations' AND policyname = 'color_variations_public_read'
  ) THEN
    CREATE POLICY color_variations_public_read ON color_variations FOR SELECT TO anon,authenticated USING (true);
  END IF;
END $$;
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='product_materials')
     AND NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'product_materials' AND policyname = 'product_materials_public_read'
  ) THEN
    CREATE POLICY product_materials_public_read ON product_materials FOR SELECT TO anon,authenticated USING (true);
  END IF;
END $$;
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='product_kit_components')
     AND NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'product_kit_components' AND policyname = 'product_kit_components_public_read'
  ) THEN
    CREATE POLICY product_kit_components_public_read ON product_kit_components FOR SELECT TO anon,authenticated USING (true);
  END IF;
END $$;
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='material_types')
     AND NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'material_types' AND policyname = 'material_types_public_read'
  ) THEN
    CREATE POLICY material_types_public_read ON material_types FOR SELECT TO anon,authenticated USING (true);
  END IF;
END $$;

-- Phase 3: print areas VIEW + technique policies
-- Guard: colunas podem não existir em preview snapshots.
DO $$
DECLARE
  desired text[] := ARRAY['id','product_id','tabela_preco_id','location_code','location_name','max_width','max_height','is_curved','shape','technique_order','location_order','is_active','created_at','updated_at'];
  available text;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='print_area_techniques') THEN
    RAISE NOTICE 'v_print_area_techniques_public não criada: tabela print_area_techniques ausente';
  ELSE
    SELECT string_agg(quote_ident(column_name), ',' ORDER BY array_position(desired, column_name))
      INTO available
    FROM information_schema.columns
    WHERE table_schema='public' AND table_name='print_area_techniques'
      AND column_name = ANY(desired);
    IF available IS NULL OR available = '' THEN
      RAISE NOTICE 'v_print_area_techniques_public não criada: nenhuma coluna desejada presente';
    ELSE
      EXECUTE format('CREATE OR REPLACE VIEW public.v_print_area_techniques_public AS SELECT %s FROM public.print_area_techniques', available);
      EXECUTE 'ALTER VIEW public.v_print_area_techniques_public SET (security_invoker = false)';
      EXECUTE 'GRANT SELECT ON public.v_print_area_techniques_public TO anon, authenticated';
    END IF;
  END IF;
END $$;
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='tecnicas_gravacao')
     AND NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'tecnicas_gravacao' AND policyname = 'tecnicas_gravacao_public_read'
  ) THEN
    CREATE POLICY tecnicas_gravacao_public_read ON tecnicas_gravacao FOR SELECT TO anon,authenticated USING (true);
  END IF;
END $$;
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='tabela_preco_gravacao_oficial_faixa')
     AND NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'tabela_preco_gravacao_oficial_faixa' AND policyname = 'tabela_preco_gravacao_oficial_faixa_public_read'
  ) THEN
    CREATE POLICY tabela_preco_gravacao_oficial_faixa_public_read ON tabela_preco_gravacao_oficial_faixa FOR SELECT TO anon,authenticated USING (true);
  END IF;
END $$;
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='ramo_atividade')
     AND NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'ramo_atividade' AND policyname = 'ramo_atividade_public_read'
  ) THEN
    CREATE POLICY ramo_atividade_public_read ON ramo_atividade FOR SELECT TO anon,authenticated USING (true);
  END IF;
END $$;

-- Phase 4: cleanup superseded policies (DROP POLICY IF EXISTS é tolerante a tabelas ausentes? Não — falha 42P01)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='tecnicas_gravacao') THEN
    DROP POLICY IF EXISTS auth_read_tecnicas_gravacao ON tecnicas_gravacao;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='tabela_preco_gravacao_oficial_faixa') THEN
    DROP POLICY IF EXISTS tabela_preco_gravacao_oficial_faixa_authenticated_read ON tabela_preco_gravacao_oficial_faixa;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='ramo_atividade') THEN
    DROP POLICY IF EXISTS ra_select_authenticated ON ramo_atividade;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='material_types') THEN
    DROP POLICY IF EXISTS mt_select ON material_types;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='product_kit_components') THEN
    DROP POLICY IF EXISTS product_kit_components_select ON product_kit_components;
  END IF;
END $$;

-- Phase 4: v_products_public is in separate migration 20260530020000
