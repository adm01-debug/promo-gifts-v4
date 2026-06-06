-- ════════════════════════════════════════════════════════════════
-- MEDALLION — Fase 8 / Item 1: Dimensões na promoção + aposenta trigger Bronze
-- ════════════════════════════════════════════════════════════════
-- O trigger AFTER `trg_auto_sync_product_dimensions` em supplier_products_raw
-- (→ fn_sync_single_product_dimensions) era o parser de dimensões do SPOT
-- (CombinedSizes → length/width/height/diameter/shape). Não era redundante: o
-- de-para do SPOT tem length_cm/width_cm INATIVOS de propósito. Era, porém, um
-- caminho Bronze→Gold paralelo (fora das 3 fases).
--
-- Item 1: relocar a MESMA lógica (mesma função, zero risco de paridade) para a
-- fase de promoção (Silver→Gold) dentro de fn_promote_padronizacao, e então
-- DROPAR o trigger Bronze.
--
-- NOTA: o corpo de fn_promote_padronizacao é reproduzido na íntegra (estado
-- pós-#679) + 1 chamada a fn_sync_single_product_dimensions no bloco da raw.
-- Aplicado via MCP (MCP-first, ADR 0006); ver o arquivo de migração aplicado
-- para o corpo completo. Aqui registramos o delta essencial e a remoção do trigger.
-- ════════════════════════════════════════════════════════════════

-- (corpo completo de fn_promote_padronizacao aplicado via MCP — delta abaixo)
-- + dentro do bloco `IF s.raw_id IS NOT NULL THEN ... END IF;`:
--     PERFORM public.fn_sync_single_product_dimensions(
--               v_pid, (SELECT raw_data FROM public.supplier_products_raw WHERE id = s.raw_id));

DROP TRIGGER IF EXISTS trg_auto_sync_product_dimensions ON public.supplier_products_raw;

COMMENT ON FUNCTION public.fn_trigger_auto_sync_dimensions() IS
  'DEPRECATED 2026-06-06 (Fase 8): trigger Bronze aposentado. Dimensoes estruturadas agora na promocao (fn_promote_padronizacao -> fn_sync_single_product_dimensions).';
