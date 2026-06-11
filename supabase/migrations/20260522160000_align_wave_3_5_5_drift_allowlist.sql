-- ============================================================================
-- Migration: align_wave_3_5_5_drift_allowlist
-- Date: 2026-05-22 16:00 UTC
-- Phase: Redeploy Fase 3.5 - Wave 5 (Allowlist auditável)
-- Applied via: MCP Supabase (Gestão de Produtos) - Decision 010
-- ============================================================================
-- Objetivo: criar tabela schema_drift_allowlist para registrar divergências
-- ACEITÁVEIS por design entre Lovable e Oficial, e atualizar a função do Gate
-- CI (fn_compute_and_record_drift) para considerar a allowlist.
--
-- 15 tabelas na allowlist final:
--   - bot_detection_log     (infra independente, schemas diferentes por design)
--   - products              (cache denormalizado do catálogo SSOT no Lovable)
--   - 7x admin_audit_log_y*  (partições mensais só no Lovable)
--   - 2x webhook_delivery_metrics_y*  (idem)
--   - simulation_logs/runs  (telemetria interna do Lovable Cloud)
--   - e2e_cleanup_audit     (testes Lovable)
--   - v_full_scope_grants   (view Lovable)
-- ============================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS public.schema_drift_allowlist (
  table_name    text PRIMARY KEY,
  reason        text NOT NULL,
  added_by      text NOT NULL,
  added_at      timestamp with time zone NOT NULL DEFAULT now(),
  metadata      jsonb DEFAULT '{}'::jsonb
);

ALTER TABLE public.schema_drift_allowlist ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins manage drift allowlist" ON public.schema_drift_allowlist;

