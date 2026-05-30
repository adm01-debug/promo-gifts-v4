-- ============================================================
-- REST Native Migration: VIEWs, RLS policies, GRANTs
-- Applied via Claude MCP on 2026-05-29/30
-- ============================================================

-- Phase 2a: VIEW segura para suppliers (oculta dados sensiveis)
CREATE OR REPLACE VIEW v_suppliers_public AS
SELECT
  id, name, code, trading_name, logo_url, website,
  active, is_product_supplier, is_engraving_supplier, state_uf
FROM suppliers;

COMMENT ON VIEW v_suppliers_public IS
  'View publica de suppliers - oculta api_credentials, markup%, cnpj, notes.';

ALTER VIEW v_suppliers_public SET (security_invoker = false);
GRANT SELECT ON v_suppliers_public TO anon;
GRANT SELECT ON v_suppliers_public TO authenticated;

-- Phase 2c: RLS policies para tabelas faltantes
CREATE POLICY IF NOT EXISTS color_variations_public_read ON color_variations
  FOR SELECT TO anon, authenticated USING (true);

CREATE POLICY IF NOT EXISTS product_materials_public_read ON product_materials
  FOR SELECT TO anon, authenticated USING (true);

-- Bugs found during testing:
CREATE POLICY IF NOT EXISTS product_kit_components_public_read ON product_kit_components
  FOR SELECT TO anon, authenticated USING (true);

CREATE POLICY IF NOT EXISTS material_types_public_read ON material_types
  FOR SELECT TO anon, authenticated USING (true);

-- Phase 3: Print areas, tecnicas, ramos
CREATE OR REPLACE VIEW v_print_area_techniques_public AS
SELECT
  id, product_id, tabela_preco_id, location_code, location_name,
  max_width, max_height, is_curved, shape,
  technique_order, location_order, is_active,
  created_at, updated_at
FROM print_area_techniques;

COMMENT ON VIEW v_print_area_techniques_public IS
  'View publica de print_area_techniques - oculta unit_cost e notes.';

ALTER VIEW v_print_area_techniques_public SET (security_invoker = false);
GRANT SELECT ON v_print_area_techniques_public TO anon;
GRANT SELECT ON v_print_area_techniques_public TO authenticated;

CREATE POLICY IF NOT EXISTS tecnicas_gravacao_public_read ON tecnicas_gravacao
  FOR SELECT TO anon, authenticated USING (true);

CREATE POLICY IF NOT EXISTS tabela_preco_gravacao_oficial_faixa_public_read
  ON tabela_preco_gravacao_oficial_faixa
  FOR SELECT TO anon, authenticated USING (true);

CREATE POLICY IF NOT EXISTS ramo_atividade_public_read ON ramo_atividade
  FOR SELECT TO anon, authenticated USING (true);

-- Phase 4: Cleanup policies supersedidas pelas novas _public_read
DROP POLICY IF EXISTS auth_read_tecnicas_gravacao ON tecnicas_gravacao;
DROP POLICY IF EXISTS tabela_preco_gravacao_oficial_faixa_authenticated_read ON tabela_preco_gravacao_oficial_faixa;
DROP POLICY IF EXISTS ra_select_authenticated ON ramo_atividade;
DROP POLICY IF EXISTS mt_select ON material_types;
DROP POLICY IF EXISTS product_kit_components_select ON product_kit_components;
