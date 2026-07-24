
-- ════════════════════════════════════════════════════════════════
-- SOBERANIA DA INTERFACE — trava por-campo em products
-- "Edição na interface é absoluta": campo tocado à mão entra em
-- locked_fields e a promoção silver→products nunca o sobrescreve.
-- ════════════════════════════════════════════════════════════════

ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS locked_fields text[] NOT NULL DEFAULT '{}';

COMMENT ON COLUMN public.products.locked_fields IS
  'Campos editados manualmente na interface (soberanos). A promoção silver→products nunca sobrescreve um campo presente aqui. Populado pelo trigger trg_products_capture_manual_edits quor a escrita é humana.';

-- ── Função: captura edição manual e trava o campo ─────────────────
-- Distingue escrita HUMANA de escrita do PIPELINE pela presença de um GUC
-- de sessão: o pipeline seta app.write_source='pipeline'; o front (default)
-- não seta → é tratado como edição humana e trava os campos alterados.
CREATE OR REPLACE FUNCTION public.fn_products_capture_manual_edits()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  v_src text := current_setting('app.write_source', true);  -- 'pipeline' | NULL/'ui'
  v_campos text[] := ARRAY[
    'name','description','short_description','sku','cost_price','sale_price','suggested_price',
    'primary_image_url','images','ncm_code','weight_g','height_cm','width_cm','length_cm',
    'dimensions_display','brand','packing_type','min_quantity','stock_quantity','is_active',
    'warranty_months','ipi_rate','engraving_type','category_id','main_category_id'
  ];
  v_campo text;
  v_old jsonb := to_jsonb(OLD);
  v_new jsonb := to_jsonb(NEW);
BEGIN
  -- Só captura em UPDATE feito por humano (não-pipeline)
  IF TG_OP = 'UPDATE' AND COALESCE(v_src,'ui') <> 'pipeline' THEN
    FOREACH v_campo IN ARRAY v_campos LOOP
      IF (v_old -> v_campo) IS DISTINCT FROM (v_new -> v_campo) THEN
        IF NOT (v_campo = ANY(NEW.locked_fields)) THEN
          NEW.locked_fields := array_append(NEW.locked_fields, v_campo);
        END IF;
      END IF;
    END LOOP;
  END IF;
  RETURN NEW;
END;
$$;

-- roda cedo (before) para que locked_fields já vá gravado na mesma operação.
-- nome "trg_aa_" garante execução antes dos demais BEFORE UPDATE.
DROP TRIGGER IF EXISTS trg_aa_capture_manual_edits ON public.products;
CREATE TRIGGER trg_aa_capture_manual_edits
  BEFORE UPDATE ON public.products
  FOR EACH ROW EXECUTE FUNCTION public.fn_products_capture_manual_edits();