CREATE POLICY "Admins manage drift allowlist"
  ON public.schema_drift_allowlist
  FOR ALL TO authenticated
  USING      (EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin'));

COMMENT ON TABLE public.schema_drift_allowlist IS
  'Tabelas onde divergência de schema entre Lovable interno (pqpdolkaeqlyzpdpbizo) e Oficial (pqpdolkaeqlyzpdpbizo) é aceitável por design (cache, infra, particionamento).';

-- Atualizar fn_compute_and_record_drift para considerar allowlist
CREATE OR REPLACE FUNCTION public.fn_compute_and_record_drift(p_lovable_signatures jsonb)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_oficial_sigs  jsonb;
  v_only_oficial  text[];
  v_only_lovable  text[];
  v_diff          jsonb := '{}'::jsonb;
  v_has_drift     boolean;
  v_tab_oficial   int;
  v_tab_lovable   int;
  v_log_payload   jsonb;
  v_allowed       text[];
BEGIN
  SELECT array_agg(table_name) INTO v_allowed FROM public.schema_drift_allowlist;
  v_allowed := COALESCE(v_allowed, ARRAY[]::text[]);

  v_oficial_sigs := public.get_public_schema_signatures();

  SELECT array_agg(k ORDER BY k) INTO v_only_oficial
    FROM jsonb_object_keys(v_oficial_sigs) k
   WHERE NOT (p_lovable_signatures ? k) AND k != ALL(v_allowed);

  SELECT array_agg(k ORDER BY k) INTO v_only_lovable
    FROM jsonb_object_keys(p_lovable_signatures) k
   WHERE NOT (v_oficial_sigs ? k) AND k != ALL(v_allowed);

  SELECT jsonb_object_agg(k, jsonb_build_object('oficial', v_oficial_sigs -> k,
                                                'lovable', p_lovable_signatures -> k))
    INTO v_diff
    FROM jsonb_object_keys(v_oficial_sigs) k
   WHERE p_lovable_signatures ? k
     AND (v_oficial_sigs -> k) <> (p_lovable_signatures -> k)
     AND k != ALL(v_allowed);

  v_diff := COALESCE(v_diff, '{}'::jsonb);
  v_tab_oficial := (SELECT COUNT(*) FROM jsonb_object_keys(v_oficial_sigs));
  v_tab_lovable := (SELECT COUNT(*) FROM jsonb_object_keys(p_lovable_signatures));

  v_has_drift := (COALESCE(array_length(v_only_oficial, 1), 0) > 0
                  OR COALESCE(array_length(v_only_lovable, 1), 0) > 0
                  OR (SELECT COUNT(*) FROM jsonb_object_keys(v_diff)) > 0);

  v_log_payload := jsonb_build_object(
    'has_drift', v_has_drift,
    'tables_oficial', v_tab_oficial,
    'tables_lovable', v_tab_lovable,
    'only_oficial',   COALESCE(to_jsonb(v_only_oficial), '[]'::jsonb),
    'only_lovable',   COALESCE(to_jsonb(v_only_lovable), '[]'::jsonb),
    'schema_diff',    v_diff,
    'allowlist_applied', to_jsonb(v_allowed)
  );

  RETURN public.record_schema_drift_result(v_log_payload);
END;
$$;

-- Popular allowlist com as 15 tabelas (script de seed)
INSERT INTO public.schema_drift_allowlist (table_name, reason, added_by, metadata) VALUES
  ('bot_detection_log',     'Implementação independente no Lovable Cloud (infra interna).',                                          'wave_3_5_5', '{"category":"infra_independente"}'::jsonb),
  ('products',              'Cache denormalizado do catálogo SSOT (synced_at, external_id, ARRAY em vez de jsonb). Não alinhar.',     'wave_3_5_5', '{"category":"cache_denormalizado"}'::jsonb),
  ('admin_audit_log_y2025m12','Partição mensal de admin_audit_log',                                                                  'wave_3_5_5', '{"category":"particao_log","parent":"admin_audit_log"}'::jsonb),
  ('admin_audit_log_y2026m01','Partição mensal',                                                                                      'wave_3_5_5', '{"category":"particao_log"}'::jsonb),
  ('admin_audit_log_y2026m02','Partição mensal',                                                                                      'wave_3_5_5', '{"category":"particao_log"}'::jsonb),
  ('admin_audit_log_y2026m03','Partição mensal',                                                                                      'wave_3_5_5', '{"category":"particao_log"}'::jsonb),
  ('admin_audit_log_y2026m04','Partição mensal',                                                                                      'wave_3_5_5', '{"category":"particao_log"}'::jsonb),
  ('admin_audit_log_y2026m05','Partição mensal',                                                                                      'wave_3_5_5', '{"category":"particao_log"}'::jsonb),
  ('admin_audit_log_y2026m06','Partição mensal',                                                                                      'wave_3_5_5', '{"category":"particao_log"}'::jsonb),
  ('webhook_delivery_metrics_y2026m05','Partição mensal',                                                                             'wave_3_5_5', '{"category":"particao_log"}'::jsonb),
  ('webhook_delivery_metrics_y2026m06','Partição mensal',                                                                             'wave_3_5_5', '{"category":"particao_log"}'::jsonb),
  ('simulation_logs',       'Telemetria interna do Lovable Cloud',                                                                    'wave_3_5_5', '{"category":"infra_lovable"}'::jsonb),
  ('simulation_runs',       'Telemetria interna do Lovable Cloud',                                                                    'wave_3_5_5', '{"category":"infra_lovable"}'::jsonb),
  ('e2e_cleanup_audit',     'Audit de testes E2E no Lovable Cloud',                                                                   'wave_3_5_5', '{"category":"infra_lovable"}'::jsonb),
  ('v_full_scope_grants',   'View específica do Lovable Cloud',                                                                       'wave_3_5_5', '{"category":"infra_lovable"}'::jsonb)
ON CONFLICT (table_name) DO UPDATE
  SET reason = EXCLUDED.reason, added_at = now(), metadata = EXCLUDED.metadata;

COMMIT;

-- Pós-validação (resultado real em prod):
--   tables_oficial=390, tables_lovable=145
--   only_oficial=261 (catálogo SSOT - esperado)
--   only_lovable=3 (admin_audit_log_old, favorites, mcp_keys - pendência Fase 1.1)
--   schema_drift=0 ✓
