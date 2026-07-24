
-- ════════════════════════════════════════════════════════════════
-- CORREÇÃO de trigger legado quebrado.
-- fn_log_price_change() referenciava OLD/NEW.price_1..price_5 e
-- min_qty_1..5, mas product_variants NÃO possui essas colunas (os
-- preços migraram para variant_supplier_sources). O trigger
-- (AFTER UPDATE ON product_variants) quebrava QUALQUER update de
-- variante — inclusive edições pelo site e a promoção do pipeline.
-- Tornada no-op segura. A auditoria de preço, se desejada, deve ser
-- implementada em trigger de variant_supplier_sources.
-- Corpo original preservado no handoff para reversão.
-- ════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.fn_log_price_change()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RETURN NEW;
END;
$$;
