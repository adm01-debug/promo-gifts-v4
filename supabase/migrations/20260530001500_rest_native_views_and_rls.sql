-- REST Native Migration: VIEWs, RLS policies, GRANTs
-- Applied 2026-05-29/30 | Phases 2, 3, 4 + cleanup

-- Phase 2: suppliers VIEW + RLS
CREATE OR REPLACE VIEW v_suppliers_public AS
SELECT id,name,code,trading_name,logo_url,website,active,is_product_supplier,is_engraving_supplier,state_uf FROM suppliers;
ALTER VIEW v_suppliers_public SET (security_invoker = false);
GRANT SELECT ON v_suppliers_public TO anon, authenticated;
CREATE POLICY IF NOT EXISTS color_variations_public_read ON color_variations FOR SELECT TO anon,authenticated USING (true);
CREATE POLICY IF NOT EXISTS product_materials_public_read ON product_materials FOR SELECT TO anon,authenticated USING (true);
CREATE POLICY IF NOT EXISTS product_kit_components_public_read ON product_kit_components FOR SELECT TO anon,authenticated USING (true);
CREATE POLICY IF NOT EXISTS material_types_public_read ON material_types FOR SELECT TO anon,authenticated USING (true);

-- Phase 3: print areas VIEW + technique policies
CREATE OR REPLACE VIEW v_print_area_techniques_public AS
SELECT id,product_id,tabela_preco_id,location_code,location_name,max_width,max_height,is_curved,shape,technique_order,location_order,is_active,created_at,updated_at FROM print_area_techniques;
ALTER VIEW v_print_area_techniques_public SET (security_invoker = false);
GRANT SELECT ON v_print_area_techniques_public TO anon, authenticated;
CREATE POLICY IF NOT EXISTS tecnicas_gravacao_public_read ON tecnicas_gravacao FOR SELECT TO anon,authenticated USING (true);
CREATE POLICY IF NOT EXISTS tabela_preco_gravacao_oficial_faixa_public_read ON tabela_preco_gravacao_oficial_faixa FOR SELECT TO anon,authenticated USING (true);
CREATE POLICY IF NOT EXISTS ramo_atividade_public_read ON ramo_atividade FOR SELECT TO anon,authenticated USING (true);

-- Phase 4: cleanup superseded policies
DROP POLICY IF EXISTS auth_read_tecnicas_gravacao ON tecnicas_gravacao;
DROP POLICY IF EXISTS tabela_preco_gravacao_oficial_faixa_authenticated_read ON tabela_preco_gravacao_oficial_faixa;
DROP POLICY IF EXISTS ra_select_authenticated ON ramo_atividade;
DROP POLICY IF EXISTS mt_select ON material_types;
DROP POLICY IF EXISTS product_kit_components_select ON product_kit_components;

-- Phase 4: v_products_public is in separate migration 20260530020000
