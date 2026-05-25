-- PASSO 44: Reabilitar trigger de auditoria de preço desabilitado (T05)
-- trg_log_price_change estava DESABILITADO — mudanças de preço não auditadas
ALTER TABLE product_variants ENABLE TRIGGER trg_log_price_change;

-- PASSO 46: Adicionar RLS à tabela _asia_api_staging (T36)
-- Tinha DELETE, INSERT, SELECT, UPDATE liberados para anon sem RLS
ALTER TABLE _asia_api_staging ENABLE ROW LEVEL SECURITY;

-- Apenas service_role acessa — tabela de staging interna
CREATE POLICY "_asia_staging_service_only" ON _asia_api_staging
  AS RESTRICTIVE
  FOR ALL
  TO authenticated
  USING (false);
