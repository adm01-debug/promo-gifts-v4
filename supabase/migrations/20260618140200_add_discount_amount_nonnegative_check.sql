-- DEFESA EM PROFUNDIDADE: discount_amount não-negativo (qualidade de dados).
-- Fecha a assimetria: discount_percent (CHECK valid_discount_percent_range 0-100) e
-- negotiation_markup_percent (CHECK valid_negotiation_markup_range 0-50) já eram
-- guardados, mas discount_amount não tinha limite inferior.
--
-- O app já rejeita via validateDiscount ("O valor do desconto não pode ser negativo"),
-- mas SQL bruto/migração futura poderia inserir negativo, causando overcharge
-- (total = subtotal - discount_amount → aumenta o total). Não é bypass de alçada
-- (desconto negativo gera real_discount_percent <= 0, que o trigger libera), mas é
-- inconsistência de dados.
--
-- Verificado antes de aplicar: 0 linhas existentes violavam (amount_negativo=0).
-- NULL permitido para manter consistência com os outros CHECKs.
--
-- Já aplicada em produção via Supabase MCP (add_discount_amount_nonnegative_check);
-- registrada aqui para reproducibilidade.
ALTER TABLE public.quotes
  DROP CONSTRAINT IF EXISTS valid_discount_amount_nonnegative;

ALTER TABLE public.quotes
  ADD CONSTRAINT valid_discount_amount_nonnegative
  CHECK (discount_amount IS NULL OR discount_amount >= 0);
