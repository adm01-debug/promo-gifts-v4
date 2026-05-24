-- Migration: P0.3 — Corrigir policy profiles_select que quebrava queries anônimas
-- Contexto: a policy `profiles_select` estava em PUBLIC ({-}) e chamava
-- `public.is_admin_or_above(...)`, mas `anon` NÃO TEM EXECUTE nessa função.
-- Resultado: smoke test `rls_profiles_no_recursion` falhava com
-- "permission denied for function is_admin_or_above" em qualquer GET anônimo
-- na tabela profiles.
-- Fix: restringir policy a `authenticated` (anon não tem nada a fazer aqui).
-- Aplicada em produção em 2026-05-24.

DROP POLICY IF EXISTS "profiles_select" ON public.profiles;

CREATE POLICY "profiles_select"
  ON public.profiles
  FOR SELECT
  TO authenticated
  USING (
    ((SELECT auth.uid()) = id)
    OR public.is_admin_or_above((SELECT auth.uid()))
  );
