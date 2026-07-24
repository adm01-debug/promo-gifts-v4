-- APLICADO: 2026-06-23 17:19 UTC
-- Migration: fix_anon_grants_security_hardening_20260623
-- Autor: Claude — PhD Database Security Mode
-- Objetivo: Revogar grants desnecessários/perigosos do role 'anon'
--
-- BUGS CORRIGIDOS:
--   BUG-TELEMETRY-GRANT: anon tinha DELETE/UPDATE/TRIGGER/REFERENCES em frontend_telemetry
--   BUG-PDR-GRANT:       anon tinha ALL PRIVILEGES em product_deactivation_requests
--   BUG-SRE-GRANT:       anon tinha ALL PRIVILEGES em supplier_replenishment_events
--   BUG-WN-GRANT:        anon tinha SELECT desnecessário em workspace_notifications
--   BUG-VIEWS-ANON:      v_monthly_costs, v_my_markup_config, v_quote_seller_kpis
--                        e outras views internas expostas para anon
--
-- IMPACTO: ZERO para o frontend público
--   - RLS já bloqueava operações (0 rows), mas grants sinalizavam intenção errada
--   - Reduz superfície de ataque e informação de schema para atacantes
--   - anon mantém INSERT em frontend_telemetry (necessário para log de eventos públicos)

-- 1. frontend_telemetry: manter apenas INSERT
REVOKE DELETE, UPDATE, TRIGGER, REFERENCES ON public.frontend_telemetry FROM anon;

-- 2. product_deactivation_requests: revogar tudo de anon
REVOKE ALL PRIVILEGES ON public.product_deactivation_requests FROM anon;

-- 3. supplier_replenishment_events: revogar tudo de anon
REVOKE ALL PRIVILEGES ON public.supplier_replenishment_events FROM anon;

-- 4. workspace_notifications: revogar SELECT de anon
REVOKE SELECT ON public.workspace_notifications FROM anon;

-- 5. Views sensíveis: revogar SELECT de anon
REVOKE SELECT ON public.v_monthly_costs FROM anon;
REVOKE SELECT ON public.v_my_markup_config FROM anon;
REVOKE SELECT ON public.v_quote_seller_kpis FROM anon;
REVOKE SELECT ON public.v_db_health_audit FROM anon;
REVOKE SELECT ON public.v_kill_switch_hits_summary FROM anon;
REVOKE SELECT ON public.v_needs_enrichment FROM anon;
REVOKE SELECT ON public.vw_supplier_products_raw_errors FROM anon;
REVOKE SELECT ON public.vw_classify_functions_status FROM anon;

-- 6. Reload PostgREST schema
NOTIFY pgrst, 'reload schema';
