-- PASSO 44: Reabilitar trigger de auditoria de preço desabilitado (T05)
-- trg_log_price_change estava DESABILITADO — mudanças de preço não auditadas
-- Guard: trigger pode não existir em preview branches (criado fora de migration em produção)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_trigger t
    JOIN pg_class c ON c.oid = t.tgrelid
    WHERE t.tgname = 'trg_log_price_change'
      AND c.relname = 'product_variants'
  ) THEN
    ALTER TABLE product_variants ENABLE TRIGGER trg_log_price_change;
  ELSE
    RAISE NOTICE 'trg_log_price_change não encontrado em product_variants — ignorado (criado fora de migration em produção)';
  END IF;
END $$;

-- PASSO 46: Adicionar RLS à tabela _asia_api_staging (T36)
-- Tinha DELETE, INSERT, SELECT, UPDATE liberados para anon sem RLS
-- Guard: tabela pode não existir em preview branches (criada fora de migration
-- em produção, ou dropped após o snapshot ser feito).
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = '_asia_api_staging'
  ) THEN
    ALTER TABLE _asia_api_staging ENABLE ROW LEVEL SECURITY;

    -- Apenas service_role acessa — tabela de staging interna
    IF NOT EXISTS (
      SELECT 1 FROM pg_policies
      WHERE tablename = '_asia_api_staging'
        AND policyname = '_asia_staging_service_only'
    ) THEN
      CREATE POLICY "_asia_staging_service_only" ON _asia_api_staging
        AS RESTRICTIVE
        FOR ALL
        TO authenticated
        USING (false);
    END IF;
  ELSE
    RAISE NOTICE '_asia_api_staging não existe — RLS/policy pulados (tabela criada fora de migration em produção)';
  END IF;
END $$;
