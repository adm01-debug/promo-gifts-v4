-- PASSO 41-43: Índices críticos para eliminar seq_scans (T03/T42)
-- Nota: sem CONCURRENTLY para compatibilidade com transações de migration (Supabase branching).
-- Em produção os índices são criados com IF NOT EXISTS, portanto sem downtime relevante.

-- user_roles: 101k seq_scans (96% do total) — queries RLS por user_id
CREATE INDEX IF NOT EXISTS idx_user_roles_user_id
  ON user_roles(user_id);

-- integration_credentials: 101k seq_scans (100%) — lookup por name
CREATE INDEX IF NOT EXISTS idx_integration_creds_name
  ON integration_credentials(name);

-- quotes: 65k seq_scans (100%) — RLS + listagem por usuário/organização/status
CREATE INDEX IF NOT EXISTS idx_quotes_user_org_status
  ON quotes(user_id, organization_id, status);

-- quote_items: 14k seq_scans (99%) — sempre acessa por quote_id
CREATE INDEX IF NOT EXISTS idx_quote_items_quote_id
  ON quote_items(quote_id);

-- color_variations: 7k seq_scans (100%) — acessa por product_id
CREATE INDEX IF NOT EXISTS idx_color_variations_product_id
  ON color_variations(product_id);

-- product_images: high n_distinct sem índice
CREATE INDEX IF NOT EXISTS idx_product_images_product_id
  ON product_images(product_id);

-- image_import_log: 2339 distinct products sem índice
CREATE INDEX IF NOT EXISTS idx_image_import_log_product_id
  ON image_import_log(product_id);
