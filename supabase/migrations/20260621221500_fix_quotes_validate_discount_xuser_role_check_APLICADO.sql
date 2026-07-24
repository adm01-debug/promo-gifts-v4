-- =============================================================================
-- APLICADO em produção (project doufsxqlfjyuvxuezpln) via apply_migration.
-- Migration: fix_quotes_validate_discount_xuser_role_check
-- Data: 2026-06-21
-- =============================================================================
-- PROBLEMA (GAP latente / write-path):
--   trg_quotes_validate_discount (BEFORE INSERT/UPDATE ON public.quotes) chamava
--   public.is_coord_or_above(_seller_id), onde _seller_id = COALESCE(NEW.seller_id,
--   NEW.created_by) -> ou seja, o papel do SELLER da linha, NÃO do editor.
--   is_coord_or_above LANÇA EXCEPTION (ERRCODE 42501, "forbidden: cannot query
--   role of another user") quando _seller_id <> auth.uid() e o editor não é 'dev'.
--   Resultado: qualquer admin/coordenador/supervisor (não-dev) que salvasse ou
--   editasse o orçamento de OUTRO vendedor recebia 42501 ANTES da validação de
--   desconto -> salvamento falhava com erro críptico. Reproduzido ao vivo:
--   admin (não-dev) avaliando is_coord_or_above(<outro_vendedor>) => 42501.
--
-- CAUSA-RAIZ:
--   is_coord_or_above embute um guard de auth.uid() projetado para proteger
--   LEITURA de papéis em RLS (onde o arg é sempre auth.uid()). Aqui o arg é o
--   seller da linha; dentro de um trigger SECURITY DEFINER que legitimamente
--   precisa checar o papel do seller, esse guard é inadequado.
--
-- CORREÇÃO (único delta de lógica):
--   is_coord_or_above(_seller_id) -> is_supervisor_or_above(_seller_id).
--   is_supervisor_or_above é a função-base (SELECT EXISTS em user_roles, sem
--   guard) e retorna o MESMO booleano. A função roda como owner=postgres (SECDEF)
--   -> lê user_roles sem bloqueio de RLS. Todo o resto do corpo é idêntico.
--
-- VALIDAÇÃO:
--   - 38 call-sites de is_coord_or_above auditados: este era o ÚNICO cross-user.
--   - Pós-fix: admin avaliando a expressão p/ os 13 sellers => 13/13 sem 42501.
--   - fn_run_smoke_tests(): 23/23 PASS (0 regressões).
--   - is_coord_or_above permanece INTACTA (proteção de leitura cross-user em RLS
--     preservada em todos os outros 37 call-sites self-scoped).
-- =============================================================================

CREATE OR REPLACE FUNCTION public.fn_quotes_validate_discount()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
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

  -- BUG-DAR-XUSER FIX: checagem do papel do SELLER sem guard de auth.uid()
  -- (is_coord_or_above estourava 42501 quando _seller_id <> auth.uid() e editor não-dev).
  IF public.is_supervisor_or_above(_seller_id) THEN
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
