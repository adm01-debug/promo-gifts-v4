-- Bug fix (incidente alçada de desconto): valid_until IS NULL era tratado como
-- expirado (NULL > now() = NULL = false), porque fn_quotes_validate_discount exigia
-- `valid_until > now()`. Combinado com respondToApproval que NÃO definia valid_until,
-- nenhuma aprovação de coordenador podia ser salva pelo vendedor — fluxo 100% quebrado.
--
-- Correção: trata `valid_until IS NULL` como "sem vencimento" (retrocompat para
-- registros legados anteriores ao CHECK dar_valid_until_required_when_approved).
-- O hook respondToApproval passou a definir valid_until = now() + 30 dias ao aprovar.
--
-- Esta migration registra no controle de versão a função já aplicada em produção
-- via Supabase MCP (apply_migration fix_validate_discount_valid_until_null).
CREATE OR REPLACE FUNCTION public.fn_quotes_validate_discount()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
-- search_path explícito: funções SECURITY DEFINER sem search_path fixo são
-- vulneráveis a hijacking de resolução de objetos via search_path da sessão.
-- Padrão do repo (mesmo de fn_quotes_calc_real_values).
SET search_path TO 'pg_catalog', 'public'
AS $function$
DECLARE
  _max_allowed numeric;
  _real_discount_pct numeric;
  _has_valid_approval boolean;
  _current_hash text;
  _seller_id uuid;
  _msg text;
BEGIN
  IF current_setting('request.jwt.claim.role', true) = 'service_role' THEN
    RETURN NEW;
  END IF;

  _seller_id := COALESCE(NEW.seller_id, NEW.created_by);

  IF _seller_id IS NULL THEN
    RETURN NEW;
  END IF;

  IF public.is_coord_or_above(_seller_id) THEN
    RETURN NEW;
  END IF;

  _real_discount_pct := COALESCE(NEW.real_discount_percent, 0);

  IF _real_discount_pct <= 0 THEN
    RETURN NEW;
  END IF;

  SELECT max_discount_percent INTO _max_allowed
  FROM public.seller_discount_limits
  WHERE user_id = _seller_id;

  IF _max_allowed IS NULL THEN
    RAISE EXCEPTION 'Vendedor sem limite de desconto cadastrado. Solicite ao admin que configure seu limite antes de salvar orcamentos.'
      USING ERRCODE = '23514';
  END IF;

  IF _real_discount_pct <= _max_allowed THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    _msg := 'Desconto de ' || ROUND(_real_discount_pct, 2)::text ||
            ' por cento acima do seu limite de ' || ROUND(_max_allowed, 2)::text ||
            ' por cento. Salve o orcamento com desconto dentro do limite primeiro, depois solicite aprovacao ao coordenador.';
    RAISE EXCEPTION '%', _msg USING ERRCODE = '23514';
  END IF;

  _current_hash := public.compute_quote_snapshot_hash(NEW.id);

  -- NULL valid_until = sem vencimento (retrocompat). Aprovações com valid_until definido
  -- precisam estar dentro do prazo.
  SELECT EXISTS (
    SELECT 1 FROM public.discount_approval_requests
    WHERE quote_id = NEW.id
      AND status = 'approved'
      AND (valid_until IS NULL OR valid_until > now())
      AND requested_discount_percent >= _real_discount_pct
      AND quote_snapshot_hash = _current_hash
  ) INTO _has_valid_approval;

  IF _has_valid_approval THEN
    RETURN NEW;
  END IF;

  -- Aprovação existe mas expirou (valid_until definido e já passou) OU snapshot mudou.
  IF EXISTS (
    SELECT 1 FROM public.discount_approval_requests
    WHERE quote_id = NEW.id AND status = 'approved'
      AND (
        (valid_until IS NOT NULL AND valid_until <= now())
        OR quote_snapshot_hash <> _current_hash
      )
  ) THEN
    RAISE EXCEPTION 'Aprovacao anterior nao vale mais (orcamento foi alterado ou aprovacao expirou). Solicite nova aprovacao ao coordenador.'
      USING ERRCODE = '23514';
  END IF;

  _msg := 'Desconto de ' || ROUND(_real_discount_pct, 2)::text ||
          ' por cento acima do seu limite de ' || ROUND(_max_allowed, 2)::text ||
          ' por cento. Solicite aprovacao ao coordenador antes de salvar.';
  RAISE EXCEPTION '%', _msg USING ERRCODE = '23514';
END;
$function$;
