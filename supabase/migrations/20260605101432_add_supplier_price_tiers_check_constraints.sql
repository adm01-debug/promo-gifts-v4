-- CHECK constraints em supplier_price_tiers (auditoria PR #659, CodeRabbit).
-- Verificado: 17.722 linhas, 0 violacoes antes de aplicar.
ALTER TABLE public.supplier_price_tiers
  ADD CONSTRAINT supplier_price_tiers_tier_order_ck   CHECK (tier_order > 0),
  ADD CONSTRAINT supplier_price_tiers_min_qty_ck      CHECK (min_qty > 0),
  ADD CONSTRAINT supplier_price_tiers_cost_price_ck   CHECK (cost_price >= 0),
  ADD CONSTRAINT supplier_price_tiers_valid_window_ck CHECK (valid_to IS NULL OR valid_from IS NULL OR valid_to >= valid_from);