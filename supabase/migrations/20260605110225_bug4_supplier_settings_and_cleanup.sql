-- =============================================================================
-- BUG #4 FIX: Configure parent_key_source for 88 Brindes, Asia Import, Só Marcas
-- CLEANUP: Remove test/junk rows (correct deletion order)
-- BUG #2 FIX: Register repo migration versions in schema_migrations
-- =============================================================================

-- ---------------------------------------------------------------------------
-- BUG #4: supplier_settings — parent_key_source configuration
-- ---------------------------------------------------------------------------
-- 88 Brindes: ref_produto = parent grouping key, sku_fornecedor = variant key
INSERT INTO supplier_settings (
  supplier_id,
  parent_key_source,
  variant_name_template,
  sku_prefix
)
VALUES (
  'c3345743-aedf-4b31-a761-978b0d4aa79e',  -- 88 Brindes
  'ref_produto',
  '{product_name} | {color_name}',
  NULL
)
ON CONFLICT (supplier_id) DO UPDATE SET
  parent_key_source     = EXCLUDED.parent_key_source,
  variant_name_template = EXCLUDED.variant_name_template,
  updated_at            = now();

-- Asia Import: referencia = unique per row (1:1 product:variant)
UPDATE supplier_settings SET
  parent_key_source     = 'referencia',
  variant_name_template = '{product_name} | {color_name}',
  updated_at            = now()
WHERE supplier_id = 'd2734e23-d633-4819-bb15-e51aa44e2118';  -- Asia Import

-- Só Marcas: codigo = unique per product (single-variant products)
INSERT INTO supplier_settings (
  supplier_id,
  parent_key_source,
  variant_name_template,
  sku_prefix
)
VALUES (
  '841cd690-210a-422a-908c-7676828db272',  -- Só Marcas
  'codigo',
  '{product_name}',
  NULL
)
ON CONFLICT (supplier_id) DO UPDATE SET
  parent_key_source     = EXCLUDED.parent_key_source,
  variant_name_template = EXCLUDED.variant_name_template,
  updated_at            = now();

-- ---------------------------------------------------------------------------
-- CLEANUP: Remove test data — correct FK deletion order
-- 1. produtos_padronizacao (refs product_id + raw_id)
-- 2. product_variants
-- 3. products
-- 4. supplier_products_raw
-- ---------------------------------------------------------------------------
DELETE FROM produtos_padronizacao
WHERE id IN (
  '65b46917-289e-4706-866f-75d91dd28461',  -- TIGELA DE TESTE
  'cb1c2ce0-89a1-4e6c-af26-cdcaa3898be4',  -- PRODUTO PARA TESTE DE VARIACAO 02
  'ee9bdae0-232c-4804-b984-51dceda108a0'   -- PRODUTO TESTE
);

DELETE FROM product_variants
WHERE product_id IN (
  'a92bd9ac-fa78-49c0-bdd5-cfd6517a4111',  -- PRODUTO PARA TESTE DE VARIACAO 02
  '742f2ee6-ae78-47f6-add1-dce6b973bb76'   -- TIGELA DE TESTE
);

DELETE FROM products
WHERE id IN (
  'a92bd9ac-fa78-49c0-bdd5-cfd6517a4111',  -- PRODUTO PARA TESTE DE VARIACAO 02
  '742f2ee6-ae78-47f6-add1-dce6b973bb76'   -- TIGELA DE TESTE
);

DELETE FROM supplier_products_raw
WHERE id IN (
  '00af777d-203c-428f-a4db-dfd33dad5c80',  -- TESTE1-AMA/AMA
  '1cbc9b30-df30-4300-8798-91c9524b5e6c',  -- TESTE1-AZU
  'c5efb5c7-6aa0-4438-86ab-65aea2d50ea3',  -- TESTE02-AMA
  '293434b5-8e96-47d5-8121-0c20d42a7791'   -- TESTE-PRE/PRE
);

-- ---------------------------------------------------------------------------
-- BUG #2 FIX: Register repo migration versions in schema_migrations so
-- `supabase db push` does not try to re-apply them. The live DB already
-- has equivalent migrations under versions 20260604214100 and 20260604214243.
-- ---------------------------------------------------------------------------
INSERT INTO supabase_migrations.schema_migrations (version, name)
VALUES
  ('20260604220000', 'fix_spot_name_cleaning'),
  ('20260604221000', 'fix_raw_v2_race_and_batch_spam')
ON CONFLICT (version) DO NOTHING;
