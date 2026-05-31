-- PASSO 41-43: Índices críticos para eliminar seq_scans (T03/T42)
-- Nota: sem CONCURRENTLY para compatibilidade com transações de migration (Supabase branching).
-- Em produção os índices são criados com IF NOT EXISTS, portanto sem downtime relevante.

-- user_roles: 101k seq_scans (96% do total) — queries RLS por user_id
DO $$
BEGIN
  IF (SELECT count(*) FROM information_schema.columns WHERE table_schema='public' AND table_name='user_roles' AND column_name IN ('user_id')) = 1 THEN
    CREATE INDEX IF NOT EXISTS idx_user_roles_user_id
  ON user_roles(user_id);
  END IF;
END $$;

-- integration_credentials: 101k seq_scans (100%) — lookup por name
DO $$
BEGIN
  IF (SELECT count(*) FROM information_schema.columns WHERE table_schema='public' AND table_name='integration_credentials' AND column_name IN ('name')) = 1 THEN
    CREATE INDEX IF NOT EXISTS idx_integration_creds_name
  ON integration_credentials(name);
  END IF;
END $$;

-- quotes: 65k seq_scans (100%) — RLS + listagem por usuário/organização/status
DO $$
BEGIN
  IF (SELECT count(*) FROM information_schema.columns WHERE table_schema='public' AND table_name='quotes' AND column_name IN ('user_id','organization_id','status')) = 3 THEN
    CREATE INDEX IF NOT EXISTS idx_quotes_user_org_status
  ON quotes(user_id, organization_id, status);
  END IF;
END $$;

-- quote_items: 14k seq_scans (99%) — sempre acessa por quote_id
DO $$
BEGIN
  IF (SELECT count(*) FROM information_schema.columns WHERE table_schema='public' AND table_name='quote_items' AND column_name IN ('quote_id')) = 1 THEN
    CREATE INDEX IF NOT EXISTS idx_quote_items_quote_id
  ON quote_items(quote_id);
  END IF;
END $$;

-- color_variations: 7k seq_scans (100%) — acessa por product_id
DO $$
BEGIN
  IF (SELECT count(*) FROM information_schema.columns WHERE table_schema='public' AND table_name='color_variations' AND column_name IN ('product_id')) = 1 THEN
    CREATE INDEX IF NOT EXISTS idx_color_variations_product_id
  ON color_variations(product_id);
  END IF;
END $$;

-- product_images: high n_distinct sem índice
DO $$
BEGIN
  IF (SELECT count(*) FROM information_schema.columns WHERE table_schema='public' AND table_name='product_images' AND column_name IN ('product_id')) = 1 THEN
    CREATE INDEX IF NOT EXISTS idx_product_images_product_id
  ON product_images(product_id);
  END IF;
END $$;

-- image_import_log: 2339 distinct products sem índice
DO $$
BEGIN
  IF (SELECT count(*) FROM information_schema.columns WHERE table_schema='public' AND table_name='image_import_log' AND column_name IN ('product_id')) = 1 THEN
    CREATE INDEX IF NOT EXISTS idx_image_import_log_product_id
  ON image_import_log(product_id);
  END IF;
END $$;
