-- BUG #4: fn_process_raw_v2 retorna success=false imediatamente quando
-- supplier_settings.parent_key_source IS NULL. Três fornecedores estavam sem
-- configuração, impedindo o V2 de processar qualquer dado deles.
--
-- 88 Brindes: raw_data->>'ref_produto' é a referência do produto-pai
--             (ex: "1000 002"), enquanto supplier_reference é a variante completa
--             (ex: "1000-002-1-56").
--
-- Asia Import: dado já chegou achatado (uma linha = uma cor/variante).
--              ref_produto = var_referencia = referencia por linha → parent_key_source
--              = 'referencia' cria um produto-pai por linha (modelo flat).
--              Agrupamento por produto-pai real exigiria enriquecimento upstream
--              (fora do escopo desta migration).
--
-- Só Marcas: raw_data->>'codigo' = supplier_reference para todos os produtos.
--            Cada linha é um produto distinto (1 produto : 1-2 variantes).

-- 88 Brindes — não tinha linha em supplier_settings
INSERT INTO public.supplier_settings (
    id,
    supplier_id,
    parent_key_source,
    sku_prefix,
    variant_name_template,
    created_at,
    updated_at
)
VALUES (
    gen_random_uuid(),
    'c3345743-aedf-4b31-a761-978b0d4aa79e',
    'ref_produto',
    '',
    '{product_name} | {color_name}',
    now(),
    now()
)
ON CONFLICT (supplier_id) DO UPDATE
    SET parent_key_source    = EXCLUDED.parent_key_source,
        sku_prefix           = EXCLUDED.sku_prefix,
        variant_name_template = EXCLUDED.variant_name_template,
        updated_at           = now();

-- Asia Import — tinha linha com todos os campos NULL
UPDATE public.supplier_settings
SET parent_key_source    = 'referencia',
    sku_prefix           = '',
    variant_name_template = '{product_name} | {color_name}',
    updated_at           = now()
WHERE supplier_id = 'd2734e23-d633-4819-bb15-e51aa44e2118';

-- Só Marcas — não tinha linha em supplier_settings
INSERT INTO public.supplier_settings (
    id,
    supplier_id,
    parent_key_source,
    sku_prefix,
    variant_name_template,
    created_at,
    updated_at
)
VALUES (
    gen_random_uuid(),
    '841cd690-210a-422a-908c-7676828db272',
    'codigo',
    '',
    '{product_name}',
    now(),
    now()
)
ON CONFLICT (supplier_id) DO UPDATE
    SET parent_key_source    = EXCLUDED.parent_key_source,
        sku_prefix           = EXCLUDED.sku_prefix,
        variant_name_template = EXCLUDED.variant_name_template,
        updated_at           = now();
