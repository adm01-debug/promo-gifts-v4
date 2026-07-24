-- ============================================================
-- MIGRAÇÃO 001 — Camada Silver (Medalha de Prata)
-- Arquitetura Medallion — PromoGifts
-- ============================================================
-- REGRAS FUNDAMENTAIS:
--   1. Toda dimensão em CM (nunca MM)
--   2. Um registro por (supplier_id, supplier_reference) — upsert
--   3. FK gold_product_id = NULL até fn_silver_to_gold()
--   4. norm_status: raw → normalized → validated → promoted | rejected
-- ============================================================
-- APLICADO EM PRODUÇÃO: 2025-06
-- ncm_code expandido para VARCHAR(15) após descobrir NCM SPOT com 11 chars
-- ============================================================

-- ENUM do pipeline Silver
DO $$ BEGIN
  CREATE TYPE silver_norm_status AS ENUM ('raw','normalizing','normalized','validated','rejected','promoted');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS silver_products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL DEFAULT '5db5aee1-064b-4ef4-9193-345dcd8274ea',
  supplier_id UUID NOT NULL REFERENCES suppliers(id),
  bronze_id UUID REFERENCES supplier_products_raw(id),
  import_batch_id UUID REFERENCES supplier_import_batches(id),
  supplier_reference TEXT NOT NULL,
  internal_reference TEXT,
  gold_product_id UUID REFERENCES products(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  short_description VARCHAR(500),
  description TEXT,
  brand VARCHAR(100),
  -- Dimensões produto (SEMPRE EM CM)
  length_cm NUMERIC(8,2), width_cm NUMERIC(8,2), height_cm NUMERIC(8,2),
  diameter_cm NUMERIC(8,2), weight_g NUMERIC(9,2), capacity_ml INTEGER,
  -- Caixa (SEMPRE EM CM)
  box_length_cm NUMERIC(8,2), box_width_cm NUMERIC(8,2), box_height_cm NUMERIC(8,2),
  box_weight_kg NUMERIC(8,3), box_quantity INTEGER, box_inner_quantity INTEGER,
  -- Fiscal
  ncm_code VARCHAR(15), -- VARCHAR(15) para acomodar NCM com ponto final (ex: "5603.13.40.")
  ipi_rate NUMERIC(5,2), origin_country VARCHAR(50),
  -- Produto
  min_order_quantity INTEGER DEFAULT 1, lead_time_days INTEGER,
  supply_mode VARCHAR(40) DEFAULT 'pronta_entrega_liso',
  is_textil BOOLEAN DEFAULT false, is_thermal BOOLEAN DEFAULT false,
  is_imported BOOLEAN DEFAULT true, gender VARCHAR(10),
  has_colors BOOLEAN DEFAULT false, has_sizes BOOLEAN DEFAULT false, has_capacity BOOLEAN DEFAULT false,
  packing_type VARCHAR(100), repacking_type VARCHAR(100),
  -- Mapeamentos
  norm_category_id UUID REFERENCES categories(id),
  norm_material_id UUID REFERENCES material_types(id),
  -- Metadados
  supplier_updated_at TIMESTAMPTZ, is_active BOOLEAN NOT NULL DEFAULT true, is_deleted BOOLEAN NOT NULL DEFAULT false,
  -- Pipeline
  norm_status silver_norm_status NOT NULL DEFAULT 'raw',
  norm_errors JSONB NOT NULL DEFAULT '[]', norm_warnings JSONB NOT NULL DEFAULT '[]',
  norm_confidence NUMERIC(4,3) DEFAULT 0, normalized_by TEXT DEFAULT 'system',
  normalized_at TIMESTAMPTZ, validated_at TIMESTAMPTZ, promoted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (supplier_id, supplier_reference)
);

CREATE INDEX IF NOT EXISTS idx_sp_supplier_id     ON silver_products(supplier_id);
CREATE INDEX IF NOT EXISTS idx_sp_bronze_id       ON silver_products(bronze_id);
CREATE INDEX IF NOT EXISTS idx_sp_gold_product_id ON silver_products(gold_product_id);
CREATE INDEX IF NOT EXISTS idx_sp_norm_status     ON silver_products(norm_status);
CREATE INDEX IF NOT EXISTS idx_sp_is_active       ON silver_products(is_active) WHERE is_active = true;

CREATE TABLE IF NOT EXISTS silver_variants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  silver_product_id UUID NOT NULL REFERENCES silver_products(id) ON DELETE CASCADE,
  supplier_id UUID NOT NULL REFERENCES suppliers(id),
  bronze_id UUID REFERENCES supplier_products_raw(id),
  supplier_sku VARCHAR(100) NOT NULL,
  gold_variant_id UUID REFERENCES product_variants(id) ON DELETE SET NULL,
  color_code VARCHAR(30), color_name TEXT, color_hex VARCHAR(7), color_hex_secondary VARCHAR(7),
  norm_color_id UUID REFERENCES color_variations(id),
  size_code VARCHAR(20), size_name TEXT, capacity_ml INTEGER,
  stock_quantity INTEGER DEFAULT 0, stock_sp_quantity INTEGER, next_restock_date DATE, is_stockout BOOLEAN DEFAULT false,
  -- Faixas de preço (até 10 níveis — padrão SPOT)
  min_qty_1 INTEGER, cost_price_1 NUMERIC(12,4),
  min_qty_2 INTEGER, cost_price_2 NUMERIC(12,4),
  min_qty_3 INTEGER, cost_price_3 NUMERIC(12,4),
  min_qty_4 INTEGER, cost_price_4 NUMERIC(12,4),
  min_qty_5 INTEGER, cost_price_5 NUMERIC(12,4),
  min_qty_6 INTEGER, cost_price_6 NUMERIC(12,4),
  min_qty_7 INTEGER, cost_price_7 NUMERIC(12,4),
  min_qty_8 INTEGER, cost_price_8 NUMERIC(12,4),
  min_qty_9 INTEGER, cost_price_9 NUMERIC(12,4),
  min_qty_10 INTEGER, cost_price_10 NUMERIC(12,4),
  primary_image_url TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  norm_status silver_norm_status NOT NULL DEFAULT 'raw',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (supplier_id, supplier_sku)
);

