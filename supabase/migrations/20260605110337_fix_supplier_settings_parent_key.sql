
-- 88 Brindes
INSERT INTO public.supplier_settings (
    id, supplier_id, parent_key_source, sku_prefix, variant_name_template, created_at, updated_at
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

-- Asia Import
UPDATE public.supplier_settings
SET parent_key_source    = 'referencia',
    sku_prefix           = '',
    variant_name_template = '{product_name} | {color_name}',
    updated_at           = now()
WHERE supplier_id = 'd2734e23-d633-4819-bb15-e51aa44e2118';

-- Só Marcas
INSERT INTO public.supplier_settings (
    id, supplier_id, parent_key_source, sku_prefix, variant_name_template, created_at, updated_at
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
