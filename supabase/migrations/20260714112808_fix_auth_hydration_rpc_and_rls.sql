-- ============================================================
-- MIGRATION: fix_auth_hydration_rpc_and_rls
-- Data: 2026-07-14
-- Autor: ti@promobrindes.com.br (BUG-AUTH-HYDRATION-v2)
--
-- Resolve hydration_timeout:profile+roles:5000ms
-- Causa raiz: 2 round-trips separados (profiles + user_roles) onde
-- qualquer latência de rede ou cold start consumia todo o budget de 5s.
-- Além disso, a policy profiles_select comparava auth.uid() com id
-- (gen_random_uuid()) em vez de user_id (FK para auth.users).
-- ============================================================

-- 1. RPC combinada: perfil + roles em um único round-trip
--    Antes: Promise.all([SELECT profiles, SELECT user_roles]) = 2 round-trips
--    Depois: rpc('get_profile_and_roles') = 1 round-trip → ~50% menos latência
CREATE OR REPLACE FUNCTION public.get_profile_and_roles(_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
DECLARE
  v_profile jsonb;
  v_roles   jsonb;
BEGIN
  -- Guard: só o próprio usuário (ou dev impersonando) pode buscar
  IF _user_id IS DISTINCT FROM auth.uid()
     AND NOT public.has_role(auth.uid(), 'dev'::app_role)
  THEN
    RAISE EXCEPTION 'forbidden: cannot query profile of another user'
      USING ERRCODE = '42501';
  END IF;

  -- Busca profile pela coluna correta (user_id, não id/gen_random_uuid())
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

-- Permissões: anon não acessa; authenticated pode invocar
REVOKE ALL ON FUNCTION public.get_profile_and_roles(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.get_profile_and_roles(uuid) TO authenticated;

-- 2. Corrige RLS profiles_select: user_id em vez de id
--    Bug: auth.uid() = id → SEMPRE falso para usuários não-admin
--         pois id é gen_random_uuid(), não auth.uid()
--    Fix: auth.uid() = user_id (FK correta para auth.users)
DROP POLICY IF EXISTS "profiles_select" ON public.profiles;
CREATE POLICY "profiles_select"
  ON public.profiles
  FOR SELECT
  TO authenticated
  USING (
    (( SELECT auth.uid() AS uid) = user_id)
    OR is_admin_or_above(( SELECT auth.uid() AS uid))
  );

-- 3. Corrige RLS profiles_update com a mesma inconsistência
DROP POLICY IF EXISTS "profiles_update" ON public.profiles;
CREATE POLICY "profiles_update"
  ON public.profiles
  FOR UPDATE
  TO public
  USING      ((( SELECT auth.uid() AS uid) = user_id))
  WITH CHECK ((( SELECT auth.uid() AS uid) = user_id));
