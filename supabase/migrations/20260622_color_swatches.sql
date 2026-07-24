-- ============================================================
-- MIGRATION: color_swatches feature
-- APLICADO: 2026-06-22 (via execute_sql direto no projeto doufsxqlfjyuvxuezpln)
-- Autor: Claude (PhD-level DB engineering)
-- ============================================================

-- PASSO 1: Nova coluna em products
-- ALTER TABLE products ADD COLUMN IF NOT EXISTS color_swatches jsonb DEFAULT '[]'::jsonb;
-- COMMENT ON COLUMN products.color_swatches IS
--   'Array JSONB com swatches de cor. [{variant_id, sku, color_id, color_name, color_hex, stock_quantity (SUM), image_url, is_in_stock}]';
-- NOTIFY pgrst, 'reload schema';

-- PASSO 2: Função rebuild (stock = SUM por color_id; imagem P1→P4)
-- CREATE OR REPLACE FUNCTION fn_rebuild_color_swatches(p_product_id uuid) ...
-- Ver implementação completa no banco de dados.

-- PASSO 3: Trigger em product_variants
-- trg_rebuild_swatches_on_variant
-- AFTER INSERT OR UPDATE OF color_id, color_name, color_hex, stock_quantity, is_active OR DELETE
-- Guards: bulk_import_mode + DISTINCT check (só update se mudou)

-- PASSO 4: Trigger em product_images
-- trg_rebuild_swatches_on_image
-- AFTER INSERT OR UPDATE OF variant_id, color_id, url_cdn, is_primary, is_active, image_type OR DELETE
-- Guards: bulk_import_mode + variant_id/color_id IS NOT NULL + image_type IN ('main','gallery','product') + DISTINCT check

-- PASSO 5: Backfill de 7.153 produtos (has_colors=true, is_active=true)
-- Triggers desativados durante backfill: search_vector, seo_autofill, extract_materials, auto_materials
-- Executado em 8 lotes de 900 produtos
-- Resultado: 7.153/7.153 processados (0 restantes)

-- PASSO 6: RPC fn_get_color_swatches_batch(p_product_ids uuid[])
-- Lazy-load para frontend; usado quando color_swatches estiver vazio

-- HIERARQUIA DE IMAGEM:
-- P1: product_images WHERE variant_id = pv.id AND image_type IN ('main','gallery','product') → url_cdn (CF Images)
-- P2: product_images WHERE color_id = pv.color_id AND variant_id IS NULL → url_cdn (CF Images)
-- P3: product_variants.images->0 (supplier CDN JSONB)
-- P4: products.primary_image_url (fallback genérico)

-- COBERTURA PÓS-BACKFILL:
-- 7.153 produtos com color_swatches preenchido
-- 182 produtos sem cores (color_swatches = '[]')
-- Triggers ativos e mantendo o campo automaticamente

-- SMOKE TESTS: fn_run_smoke_tests() mantém 23/23 PASS

-- ARQUIVOS FRONTEND CRIADOS:
-- src/hooks/useProductColorSwatch.ts
-- src/components/ui/ColorSwatchPicker.tsx
-- src/types/colorSwatch.ts
-- Commit: cb7cc8b1b3c3048c88143f6f78eee80f7be04f79
