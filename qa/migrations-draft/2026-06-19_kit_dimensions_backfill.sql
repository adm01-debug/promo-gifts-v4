-- ============================================================
-- Migração: backfill de dimensões dos 42 kits incompletos
-- Alvo: SSOT externo (doufsxqlfjyuvxuezpln)
-- Autor: PromoGifts · 2026-06-19 (corrigida 2026-06-20)
-- ============================================================
-- IMPORTANTE: esta migração calcula dimensões DO KIT PAI (caixa final
-- despachada), agregando peso + embalagem dos componentes. NÃO depende
-- de componentes serem vendáveis avulsos — são apenas insumo de cálculo.
-- Isso resolve frete e logística de kits nativos do fornecedor.
--
-- Pré-requisitos validados:
--   ✅ fn_calculate_kit_dimensions(uuid) existe
--   ✅ Colunas de destino: products.length_cm / width_cm / height_cm (numeric)
--   ✅ Colunas internas:   products.internal_length_cm / internal_width_cm / internal_height_cm
--   ✅ Peso:               products.weight_g (integer)
--   ✅ fn_calculate_kit_dimensions retorna valores em MM → convertidos para CM aqui
--
-- Política anti-sobrescrita:
--   - SÓ recalcula kits com length_cm / width_cm / height_cm NULL (preserva dado humano)
--
-- CORREÇÕES em relação ao draft original (2026-06-19):
--   BUG-1: colunas de filtro eram length_mm/width_mm/height_mm (não existem em products);
--          correto é length_cm/width_cm/height_cm
--   BUG-2: PERFORM descartava resultado de fn_calculate_kit_dimensions;
--          correto é SELECT INTO + UPDATE com conversão mm→cm
-- ============================================================

DO $$
DECLARE
  v_kit_id  uuid;
  v_count   int := 0;
  v_total   int;
  v_dims    RECORD;
BEGIN
  SELECT count(*) INTO v_total
  FROM public.products p
  WHERE p.is_kit = true
    AND (p.length_cm IS NULL OR p.width_cm IS NULL OR p.height_cm IS NULL);

  RAISE NOTICE 'Backfill iniciado: % kits candidatos', v_total;

  FOR v_kit_id IN
    SELECT id FROM public.products
    WHERE is_kit = true
      AND (length_cm IS NULL OR width_cm IS NULL OR height_cm IS NULL)
    ORDER BY id
  LOOP
    BEGIN
      SELECT * INTO v_dims
      FROM public.fn_calculate_kit_dimensions(v_kit_id)
      LIMIT 1;

      IF v_dims IS NOT NULL AND v_dims.packaging_ext_length_mm IS NOT NULL THEN
        UPDATE public.products
        SET
          length_cm          = ROUND(v_dims.packaging_ext_length_mm  / 10.0, 1),
          width_cm           = ROUND(v_dims.packaging_ext_width_mm   / 10.0, 1),
          height_cm          = ROUND(v_dims.packaging_ext_height_mm  / 10.0, 1),
          internal_length_cm = CASE WHEN v_dims.packaging_int_length_mm IS NOT NULL
                                    THEN ROUND(v_dims.packaging_int_length_mm / 10.0, 1)
                                    ELSE internal_length_cm END,
          internal_width_cm  = CASE WHEN v_dims.packaging_int_width_mm IS NOT NULL
                                    THEN ROUND(v_dims.packaging_int_width_mm  / 10.0, 1)
                                    ELSE internal_width_cm END,
          internal_height_cm = CASE WHEN v_dims.packaging_int_height_mm IS NOT NULL
                                    THEN ROUND(v_dims.packaging_int_height_mm / 10.0, 1)
                                    ELSE internal_height_cm END,
          weight_g           = COALESCE(v_dims.total_weight_g, weight_g)
        WHERE id = v_kit_id;
      END IF;

      v_count := v_count + 1;
      IF v_count % 50 = 0 THEN
        RAISE NOTICE '  ... % / % kits processados', v_count, v_total;
      END IF;
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'Kit % falhou: %', v_kit_id, SQLERRM;
    END;
  END LOOP;

  RAISE NOTICE 'Backfill concluído: % kits processados', v_count;
END $$;

-- Validação pós-execução:
--   SELECT count(*) FROM products WHERE is_kit = true AND length_cm IS NULL;
--   Esperado: 0 (ou próximo de 0 se algum kit não tem componentes com embalagem)