CREATE INDEX IF NOT EXISTS idx_sv_silver_product_id ON silver_variants(silver_product_id);
CREATE INDEX IF NOT EXISTS idx_sv_gold_variant_id   ON silver_variants(gold_variant_id);
CREATE INDEX IF NOT EXISTS idx_sv_norm_color_id     ON silver_variants(norm_color_id);
CREATE INDEX IF NOT EXISTS idx_sv_norm_status       ON silver_variants(norm_status);
CREATE INDEX IF NOT EXISTS idx_sv_is_active         ON silver_variants(is_active) WHERE is_active = true;

CREATE TABLE IF NOT EXISTS silver_print_areas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  silver_product_id UUID NOT NULL REFERENCES silver_products(id) ON DELETE CASCADE,
  supplier_id UUID NOT NULL REFERENCES suppliers(id),
  component_code TEXT NOT NULL DEFAULT 'PRODUTO',
  component_name TEXT, component_order INTEGER DEFAULT 1,
  location_code TEXT NOT NULL, location_name TEXT, location_order INTEGER DEFAULT 1,
  area_width_cm NUMERIC(8,2), area_height_cm NUMERIC(8,2), area_cm2 NUMERIC(10,2),
  is_curved BOOLEAN DEFAULT false, shape TEXT DEFAULT 'rectangle',
  norm_technique_code TEXT REFERENCES tecnicas_gravacao(codigo),
  gold_tabela_preco_id UUID REFERENCES tabela_preco_gravacao_oficial(id),
  supplier_technique_raw TEXT, supplier_location_raw TEXT, supplier_table_code_raw TEXT,
  max_colors INTEGER, is_default BOOLEAN DEFAULT false,
  is_active BOOLEAN NOT NULL DEFAULT true,
  norm_status silver_norm_status NOT NULL DEFAULT 'raw',
  mapping_confidence NUMERIC(4,3) DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
-- Índices únicos para ON CONFLICT:
CREATE UNIQUE INDEX IF NOT EXISTS idx_spa_uq_product_comp_loc_tech
  ON silver_print_areas(silver_product_id, component_code, location_code, norm_technique_code)
  WHERE norm_technique_code IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_spa_uq_product_comp_loc_raw
  ON silver_print_areas(silver_product_id, component_code, location_code, supplier_technique_raw)
  WHERE norm_technique_code IS NULL;

CREATE INDEX IF NOT EXISTS idx_spa_silver_product_id    ON silver_print_areas(silver_product_id);
CREATE INDEX IF NOT EXISTS idx_spa_norm_technique_code  ON silver_print_areas(norm_technique_code);
CREATE INDEX IF NOT EXISTS idx_spa_mapping_confidence   ON silver_print_areas(mapping_confidence);

CREATE TABLE IF NOT EXISTS silver_images_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  silver_product_id UUID NOT NULL REFERENCES silver_products(id) ON DELETE CASCADE,
  silver_variant_id UUID REFERENCES silver_variants(id) ON DELETE CASCADE,
  supplier_id UUID NOT NULL REFERENCES suppliers(id),
  source_url TEXT NOT NULL,
  gold_image_id UUID REFERENCES product_images(id) ON DELETE SET NULL,
  cloudflare_image_id VARCHAR(100), url_cdn TEXT,
  image_type TEXT NOT NULL DEFAULT 'gallery',
  component_ref TEXT, display_order INTEGER DEFAULT 0, is_primary BOOLEAN DEFAULT false,
  width_px INTEGER, height_px INTEGER, file_size_bytes BIGINT, format VARCHAR(10),
  img_status TEXT NOT NULL DEFAULT 'pending', img_error TEXT, attempts INTEGER NOT NULL DEFAULT 0,
  last_attempt_at TIMESTAMPTZ, is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_siq_silver_product_id ON silver_images_queue(silver_product_id);
CREATE INDEX IF NOT EXISTS idx_siq_img_status        ON silver_images_queue(img_status);
CREATE INDEX IF NOT EXISTS idx_siq_pending           ON silver_images_queue(img_status) WHERE img_status = 'pending';
CREATE INDEX IF NOT EXISTS idx_siq_source_url        ON silver_images_queue(source_url);

-- Trigger updated_at
CREATE OR REPLACE FUNCTION fn_silver_set_updated_at() RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;
DO $$ DECLARE tbl TEXT;
BEGIN
  FOREACH tbl IN ARRAY ARRAY['silver_products','silver_variants','silver_print_areas','silver_images_queue'] LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS trg_silver_updated_at ON %I; CREATE TRIGGER trg_silver_updated_at BEFORE UPDATE ON %I FOR EACH ROW EXECUTE FUNCTION fn_silver_set_updated_at();', tbl, tbl);
  END LOOP;
END $$;
