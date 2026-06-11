-- ════════════════════════════════════════════════════════════════
-- SILVER DE-PARA — Fase 3/6: seed do de-para de VARIANTE
-- Registra em supplier_field_mappings (target_table='product_variants') a
-- extração de cada campo de variante que hoje está HARDCODED por UUID em
-- fn_standardize_variant. A Fase 5 reescreve a função para ler estas linhas.
--
-- Campos sintéticos do documento (injetados por fn_standardize_variant, não vêm
-- do raw): `_ref` = supplier_products_raw.supplier_reference ; `_sm_hex` = hex
-- resolvido na rede produtos_similares (Só Marcas).
--
-- target_field 'parent_reference' carrega a REGRA de derivação do pai
-- (lida por fn_derive_parent_ref, Fase 4): source_field = chave autoritativa do
-- pai no raw (ou o sentinela '_none' quando o fornecedor não tem — a coluna é
-- NOT NULL) e transform_config.fallback = estratégia quando ausente
-- ('identity' | 'strip_hyphen_suffix' | 'asia_hyphen_or_suffix_P').
--
-- Idempotente: limpa as linhas product_variants destes fornecedores e reinsere.
-- ════════════════════════════════════════════════════════════════

DELETE FROM public.supplier_field_mappings
 WHERE target_table = 'product_variants'
   AND supplier_id IN (
     'bcfc0d02-44c6-48ae-8472-12b1a3f3d8e0', -- SPOT/Stricker
     'd6718a29-e954-4c1b-bd84-03ea24884900', -- XBZ
     'd2734e23-d633-4819-bb15-e51aa44e2118', -- ASIA
     '841cd690-210a-422a-908c-7676828db272'  -- Só Marcas
   );

INSERT INTO public.supplier_field_mappings
   (supplier_id, source_field, source_path, target_table, target_field,
    transform_type, transform_config, is_active, priority, created_at, updated_at)
