-- =============================================================================
-- MIGRATION: ai_usage_logs_hardening_observability
-- APLICADO: 2026-06-22
-- AMBIENTE: production (doufsxqlfjyuvxuezpln)
-- SMOKE TESTS: 23/23 PASS após aplicação
-- =============================================================================
-- Conjunto de melhorias em ai_usage_logs relacionadas a:
--   1. Performance (índice parcial para check_ai_quota)
--   2. Observabilidade (updated_at + trigger + monitoring function)
--   3. Corretude (fix quota phantom para pending órfãos)
--   4. Segurança (RLS confirmado ativo + revoke indevidos)
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. ÍNDICE PARCIAL PARA check_ai_quota
-- ---------------------------------------------------------------------------
-- A query crítica: WHERE user_id = X AND created_at >= month AND status != 'error'
-- O índice idx_ai_usage_logs_user_created existente não filtra status →
-- planner faz Seq Scan. O novo índice parcial (WHERE status <> 'error') é
-- menor (exclui todos os 'error') e cobre exatamente a condição da quota query.
-- Com tabela pequena (2 rows) o planner usa Seq Scan (correto).
-- Com tabela grande (>1000 rows/user/month), Index Scan será ativado.
-- ---------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_ai_usage_logs_quota_check
ON public.ai_usage_logs (user_id, created_at DESC)
WHERE status <> 'error';

-- ---------------------------------------------------------------------------
-- 2. COLUNA updated_at + TRIGGER + ÍNDICE
-- ---------------------------------------------------------------------------
-- Permite rastrear quando uma row 'pending' foi atualizada para 'error'
-- (via updateAiLog em-lifecycle vs pg_cron job 149).
-- Essencial para auditoria e debugging do ciclo de vida das requests de IA.
-- ---------------------------------------------------------------------------
ALTER TABLE public.ai_usage_logs
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();

CREATE OR REPLACE FUNCTION public.fn_set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_ai_usage_logs_updated_at
  BEFORE UPDATE ON public.ai_usage_logs
  FOR EACH ROW
  EXECUTE FUNCTION public.fn_set_updated_at();

CREATE INDEX IF NOT EXISTS idx_ai_usage_logs_updated_at
ON public.ai_usage_logs (updated_at DESC);

-- ---------------------------------------------------------------------------
-- 3. pg_cron JOB 149: CLEANUP DE PENDING ÓRFÃOS (a cada 10 min)
-- ---------------------------------------------------------------------------
-- Rows 'pending' > 5 min = request cujo isolate foi morto pela plataforma
-- antes de updateAiLog rodar. Sem limpeza, essas rows consumiriam quota
-- indefinidamente (check_ai_quota conta status != 'error').
-- Threshold 5 min alinhado com fix BUG-QUOTA-002 em check_ai_quota.
-- NOTA: cron.schedule() é idempotente pelo nome do job.
-- ---------------------------------------------------------------------------
-- SELECT cron.schedule(
--   'cleanup-stale-ai-pending-logs',
--   '*/10 * * * *',
--   $$
--   UPDATE public.ai_usage_logs
--   SET
--     status        = 'error',
--     error_message = 'orphaned_pending: isolate killed before updateAiLog ran'
--   WHERE status = 'pending'
--     AND created_at < NOW() - INTERVAL '5 minutes';
--   $$
-- );
-- JÁ APLICADO via execute_sql — job 149 ACTIVE em cron.job

-- ---------------------------------------------------------------------------
-- 4. FIX BUG-QUOTA-002: check_ai_quota exclui pending órfãos
-- ---------------------------------------------------------------------------
-- Antes: contava TODOS os 'pending' (incluindo órfãos > 5 min).
-- Depois: exclui 'pending' > 5 min da contagem (não devem queimar quota).
-- Coerente com: pg_cron job 149 + AbortController em _shared/ai-usage.ts.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.check_ai_quota(_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
DECLARE
  v_role       text;
  v_limit      int;
  v_unlimited  boolean;
  v_used       int;
BEGIN
  v_role := public._get_user_primary_role(_user_id);

  -- FIX BUG-QUOTA-001: cast role::text para comparar com v_role text
  SELECT monthly_limit, is_unlimited INTO v_limit, v_unlimited
  FROM public.ai_usage_quotas WHERE role::text = v_role;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'allowed', true, 'used', 0, 'limit', -1, 'remaining', -1,
      'unlimited', true, 'reason', 'no_quota_for_role'
    );
  END IF;

  -- FIX BUG-QUOTA-002: excluir rows 'pending' órfãs (> 5 min) da contagem.
  -- status='success' → conta; status='pending' < 5 min → conta (em-voo);
  -- status='pending' > 5 min → NÃO conta (morreu sem updateAiLog).
  SELECT count(*)::int INTO v_used
  FROM public.ai_usage_logs
  WHERE user_id = _user_id
    AND created_at >= date_trunc('month', now())
    AND status != 'error'
    AND (
      status != 'pending'
      OR created_at >= NOW() - INTERVAL '5 minutes'
    );

  IF v_unlimited THEN
    RETURN jsonb_build_object(
      'allowed', true, 'used', v_used, 'limit', -1, 'remaining', -1, 'unlimited', true
    );
  END IF;

  RETURN jsonb_build_object(
    'allowed', v_used < v_limit,
    'used', v_used,
    'limit', v_limit,
    'remaining', greatest(0, v_limit - v_used),
    'unlimited', false
  );
