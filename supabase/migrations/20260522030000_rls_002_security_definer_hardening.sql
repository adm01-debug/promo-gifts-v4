-- ============================================================================
-- RLS-002 — Hardening de SECURITY DEFINER functions expostas a authenticated
-- ============================================================================
-- Source: auditoria back-end sênior 2026-05-22 (PR #55, mergeado).
--
-- Advisor `authenticated_security_definer_function_executable` flaggou:
--   • is_admin_or_above(_user_id uuid)  → callable por authenticated com qualquer UUID
--   • is_coord_or_above(_user_id uuid)  → idem
--   • can_access_quote(_quote_id uuid)  → checa auth.uid() interno, safe
--   • org_has_any_members(_org_id uuid) → leak mínimo (boolean), aceitável
--
-- Risco em is_admin_or_above/is_coord_or_above: qualquer authenticated podia
-- chamar `is_admin_or_above(other_user_id)` via PostgREST RPC e descobrir se
-- outro user é admin — info disclosure.
--
-- Estratégia:
--   • Adicionar guard no início da função: só permite checar self OU dev.
--   • Mantém SECURITY DEFINER + assinatura idêntica (uso em RLS continua igual).
--   • Documenta via COMMENT que `can_access_quote` e `org_has_any_members`
--     são intencionalmente expostos (não há leak material).
-- ============================================================================

BEGIN;

-- is_admin_or_above: hardeniza
CREATE OR REPLACE FUNCTION public.is_admin_or_above(_user_id uuid DEFAULT auth.uid())
 RETURNS boolean
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $$
BEGIN
  -- Guard: só o próprio user pode checar seu role, OU caller é dev.
  -- Bloqueia info disclosure cross-user via PostgREST RPC direto.
  IF _user_id IS DISTINCT FROM auth.uid()
     AND NOT public.has_role(auth.uid(), 'dev'::app_role) THEN
    RAISE EXCEPTION 'forbidden: cannot query role of another user'
      USING ERRCODE = '42501';
  END IF;
  RETURN public.is_supervisor_or_above(_user_id);
END;
$$;

-- is_coord_or_above: hardeniza com a mesma lógica
CREATE OR REPLACE FUNCTION public.is_coord_or_above(_user_id uuid DEFAULT auth.uid())
 RETURNS boolean
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $$
BEGIN
  IF _user_id IS DISTINCT FROM auth.uid()
     AND NOT public.has_role(auth.uid(), 'dev'::app_role) THEN
    RAISE EXCEPTION 'forbidden: cannot query role of another user'
      USING ERRCODE = '42501';
  END IF;
  RETURN public.is_supervisor_or_above(_user_id);
END;
$$;

-- Documenta intencionalidade das outras 2 funções flagadas
COMMENT ON FUNCTION public.can_access_quote(uuid) IS
  'RLS-002 audit (2026-05-22): SECURITY DEFINER intencionalmente exposto a authenticated. '
  'Avalia auth.uid() internamente — não vaza info de quotes do usuário; só retorna boolean '
  'sobre quote ao qual o caller já tem acesso via RLS.';

COMMENT ON FUNCTION public.org_has_any_members(uuid) IS
  'RLS-002 audit (2026-05-22): SECURITY DEFINER intencionalmente exposto a authenticated. '
  'Usado no fluxo de criação de organização (boot da primeira org). Retorna apenas boolean — '
  'leak material mínimo. Sem ação adicional necessária.';

COMMENT ON FUNCTION public.check_login_rate_limit(text, text) IS
  'RLS-002 audit (2026-05-22): SECURITY DEFINER intencionalmente exposto a anon. '
  'Necessário para verificar rate limit ANTES de login. Sem ação adicional necessária.';

COMMENT ON FUNCTION public.is_admin_or_above(uuid) IS
  'RLS-002 hardening (2026-05-22): exige _user_id = auth.uid() para usuários comuns. '
  'Dev pode checar qualquer user. Antes: info disclosure cross-user via PostgREST RPC.';

COMMENT ON FUNCTION public.is_coord_or_above(uuid) IS
  'RLS-002 hardening (2026-05-22): exige _user_id = auth.uid() para usuários comuns. '
  'Dev pode checar qualquer user. Antes: info disclosure cross-user via PostgREST RPC.';

COMMIT;
