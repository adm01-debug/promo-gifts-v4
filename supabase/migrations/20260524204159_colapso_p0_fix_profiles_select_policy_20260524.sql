-- =============================================================
-- P0.3 — Corrigir policy profiles_select
-- Problema: policy `profiles_select` chama is_admin_or_above((SELECT auth.uid()))
-- mas anon NÃO TEM EXECUTE em is_admin_or_above → SELECT anônimo falha com
-- "permission denied for function is_admin_or_above" (confirmado pelo smoke test).
-- Correção: restringir policy a authenticated apenas (anon não tem nada a fazer
-- em profiles), aproveitando para nivelar a regra a só usuários logados.
-- =============================================================
DROP POLICY IF EXISTS "profiles_select" ON public.profiles;

CREATE POLICY "profiles_select"
  ON public.profiles
  FOR SELECT
  TO authenticated
  USING (
    ((SELECT auth.uid()) = id)
    OR public.is_admin_or_above((SELECT auth.uid()))
  );
