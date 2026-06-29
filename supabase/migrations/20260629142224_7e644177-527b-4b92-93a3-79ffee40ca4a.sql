-- Trigger anti-fraude: bloqueia alteração de quote_items.unit_price por usuários
-- sem permissão administrativa/comercial ampla. RLS sozinho não consegue restringir
-- coluna específica em UPDATE — por isso usamos trigger BEFORE UPDATE.
--
-- Admins/supervisores (has_role('admin') / has_role('supervisor') / can_view_all_sales())
-- continuam podendo ajustar preço quando necessário. Sellers comuns NÃO.

CREATE OR REPLACE FUNCTION public.prevent_non_admin_quote_item_price_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_is_admin boolean := false;
BEGIN
  -- INSERTs e mudanças sem auth context (service_role / jobs) passam direto.
  IF v_uid IS NULL THEN
    RETURN NEW;
  END IF;

  -- Se unit_price não mudou, nada a validar.
  IF NEW.unit_price IS NOT DISTINCT FROM OLD.unit_price THEN
    RETURN NEW;
  END IF;

  -- Verifica privilégio (admin OU supervisor OU can_view_all_sales).
  BEGIN
    v_is_admin := public.has_role(v_uid, 'admin'::app_role)
               OR public.has_role(v_uid, 'supervisor'::app_role)
               OR public.can_view_all_sales();
  EXCEPTION WHEN OTHERS THEN
    v_is_admin := false;
  END;

  IF NOT v_is_admin THEN
    RAISE EXCEPTION 'Preço unitário (unit_price) não pode ser alterado por este usuário. O preço vem do catálogo e é somente leitura.'
      USING ERRCODE = '42501', HINT = 'Solicite a um administrador para ajustar o preço, se necessário.';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_non_admin_quote_item_price_change ON public.quote_items;
CREATE TRIGGER trg_prevent_non_admin_quote_item_price_change
  BEFORE UPDATE OF unit_price ON public.quote_items
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_non_admin_quote_item_price_change();