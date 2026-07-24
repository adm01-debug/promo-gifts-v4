COMMENT ON TABLE public.produtos_padronizacao IS
'Camada SILVER (medallion). Conforma produtos do BRONZE (supplier_products_raw via raw_id) e os equivale ao GOLD (products via product_id). Fluxo: pending -> standardized -> promoted | rejected. Escrita via service_role (pipeline N8N); leitura via authenticated (RLS habilitado).';

COMMENT ON COLUMN public.produtos_padronizacao.raw_id IS 'FK -> supplier_products_raw (BRONZE). NULL se a origem raw foi removida.';
COMMENT ON COLUMN public.produtos_padronizacao.product_id IS 'FK -> products (GOLD). Equivalencia silver->gold. Preenchido quando status=promoted.';
COMMENT ON COLUMN public.produtos_padronizacao.status IS 'Estado no pipeline: pending|standardized|rejected|promoted. promoted exige product_id (chk_promoted_requires_gold).';
COMMENT ON COLUMN public.produtos_padronizacao.cost_price IS 'STAGING. Custo de entrada do fornecedor. Fonte canonica de custo por faixa: supplier_price_tiers. ~80% NULL por design.';
COMMENT ON COLUMN public.produtos_padronizacao.colors IS 'STAGING jsonb. Cores cruas do fornecedor. Normalizacao canonica: color_equivalences / supplier_colors.';
COMMENT ON COLUMN public.produtos_padronizacao.images IS 'STAGING jsonb. URLs cruas. Normalizacao canonica: product_images.';
COMMENT ON COLUMN public.produtos_padronizacao.validation_errors IS 'jsonb. Erros de validacao acumulados (preenchido quando status=rejected).';
COMMENT ON COLUMN public.produtos_padronizacao.supplier_reference IS 'Referencia do produto no fornecedor. Parte da chave natural (supplier_id, supplier_reference).';