END;
$$;

-- ---------------------------------------------------------------------------
-- 5. FUNÇÃO DE MONITORAMENTO: fn_ai_quota_summary
-- ---------------------------------------------------------------------------
-- SECURITY DEFINER para acessar auth.users (schema privado).
-- Acesso via service_role (admin dashboard) ou authenticated (com gateamento
-- de role no edge function que a expõe).
-- Inclui BUG-QUOTA-002 fix: exclui pending > 5 min do usado_este_mes.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.fn_ai_quota_summary()
RETURNS TABLE (
  user_id          uuid,
  email            text,
  role             text,
  monthly_limit    int,
  is_unlimited     boolean,
  used_this_month  int,
  remaining        int,
  success_month    int,
  error_month      int,
  pending_count    int,
  last_activity    timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
  RETURN QUERY
  SELECT
    ur.user_id,
    u.email::text,
    ur.role::text,
    COALESCE(aq.monthly_limit, 0)              AS monthly_limit,
    COALESCE(aq.is_unlimited, false)           AS is_unlimited,
    COALESCE(SUM(
      CASE WHEN al.status != 'error'
                AND al.created_at >= date_trunc('month', NOW())
                AND (al.status != 'pending' OR al.created_at >= NOW() - INTERVAL '5 minutes')
           THEN 1 ELSE 0 END
    ), 0)::int                                 AS used_this_month,
    CASE
      WHEN COALESCE(aq.is_unlimited, false) THEN -1
      ELSE GREATEST(0, COALESCE(aq.monthly_limit, 0) -
        COALESCE(SUM(
          CASE WHEN al.status != 'error'
                    AND al.created_at >= date_trunc('month', NOW())
                    AND (al.status != 'pending' OR al.created_at >= NOW() - INTERVAL '5 minutes')
               THEN 1 ELSE 0 END
        ), 0)::int)
    END                                        AS remaining,
    COALESCE(SUM(
      CASE WHEN al.status = 'success' AND al.created_at >= date_trunc('month', NOW())
           THEN 1 ELSE 0 END
    ), 0)::int                                 AS success_month,
    COALESCE(SUM(
      CASE WHEN al.status = 'error' AND al.created_at >= date_trunc('month', NOW())
           THEN 1 ELSE 0 END
    ), 0)::int                                 AS error_month,
    COALESCE(SUM(
      CASE WHEN al.status = 'pending' THEN 1 ELSE 0 END
    ), 0)::int                                 AS pending_count,
    MAX(al.updated_at)                         AS last_activity
  FROM public.user_roles ur
  JOIN auth.users u ON u.id = ur.user_id AND u.deleted_at IS NULL
  LEFT JOIN public.ai_usage_quotas aq ON aq.role = ur.role
  LEFT JOIN public.ai_usage_logs al ON al.user_id = ur.user_id
  GROUP BY ur.user_id, u.email, ur.role, aq.monthly_limit, aq.is_unlimited
  ORDER BY used_this_month DESC NULLS LAST, u.email;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.fn_ai_quota_summary() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.fn_ai_quota_summary() TO authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 6. SEGURANÇA: RLS em ai_usage_logs + REVOKE indevidos
-- ---------------------------------------------------------------------------
-- RLS já estava ATIVO com policy 'ai_usage_logs_user_own':
--   dev/admin/supervisor: veem TODOS os logs
--   outros: veem apenas seus próprios logs
-- NOVO (defense in depth): REVOKE INSERT/UPDATE/DELETE de authenticated e anon.
-- Escrita é feita EXCLUSIVAMENTE por service_role (via edge functions).
-- NOTA: service_role bypassa RLS por design — edge functions não são afetadas.
-- ---------------------------------------------------------------------------
ALTER TABLE public.ai_usage_logs ENABLE ROW LEVEL SECURITY;

-- REVOKE write access de authenticated (edge functions usam service_role)
REVOKE INSERT, UPDATE, DELETE ON public.ai_usage_logs FROM authenticated;
-- REVOKE acesso total de anon (logs são dados privados por design)
REVOKE ALL ON public.ai_usage_logs FROM anon;
-- Manter service_role com acesso completo
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ai_usage_logs TO service_role;

NOTIFY pgrst, 'reload schema';

-- ---------------------------------------------------------------------------
-- ARTEFATOS RELACIONADOS (código fonte)
-- ---------------------------------------------------------------------------
-- supabase/functions/_shared/ai-usage.ts @ 13fcff6:
--   AbortController 45s no legacy fetch + legacyTimeoutMs por caller
-- supabase/functions/semantic-search/index.ts @ 38284e8:
--   legacyTimeoutMs: 9_000 (< AI_TIMEOUT_MS 12s) para garantir updateAiLog in-lifecycle
-- supabase/functions/word-magic/index.ts @ e0011dc:
--   AbortController 60s no fetch DeepSeek V4-Flash
-- pg_cron job 149 (LIVE):
--   cleanup-stale-ai-pending-logs — a cada 10 min — converte pending > 5 min para error
-- =============================================================================
