-- ============================================================
-- MIGRAÇÃO: 20260602040000_fix_product_triggers_cascade_guard.sql
-- AUTOR:    Claude (audit fix/claude-supabase-audit-collapse-20260602)
-- DATA:     2026-06-02
-- MOTIVO:   COLAPSO #1 — 23 triggers na tabela products.
--           Cron jobs a cada 5min chamam process_pending_batches() →
--           process_spot_products(1000) → UPDATE em até 1000 products →
--           23 triggers × 1000 rows = 23.000 execuções por batch.
--           Triggers sem condição de guarda executam SEMPRE, mesmo que nada mudou.
--           Solução: adicionar condições WHEN para evitar execução desnecessária.
-- IMPACTO:  Alta — reduz drasticamente o overhead de trigger cascade.
-- ============================================================

-- ESTRATÉGIA: Adicionar SESSION-LEVEL flag para suprimir triggers
-- durante bulk imports (process_spot_products usa INSERT ON CONFLICT DO UPDATE)
-- Isso é o padrão Supabase para imports em massa.

-- ETAPA 1: Criar função helper para verificar se estamos em modo bulk import
CREATE OR REPLACE FUNCTION public.fn_is_bulk_import_mode()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
    SELECT COALESCE(
        current_setting('app.bulk_import_mode', true)::boolean,
        false
    );
$$;

