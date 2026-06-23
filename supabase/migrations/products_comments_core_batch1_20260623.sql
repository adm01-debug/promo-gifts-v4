-- M1 Batch 1: COMMENTs Core/Identidade + Preço + Estoque
COMMENT ON COLUMN public.products.cost_price IS 'Custo do fornecedor. Null em v_products_public por segurança.';
COMMENT ON COLUMN public.products.sale_price IS 'Preço de venda (cost × markup). Mantido por trigger.';
COMMENT ON COLUMN public.products.stock_quantity IS 'Estoque total denormalizado. Cache de variant_supplier_sources.';
COMMENT ON COLUMN public.products.brand IS 'Marca do produto. 100% preenchido.';
COMMENT ON COLUMN public.products.min_quantity IS 'Qtd mínima de venda. 15 valores distintos.';
