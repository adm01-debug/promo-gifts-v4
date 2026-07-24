-- ============================================================
-- Migration: fix_asia_product_names_cleanup
-- Autor: Pipeline de qualidade de dados
-- Data: 2026-06-15
-- 
-- Problema: 297 produtos da Asia Import no Gold têm o formato:
--   "Copo térmico – 11,3xø8,5cm (AxøD)"
-- onde o sufixo "– dims" foi adicionado artificialmente por
-- uma migração histórica, e o campo name foi travado com
-- locked_fields para impedir o pipeline de corrigir.
--
-- Solução: 
--   1. Restaurar o nome limpo (pré-"–") usando o Silver como fonte
--   2. Remover 'name' do locked_fields para pipeline manter
--
-- Escopo: SOMENTE Padrão B (297 produtos com " – " artificial)
-- Padrão A (66 produtos com dims do nome da API) = intocado
-- ============================================================

DO $$
DECLARE
  v_rows  integer;
  v_t0    timestamptz := clock_timestamp();
BEGIN
  -- Configurar como pipeline para não re-travar locked_fields
  -- via trigger fn_products_capture_manual_edits
  PERFORM set_config('app.write_source',     'pipeline', true);
  PERFORM set_config('app.bulk_import_mode', 'true',     true);

  UPDATE public.products p
  SET
    -- Nome limpo = fn_display_product_name(Silver.name)
    -- Garantido igual ao que o pipeline usaria (idempotente)
    name          = public.fn_display_product_name(pp.name),
    -- Desbloquear 'name' para o pipeline manter no futuro
    locked_fields = array_remove(p.locked_fields, 'name'),
    updated_at    = now()
  FROM public.produtos_padronizacao pp
  WHERE pp.supplier_id    = p.supplier_id
    AND pp.supplier_reference = p.supplier_reference
    -- Apenas Asia Import
    AND p.supplier_id     = 'd2734e23-d633-4819-bb15-e51aa44e2118'
    -- Apenas produtos ativos
    AND p.is_active       = true
    -- Apenas Padrão B: sufixo artificial " – dims"
    AND p.name LIKE '% – %'
    AND p.name ~ '\d+[,.]?\d*\s*[xXøØ]'
    -- Garantia de que o Silver tem nome válido
    AND NULLIF(TRIM(pp.name), '') IS NOT NULL;

  GET DIAGNOSTICS v_rows = ROW_COUNT;

  RAISE NOTICE '[fix_asia_product_names_cleanup] % produtos corrigidos em % ms',
    v_rows,
    ROUND(EXTRACT(EPOCH FROM clock_timestamp() - v_t0) * 1000)::int;

  IF v_rows < 280 OR v_rows > 310 THEN
    RAISE EXCEPTION 'Contagem fora do esperado (280-310): % linhas atualizadas. Abortando.', v_rows;
  END IF;
END;
$$;

-- ============================================================
-- Validação pós-migration
-- ============================================================
DO $$
DECLARE
  v_remaining integer;
  v_unlocked  integer;
BEGIN
  -- Contar produtos que AINDA têm o padrão " – dims" após o fix
  SELECT COUNT(*) INTO v_remaining
  FROM products
  WHERE supplier_id = 'd2734e23-d633-4819-bb15-e51aa44e2118'
    AND is_active   = true
    AND name LIKE '% – %'
    AND name ~ '\d+[,.]?\d*\s*[xXøØ]';

  -- Contar produtos que têm 'name' desbloqueado
  SELECT COUNT(*) INTO v_unlocked
  FROM products
  WHERE supplier_id   = 'd2734e23-d633-4819-bb15-e51aa44e2118'
    AND is_active     = true
    AND NOT ('name' = ANY(locked_fields));

  RAISE NOTICE '[VALIDAÇÃO] Restantes com padrão B: % (esperado: 0)', v_remaining;
  RAISE NOTICE '[VALIDAÇÃO] Produtos com name desbloqueado: %', v_unlocked;

  IF v_remaining > 0 THEN
    RAISE EXCEPTION 'FALHA: ainda restam % produtos com padrão B após o fix.', v_remaining;
  END IF;
END;
$$;
