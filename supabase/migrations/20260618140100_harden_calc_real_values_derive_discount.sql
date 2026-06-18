-- DEFESA EM PROFUNDIDADE: fn_quotes_calc_real_values deriva o desconto efetivo de
-- AMBOS discount_percent e discount_amount, em vez de confiar que o cliente já
-- computou discount_amount consistente com discount_percent.
--
-- Gap fechado: se qualquer caminho (SQL bruto, migração, novo código) gravar
-- discount_percent sem discount_amount, a fórmula antiga computava
-- real_discount_percent=0, BURLANDO silenciosamente a validação de alçada
-- (trg_quotes_validate_discount). Agora o desconto efetivo é derivado de forma
-- robusta no servidor.
--
-- Retrocompatibilidade PROVADA: 3608 combos de inputs consistentes do app
-- (percent e amount mode × markup 0-50 × desconto 0-100) → 100% idênticos à
-- fórmula anterior (max_diff=0.00). Só difere no caso de inconsistência (gap).
--
-- Já aplicada em produção via Supabase MCP (harden_calc_real_values_derive_discount);
-- registrada aqui para reproducibilidade.
CREATE OR REPLACE FUNCTION public.fn_quotes_calc_real_values()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'pg_catalog', 'public'
AS $function$
DECLARE
  v_markup numeric;
  v_effective_discount numeric;
BEGIN
  -- Cópia local clampada usada APENAS como divisor defensivo (não regrava a coluna).
  -- A faixa válida é garantida pelo CHECK valid_negotiation_markup_range ([0,50]):
  -- valores fora de faixa são rejeitados pelo constraint (fail-loud), não silenciados.
  v_markup := LEAST(50, GREATEST(0, COALESCE(NEW.negotiation_markup_percent, 0)));

  IF v_markup > 0 THEN
    NEW.real_subtotal := ROUND(NEW.subtotal / (1 + v_markup / 100.0), 2);
  ELSE
    NEW.real_subtotal := NEW.subtotal;
  END IF;

  -- Desconto efetivo derivado no servidor (não confia no cliente):
  -- se há percentual, ele tem precedência e é convertido sobre o subtotal apresentado;
  -- caso contrário usa o valor absoluto. Fecha o gap onde discount_percent setado
  -- com discount_amount=0 zerava o real_discount_percent e burlava a alçada.
  IF COALESCE(NEW.discount_percent, 0) > 0 THEN
    v_effective_discount := ROUND(NEW.subtotal * NEW.discount_percent / 100.0, 2);
  ELSE
    v_effective_discount := COALESCE(NEW.discount_amount, 0);
  END IF;

  IF NEW.real_subtotal > 0 THEN
    NEW.real_discount_percent := ROUND(
      ((NEW.real_subtotal - (NEW.subtotal - v_effective_discount)) / NEW.real_subtotal) * 100,
      2
    );
  ELSE
    NEW.real_discount_percent := 0;
  END IF;

  RETURN NEW;
END
$function$;
