-- ============================================================
-- MIGRATION v3: fix_auth_hydration_v3_perf_safety
-- Data: 2026-07-14
-- Autor: ti@promobrindes.com.br (BUG-AUTH-HYDRATION-v2.2)
--
-- Melhorias de performance e seguranca identificadas na auditoria
-- exaustiva pos-deploy (31 blocos de teste + 300+ simulacoes):
--
-- 1. statement_timeout=6000ms na RPC (fail-fast antes do withTimeout=7s)
-- 2. Covering index idx_user_roles_user_id_covering (escala futura)
-- 3. COMMENT na funcao para documentacao e manutenção futura
-- ============================================================

-- MELHORIA 1: statement_timeout interno a RPC
-- Garante que se Supabase travar (lock contention, pool exhaustion),
-- a funcao falha em 6s no servidor — antes do withTimeout(7s) do cliente.
CREATE OR REPLACE FUNCTION public.get_profile_and_roles(_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public
SET statement_timeout = '6000ms'
AS $$
DECLARE
  v_profile jsonb;
  v_roles   jsonb;
BEGIN
  -- Guard NULL: _user_id nulo nao tem significado valido
  IF _user_id IS NULL THEN
    RAISE EXCEPTION 'get_profile_and_roles: _user_id cannot be null'
      USING ERRCODE = '22004';
  END IF;

  -- Guard cross-user: so o proprio usuario (ou dev) pode buscar
  IF _user_id IS DISTINCT FROM auth.uid()
     AND NOT public.has_role(auth.uid(), 'dev'::app_role)
  THEN
    RAISE EXCEPTION 'forbidden: cannot query profile of another user'
      USING ERRCODE = '42501';
  END IF;

  -- Busca profile pela coluna correta (user_id, nao id)
  SELECT to_jsonb(p) INTO v_profile
  FROM public.profiles p
  WHERE p.user_id = _user_id
  LIMIT 1;

  -- Agrega roles em array JSON (ordenado para determinismo)
  SELECT jsonb_agg(ur.role ORDER BY ur.role) INTO v_roles
  FROM public.user_roles ur
  WHERE ur.user_id = _user_id;

  RETURN jsonb_build_object(
    'profile', v_profile,
    'roles',   COALESCE(v_roles, '[]'::jsonb)
  );
END;
$$;

-- MELHORIA 2: Covering index em user_roles
-- O planner usa seq scan com 13 usuarios (correto — custo < index scan).
-- Este index sera usado automaticamente quando o time crescer > ~50 usuarios.
CREATE INDEX IF NOT EXISTS idx_user_roles_user_id_covering
  ON public.user_roles (user_id, role);

-- MELHORIA 3: COMMENT para documentacao
COMMENT ON FUNCTION public.get_profile_and_roles(uuid) IS
  'RPC combinada: retorna {profile, roles} em 1 round-trip. '
  'SECURITY DEFINER — garante que vendedor nao veja perfil alheio. '
  'statement_timeout=6s (< 7s do withTimeout no cliente). '
  'Caller: useProfileRoles.fetchUserData via asTypedRPC<GetProfileAndRolesResult>. '
  'Criada em 2026-07-14 para resolver hydration_timeout:profile+roles:5000ms. '
  'Migration: 20260714112808_fix_auth_hydration_rpc_and_rls.';