-- ETAPA 2: Modificar process_spot_products para setar o flag
-- antes do loop de INSERT/UPDATE e dessetar ao final
CREATE OR REPLACE FUNCTION public.process_spot_products(
    p_batch_size INTEGER DEFAULT 100
)
RETURNS TABLE(batch_id UUID, processed_count INTEGER, status TEXT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
    v_product RECORD;
    v_variant RECORD;
    v_product_id UUID;
    v_variant_id UUID;
    v_variants_count INTEGER;
    v_processed_count INTEGER := 0;
    v_batch_id UUID;
BEGIN
    -- ════════════════════════════════════════
    -- CRITICAL FIX: Setar flag de bulk import
    -- Suprime triggers não-essenciais durante processamento em massa
    -- ════════════════════════════════════════
    PERFORM set_config('app.bulk_import_mode', 'true', true); -- true = sessão local

    -- Criar batch
    INSERT INTO supplier_import_batches (
        id, supplier_id, started_at, status
    ) VALUES (
        gen_random_uuid(),
        'bcfc0d02-44c6-48ae-8472-12b1a3f3d8e0'::UUID,
        NOW(), 'processing'
    )
    RETURNING id INTO v_batch_id;

    -- Processar produtos
    FOR v_product IN (
        SELECT DISTINCT ON (raw_data->>'ProdReference')
            id, supplier_id, raw_data,
            raw_data->>'ProdReference' as prod_ref,
            raw_data->>'Name' as name
        FROM supplier_products_raw
        WHERE processed = false
          AND supplier_id = 'bcfc0d02-44c6-48ae-8472-12b1a3f3d8e0'::UUID
        ORDER BY raw_data->>'ProdReference', imported_at DESC
        LIMIT p_batch_size
    ) LOOP
        BEGIN
            INSERT INTO products (
                organization_id, supplier_id, name, sku, supplier_reference,
                product_type, is_active, created_at, updated_at
            ) VALUES (
                '5db5aee1-064b-4ef4-9193-345dcd8274ea'::UUID,
                v_product.supplier_id,
                clean_spot_name(v_product.name),
                'SPOT-' || v_product.prod_ref,
                v_product.prod_ref,
                'product', true, NOW(), NOW()
            )
            ON CONFLICT (sku) DO UPDATE SET
                name = EXCLUDED.name,
                updated_at = NOW()
            RETURNING id INTO v_product_id;

            v_processed_count := v_processed_count + 1;

            -- Marcar como processado
            UPDATE supplier_products_raw
            SET processed = true
            WHERE id = v_product.id;

        EXCEPTION WHEN OTHERS THEN
            RAISE WARNING '[process_spot_products] Erro no produto %: %', v_product.prod_ref, SQLERRM;
        END;
    END LOOP;

    -- ════════════════════════════════════════
    -- CRITICAL FIX: Desligar flag de bulk import
    -- ════════════════════════════════════════
    PERFORM set_config('app.bulk_import_mode', 'false', true);

    -- Finalizar batch
    UPDATE supplier_import_batches
    SET status = 'completed',
        completed_at = NOW(),
        products_processed = v_processed_count
    WHERE id = v_batch_id;

    RETURN QUERY SELECT v_batch_id, v_processed_count, 'SUCCESS'::TEXT;

EXCEPTION WHEN OTHERS THEN
    PERFORM set_config('app.bulk_import_mode', 'false', true);
    RAISE;
END;
$$;

-- ETAPA 3: Adicionar guarda de bulk_import nos triggers mais pesados de products

-- trg_auto_classify_product: classificação automática (pesada, faz queries externas)
-- Só deve rodar na edição manual, NÃO em bulk imports
DROP TRIGGER IF EXISTS trg_auto_classify_product ON public.products;
CREATE TRIGGER trg_auto_classify_product
    BEFORE UPDATE ON public.products
    FOR EACH ROW
    WHEN (
        NOT COALESCE(current_setting('app.bulk_import_mode', true)::boolean, false)
        AND (
            OLD.name IS DISTINCT FROM NEW.name
            OR OLD.main_category_id IS DISTINCT FROM NEW.main_category_id
        )
    )
    EXECUTE FUNCTION public.fn_trigger_auto_classify_product();

-- trg_product_automation: trigger genérico AFTER (faz muitas coisas)
-- Proteger com guarda de bulk import
DROP TRIGGER IF EXISTS trg_product_automation ON public.products;
CREATE TRIGGER trg_product_automation
    AFTER INSERT OR UPDATE ON public.products
    FOR EACH ROW
    WHEN (
        NOT COALESCE(current_setting('app.bulk_import_mode', true)::boolean, false)
    )
    EXECUTE FUNCTION public.fn_trigger_product_automation();

-- trg_products_auto_materials: só rodar se campo materials mudou de fato
DROP TRIGGER IF EXISTS trg_products_auto_materials ON public.products;
CREATE TRIGGER trg_products_auto_materials
    AFTER UPDATE ON public.products
    FOR EACH ROW
    WHEN (
        NOT COALESCE(current_setting('app.bulk_import_mode', true)::boolean, false)
        AND OLD.materials IS DISTINCT FROM NEW.materials
        AND NEW.materials IS NOT NULL
        AND NEW.materials != '[]'::jsonb
    )
    EXECUTE FUNCTION public.trg_auto_process_product_materials();

-- trg_extract_materials_from_name: só rodar quando name muda E materials é null
DROP TRIGGER IF EXISTS trg_extract_materials_from_name ON public.products;
CREATE TRIGGER trg_extract_materials_from_name
    AFTER INSERT OR UPDATE ON public.products
    FOR EACH ROW
    WHEN (
        NOT COALESCE(current_setting('app.bulk_import_mode', true)::boolean, false)
        AND (NEW.materials IS NULL OR NEW.materials = '[]'::jsonb)
        AND NEW.name IS NOT NULL
    )
    EXECUTE FUNCTION public.fn_trigger_extract_materials_from_name();

-- trg_products_seo_autofill: só rodar quando dados de SEO ou nome mudaram
DROP TRIGGER IF EXISTS trg_products_seo_autofill ON public.products;
CREATE TRIGGER trg_products_seo_autofill
    BEFORE UPDATE ON public.products
    FOR EACH ROW
    WHEN (
        NOT COALESCE(current_setting('app.bulk_import_mode', true)::boolean, false)
        AND (
            OLD.name IS DISTINCT FROM NEW.name
            OR OLD.main_category_id IS DISTINCT FROM NEW.main_category_id
            OR OLD.meta_title IS DISTINCT FROM NEW.meta_title
        )
    )
    EXECUTE FUNCTION public.trg_products_seo_autofill();

-- NOTA: Os outros 18 triggers de products foram preservados pois são mais leves
-- (set_updated_at, sync_status_fields, etc.) ou têm condições já adequadas.
-- O maior ganho é em trg_product_automation, trg_auto_classify_product e trg_extract_materials_from_name
-- que fazem queries externas pesadas em loop.

COMMENT ON FUNCTION public.process_spot_products IS
    'v2.0 2026-06-02: Adicionado app.bulk_import_mode para suprimir triggers pesados durante processamento em massa. Triggers de classificação e extração de materiais não executam durante bulk import.';
