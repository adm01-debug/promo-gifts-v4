-- M1: COMMENT oficial na coluna products.name
COMMENT ON COLUMN public.products.name IS
'Nome comercial do produto exibido no catalogo e na busca.
Tipo: text irrestrito, NOT NULL, sem default, posicao ordinal 2.
Constraint: chk_products_name_not_empty CHECK(length(TRIM(name)) > 0).
Origem por fornecedor: XBZ NomeProduto (avg 24), Spot Name (avg 52, max 183), Asia nome, So Marcas nome.
Downstream de 8 triggers: slug, meta_title, meta_description, og_title, og_description, canonical_url, search_vector (Peso A), capacity_ml, dimensions, weight_g, meta_keywords, category_id, materials.
Protecao manual: trg_aa_capture_manual_edits adiciona name a locked_fields quando write_source != pipeline.
NAO confundir com product_variants.name que eh UPPER via fn_normalize_product_name (design intencional).
7 indices: 1 GIN trigram + 6 btree compostos.';