VALUES
  -- ─────────────────── SPOT / Stricker ───────────────────
  ('bcfc0d02-44c6-48ae-8472-12b1a3f3d8e0', '_ref',         NULL, 'product_variants', 'sku',              'direct', NULL, true, 10, now(), now()),
  ('bcfc0d02-44c6-48ae-8472-12b1a3f3d8e0', 'Sku',          NULL, 'product_variants', 'supplier_sku',     'direct', NULL, true, 10, now(), now()),
  ('bcfc0d02-44c6-48ae-8472-12b1a3f3d8e0', 'ColorCode',    NULL, 'product_variants', 'color_code',       'direct', NULL, true, 10, now(), now()),
  ('bcfc0d02-44c6-48ae-8472-12b1a3f3d8e0', 'ColorName',    NULL, 'product_variants', 'color_name',       'direct', NULL, true, 10, now(), now()),
  ('bcfc0d02-44c6-48ae-8472-12b1a3f3d8e0', 'ColorHex',     NULL, 'product_variants', 'color_hex',        'direct', NULL, true, 10, now(), now()),
  ('bcfc0d02-44c6-48ae-8472-12b1a3f3d8e0', 'StockQuantity',NULL, 'product_variants', 'stock_quantity',   'direct', NULL, true, 10, now(), now()),
  ('bcfc0d02-44c6-48ae-8472-12b1a3f3d8e0', 'Price1',       NULL, 'product_variants', 'cost_price',       'direct', NULL, true, 10, now(), now()),
  ('bcfc0d02-44c6-48ae-8472-12b1a3f3d8e0', 'ProdReference',NULL, 'product_variants', 'parent_reference', 'direct', '{"fallback":"identity"}'::jsonb, true, 10, now(), now()),

  -- ─────────────────────── XBZ ───────────────────────────
  ('d6718a29-e954-4c1b-bd84-03ea24884900', '_ref',              NULL, 'product_variants', 'sku',              'prefix', '{"prefix":"XBZ-"}'::jsonb, true, 10, now(), now()),
  ('d6718a29-e954-4c1b-bd84-03ea24884900', 'CodigoComposto',    NULL, 'product_variants', 'supplier_sku',     'direct', NULL, true, 10, now(), now()),
  ('d6718a29-e954-4c1b-bd84-03ea24884900', 'CorWebPrincipalId', NULL, 'product_variants', 'color_api_id',     'direct', NULL, true, 10, now(), now()),
  ('d6718a29-e954-4c1b-bd84-03ea24884900', 'CorWebPrincipal',   NULL, 'product_variants', 'color_name',       'direct', NULL, true, 10, now(), now()),
  ('d6718a29-e954-4c1b-bd84-03ea24884900', 'QuantidadeDisponivel', NULL, 'product_variants', 'stock_quantity','direct', NULL, true, 10, now(), now()),
  ('d6718a29-e954-4c1b-bd84-03ea24884900', 'PrecoVenda',        NULL, 'product_variants', 'cost_price',       'direct', NULL, true, 10, now(), now()),
  ('d6718a29-e954-4c1b-bd84-03ea24884900', 'CodigoAmigavel',    NULL, 'product_variants', 'parent_reference', 'direct', '{"fallback":"strip_hyphen_suffix"}'::jsonb, true, 10, now(), now()),

  -- ─────────────────────── ASIA ──────────────────────────
  ('d2734e23-d633-4819-bb15-e51aa44e2118', '_ref',          NULL, 'product_variants', 'sku',              'prefix', '{"prefix":"ASIA-"}'::jsonb, true, 10, now(), now()),
  ('d2734e23-d633-4819-bb15-e51aa44e2118', 'var_referencia',NULL, 'product_variants', 'supplier_sku',     'direct', NULL, true, 10, now(), now()),
  ('d2734e23-d633-4819-bb15-e51aa44e2118', 'var_cor_nome',  NULL, 'product_variants', 'color_name',       'direct', NULL, true, 10, now(), now()),
  ('d2734e23-d633-4819-bb15-e51aa44e2118', 'var_cor_hex',   NULL, 'product_variants', 'color_hex',        'direct', NULL, true, 10, now(), now()),
  ('d2734e23-d633-4819-bb15-e51aa44e2118', 'var_estoque',   NULL, 'product_variants', 'stock_quantity',   'direct', NULL, true, 10, now(), now()),
  ('d2734e23-d633-4819-bb15-e51aa44e2118', 'preco',         NULL, 'product_variants', 'cost_price',       'direct', NULL, true, 10, now(), now()),
  ('d2734e23-d633-4819-bb15-e51aa44e2118', '_none',         NULL, 'product_variants', 'parent_reference', 'direct', '{"fallback":"asia_hyphen_or_suffix_P"}'::jsonb, true, 10, now(), now()),

  -- ────────────────────── Só Marcas ──────────────────────
  ('841cd690-210a-422a-908c-7676828db272', '_ref',    NULL, 'product_variants', 'sku',              'direct', NULL, true, 10, now(), now()),
  ('841cd690-210a-422a-908c-7676828db272', '_ref',    NULL, 'product_variants', 'supplier_sku',     'direct', NULL, true, 10, now(), now()),
  ('841cd690-210a-422a-908c-7676828db272', 'titulo',  NULL, 'product_variants', 'color_name',       'custom', '{"function":"fn_extract_color_from_title"}'::jsonb, true, 10, now(), now()),
  ('841cd690-210a-422a-908c-7676828db272', '_sm_hex', NULL, 'product_variants', 'color_hex',        'direct', NULL, true, 10, now(), now()),
  ('841cd690-210a-422a-908c-7676828db272', 'estoque', NULL, 'product_variants', 'stock_quantity',   'direct', NULL, true, 10, now(), now()),
  ('841cd690-210a-422a-908c-7676828db272', 'preco_sem_gravacao_sem_impostos', NULL, 'product_variants', 'cost_price', 'direct', NULL, true, 10, now(), now()),
  ('841cd690-210a-422a-908c-7676828db272', '_none',   NULL, 'product_variants', 'parent_reference', 'direct', '{"fallback":"identity"}'::jsonb, true, 10, now(), now());

-- ════════════════════════════════════════════════════════════════
-- ROLLBACK (manual): remove apenas as linhas de variante destes fornecedores.
--   DELETE FROM public.supplier_field_mappings
--    WHERE target_table='product_variants'
--      AND supplier_id IN ('bcfc0d02-44c6-48ae-8472-12b1a3f3d8e0',
--                          'd6718a29-e954-4c1b-bd84-03ea24884900',
--                          'd2734e23-d633-4819-bb15-e51aa44e2118',
--                          '841cd690-210a-422a-908c-7676828db272');
-- (Reverter as funções para as versões de 20260605101258 / 20260605161000.)
-- ════════════════════════════════════════════════════════════════
