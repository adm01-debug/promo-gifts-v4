-- M5: COMMENTs em colunas 99%+ NULL (com refs de código, não dropáveis agora)
COMMENT ON COLUMN public.products.internal_height_cm IS 'Dimensão interna kit. null_frac=99.8%. 12 refs frontend. DROP requer refatoração kit-builder.';
COMMENT ON COLUMN public.products.internal_width_cm IS 'Dimensão interna kit. null_frac=99.8%. DROP requer refatoração kit-builder.';
COMMENT ON COLUMN public.products.internal_length_cm IS 'Dimensão interna kit. null_frac=99.8%. DROP requer refatoração kit-builder.';
COMMENT ON COLUMN public.products.optional_packaging_ref IS 'Ref embalagem opcional. null_frac=99%+. 1 ref frontend. Candidata a DROP.';
