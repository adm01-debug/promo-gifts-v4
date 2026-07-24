-- ================================================================
-- ROLLOUT GRADUAL DO KILL-SWITCH (A/B controlado)
-- 
-- Permite desligar o switch progressivamente: 5% → 25% → 50% → 100%
-- usando hash determinístico do user_id/session_id como bucket.
-- 
-- Estratégia:
--   1. Coluna rollout_percentage em system_kill_switches (0-100)
--   2. Função fn_should_apply_kill_switch(switch_name, bucket_key) → boolean
--      Retorna TRUE se a chave cai dentro do bucket de rollout (kill aplicado)
--   3. View v_kill_switch_with_rollout para o front consultar
-- ===============================================================

-- 1) Adicionar coluna de rollout
ALTER TABLE public.system_kill_switches
  ADD COLUMN IF NOT EXISTS rollout_percentage smallint NOT NULL DEFAULT 100
    CHECK (rollout_percentage BETWEEN 0 AND 100);

COMMENT ON COLUMN public.system_kill_switches.rollout_percentage IS
'Porcentagem de tráfego (0-100) que recebe o kill-switch quando enabled=false.
100 = todos os clientes (default). 5 = apenas 5% (canary).
Útil para A/B testing antes de desligar definitivamente.';

-- 2) Função pura de roteamento — determinística por hash do bucket_key
CREATE OR REPLACE FUNCTION public.fn_should_apply_kill_switch(
  p_switch_name text,
  p_bucket_key text
) RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
SET search_path = public, pg_catalog
AS $$
DECLARE
  v_enabled boolean;
  v_rollout smallint;
  v_bucket int;
BEGIN
  -- Lê estado do switch (RLS aplicável: anon tem SELECT)
  SELECT enabled, rollout_percentage 
    INTO v_enabled, v_rollout
  FROM public.system_kill_switches
  WHERE switch_name = p_switch_name;
  
  -- Switch não cadastrado = não aplicar (fail-open)
  IF NOT FOUND THEN RETURN false; END IF;
  
  -- Switch ATIVO (enabled=true) = nunca aplicar kill, independente de rollout
  IF v_enabled THEN RETURN false; END IF;
  
  -- Switch OFF (enabled=false): aplicar kill conforme rollout %
  IF v_rollout >= 100 THEN RETURN true; END IF;
  IF v_rollout <= 0 THEN RETURN false; END IF;
  
  -- Hash determinístico → bucket 0-99
  -- Mesmo bucket_key sempre cai no mesmo bucket (estabilidade entre reloads)
  v_bucket := abs(hashtext(coalesce(p_bucket_key, 'anonymous')) % 100);
  RETURN v_bucket < v_rollout;
END;
$$;

COMMENT ON FUNCTION public.fn_should_apply_kill_switch IS
'Decide se o kill-switch deve ser APLICADO (= bloquear chamada) para um bucket.
Determinístico por bucket_key (mesma chave sempre cai no mesmo grupo).
Lógica:
  enabled=true                  → false (nunca bloqueia)
  enabled=false, rollout=100    → true  (sempre bloqueia)
  enabled=false, rollout=0      → false (nunca bloqueia — pré-rollout)
  enabled=false, rollout=X%     → true se hashtext(bucket_key) % 100 < X
Bucket_key sugerido: auth.uid() para logged-in; localStorage uuid para anon.';

GRANT EXECUTE ON FUNCTION public.fn_should_apply_kill_switch TO anon;
GRANT EXECUTE ON FUNCTION public.fn_should_apply_kill_switch TO authenticated;

-- 3) Validar: switch atual está enabled=true, então sempre retorna false
SELECT 
  public.fn_should_apply_kill_switch('edge_external_db_bridge', 'test-user-1') AS rollout_test_1,
  public.fn_should_apply_kill_switch('edge_external_db_bridge', 'test-user-2') AS rollout_test_2,
  public.fn_should_apply_kill_switch('non_existent_switch', 'anyone') AS unknown_switch;
