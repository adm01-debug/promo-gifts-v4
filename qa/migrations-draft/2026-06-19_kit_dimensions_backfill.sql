-- ============================================================
-- Migração: backfill de dimensões dos 301 kits incompletos
-- Alvo: SSOT externo (doufsxqlfjyuvxuezpln)
-- Autor: PromoGifts · 2026-06-19
-- ============================================================
-- Pré-requisitos validados:
--   ✅ fn_calculate_kit_dimensions(uuid) existe (doc: kit-components-bronze-prata-gold.md)
--   ✅ enrichment_status enum: missing | partial | complete
--
-- Política anti-sobrescrita:
--   - SÓ recalcula kits com status != 'complete' OU dimensões NULL
--   - Dado humano (status='complete' + dimensões setadas) preservado
--   - Auto-commit a cada 50 kits para evitar lock longo
--
-- Simulação prévia recomendada em schema sim.* (ver SIMULACAO_CENARIOS_V6.md)
-- ============================================================

DO $$
DECLARE
  v_kit_id uuid;
  v_count  int := 0;
  v_total  int;
BEGIN
  SELECT count(*) INTO v_total
  FROM public.products p
  WHERE p.is_kit = true
    AND (
      p.length_mm IS NULL OR p.width_mm IS NULL OR p.height_mm IS NULL
    );

  RAISE NOTICE 'Backfill iniciado: % kits candidatos', v_total;

  FOR v_kit_id IN
    SELECT id FROM public.products
    WHERE is_kit = true
      AND (length_mm IS NULL OR width_mm IS NULL OR height_mm IS NULL)
    ORDER BY id
  LOOP
    BEGIN
      PERFORM public.fn_calculate_kit_dimensions(v_kit_id);
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
--   SELECT count(*) FROM products WHERE is_kit = true AND length_mm IS NULL;
--   -- Esperado: ≪ 301 (idealmente 0 ou apenas kits sem componentes)
