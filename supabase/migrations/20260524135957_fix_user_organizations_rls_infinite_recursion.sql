-- ============================================================================
-- FIX: infinite recursion in policy for relation "user_organizations"
-- ============================================================================
-- Causa: a policy uo_select_members faz EXISTS SELECT em user_organizations
-- DENTRO da própria policy de user_organizations, criando loop infinito.
-- Mesma situação para as funções helper que faziam SELECT em
-- user_organizations sem SECURITY DEFINER.
--
-- Sintoma: GET /rest/v1/quotes retornava 500 (e qualquer query que use
-- user_is_org_member ou is_org_owner_or_admin acabava recursando).
--
-- Solução:
-- 1) Tornar as funções helper SECURITY DEFINER (bypass RLS apenas para
--    a checagem de membership — funções continuam STABLE e read-only).
-- 2) Reescrever a policy uo_select_members usando user_is_org_member,
--    evitando subquery direta na própria tabela.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1) SECURITY DEFINER nas funções helper que tocam user_organizations
-- ----------------------------------------------------------------------------
-- Essas funções já têm:
--   - LANGUAGE sql / plpgsql (não dinâmico)
--   - STABLE (sem efeitos colaterais)
--   - SET search_path TO 'public' (proteção contra path injection)
--   - Apenas SELECT (read-only)
-- Logo, SECURITY DEFINER é seguro aqui e resolve o loop de RLS.

ALTER FUNCTION public.user_is_org_member(uuid) SECURITY DEFINER;
ALTER FUNCTION public.is_org_owner_or_admin(uuid) SECURITY DEFINER;
ALTER FUNCTION public.is_org_member(uuid, uuid) SECURITY DEFINER;

-- ----------------------------------------------------------------------------
-- 2) Reescrever a policy uo_select_members removendo a auto-referência
-- ----------------------------------------------------------------------------
-- A policy antiga fazia:
--   EXISTS (SELECT 1 FROM user_organizations uo2 WHERE ...)
-- Isso disparava RLS recursivo. Agora usamos user_is_org_member que,
-- com SECURITY DEFINER, faz a checagem sem disparar RLS.

DROP POLICY IF EXISTS uo_select_members ON public.user_organizations;

CREATE POLICY uo_select_members ON public.user_organizations
  FOR SELECT
  USING (public.user_is_org_member(organization_id));

-- ----------------------------------------------------------------------------
-- 3) Comentários para auditoria futura
-- ----------------------------------------------------------------------------
COMMENT ON FUNCTION public.user_is_org_member(uuid) IS
  'SECURITY DEFINER necessário para evitar recursão de RLS quando '
  'usada em policies de user_organizations. Read-only, STABLE, '
  'search_path fixo. Continua usando auth.uid() do JWT do request.';

COMMENT ON FUNCTION public.is_org_owner_or_admin(uuid) IS
  'SECURITY DEFINER necessário para evitar recursão de RLS quando '
  'usada em policies de user_organizations. Read-only, STABLE.';

COMMENT ON FUNCTION public.is_org_member(uuid, uuid) IS
  'SECURITY DEFINER por consistência com user_is_org_member. '
  'Read-only, STABLE.';
