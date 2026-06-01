-- REST Native Migration: VIEWs, RLS policies, GRANTs
-- Applied 2026-05-29/30 | Phases 2, 3, 4 + cleanup

-- Phase 2: suppliers VIEW + RLS
-- Guard: colunas como trading_name/is_product_supplier/etc podem não existir
-- em preview snapshots (adicionadas out-of-band em produção).
DO $$
BEGIN
  IF (
    SELECT count(*) FROM information_schema.columns
    WHERE table_schema='public' AND table_name='suppliers'
      AND column_name IN ('id','name','code','trading_name','logo_url','website','active','is_product_supplier','is_engraving_supplier','state_uf')
  ) = 10 THEN
    EXECUTE 'CREATE OR REPLACE VIEW v_suppliers_public AS SELECT id,name,code,trading_name,logo_url,website,active,is_product_supplier,is_engraving_supplier,state_uf FROM suppliers';
    EXECUTE 'ALTER VIEW v_suppliers_public SET (security_invoker = false)';
    EXECUTE 'GRANT SELECT ON v_suppliers_public TO anon, authenticated';
  ELSE
    RAISE NOTICE 'v_suppliers_public não criada: colunas ausentes em suppliers';
  END IF;
END $$;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'color_variations' AND policyname = 'color_variations_public_read'
  ) THEN
    CREATE POLICY color_variations_public_read ON color_variations FOR SELECT TO anon,authenticated USING (true);
  END IF;
END $$;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'product_materials' AND policyname = 'product_materials_public_read'
  ) THEN
    CREATE POLICY product_materials_public_read ON product_materials FOR SELECT TO anon,authenticated USING (true);
  END IF;
END $$;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'product_kit_components' AND policyname = 'product_kit_components_public_read'
  ) THEN
    CREATE POLICY product_kit_components_public_read ON product_kit_components FOR SELECT TO anon,authenticated USING (true);
  END IF;
END $$;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'material_types' AND policyname = 'material_types_public_read'
  ) THEN
    CREATE POLICY material_types_public_read ON material_types FOR SELECT TO anon,authenticated USING (true);
  END IF;
END $$;

-- Phase 3: print areas VIEW + technique policies
-- Guard: colunas podem não existir em preview snapshots.
DO $$
BEGIN
  IF (
    SELECT count(*) FROM information_schema.columns
    WHERE table_schema='public' AND table_name='print_area_techniques'
      AND column_name IN ('id','product_id','tabela_preco_id','location_code','location_name','max_width','max_height','is_curved','shape','technique_order','location_order','is_active','created_at','updated_at')
  ) = 14 THEN
    EXECUTE 'CREATE OR REPLACE VIEW v_print_area_techniques_public AS SELECT id,product_id,tabela_preco_id,location_code,location_name,max_width,max_height,is_curved,shape,technique_order,location_order,is_active,created_at,updated_at FROM print_area_techniques';
    EXECUTE 'ALTER VIEW v_print_area_techniques_public SET (security_invoker = false)';
    EXECUTE 'GRANT SELECT ON v_print_area_techniques_public TO anon, authenticated';
  ELSE
    RAISE NOTICE 'v_print_area_techniques_public não criada: colunas ausentes em print_area_techniques';
  END IF;
END $$;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'tecnicas_gravacao' AND policyname = 'tecnicas_gravacao_public_read'
  ) THEN
    CREATE POLICY tecnicas_gravacao_public_read ON tecnicas_gravacao FOR SELECT TO anon,authenticated USING (true);
  END IF;
END $$;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'tabela_preco_gravacao_oficial_faixa' AND policyname = 'tabela_preco_gravacao_oficial_faixa_public_read'
  ) THEN
    CREATE POLICY tabela_preco_gravacao_oficial_faixa_public_read ON tabela_preco_gravacao_oficial_faixa FOR SELECT TO anon,authenticated USING (true);
  END IF;
END $$;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'ramo_atividade' AND policyname = 'ramo_atividade_public_read'
  ) THEN
    CREATE POLICY ramo_atividade_public_read ON ramo_atividade FOR SELECT TO anon,authenticated USING (true);
  END IF;
END $$;

-- Phase 4: cleanup superseded policies
DROP POLICY IF EXISTS auth_read_tecnicas_gravacao ON tecnicas_gravacao;
DROP POLICY IF EXISTS tabela_preco_gravacao_oficial_faixa_authenticated_read ON tabela_preco_gravacao_oficial_faixa;
DROP POLICY IF EXISTS ra_select_authenticated ON ramo_atividade;
DROP POLICY IF EXISTS mt_select ON material_types;
DROP POLICY IF EXISTS product_kit_components_select ON product_kit_components;

-- Phase 4: v_products_public is in separate migration 20260530020000
