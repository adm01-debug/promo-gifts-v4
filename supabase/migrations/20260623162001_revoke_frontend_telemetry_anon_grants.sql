-- APLICADO: SIM — 2026-06-23 (sessão PhD DB validation)
-- Migration: revoke_frontend_telemetry_authenticated_grants
-- Resultado: DELETE, UPDATE, REFERENCES, TRIGGER revogados de authenticated
-- Assertivas: 6/6 PASS | zero breaking changes no frontend
-- Smoke tests: 30/30 PASS após aplicação
--
-- CONTEXTO:
-- Auditoria de segurança identificou que 'authenticated' possuía
-- DELETE, UPDATE, REFERENCES e TRIGGER em frontend_telemetry.
-- Desnecessários: frontend só precisa de INSERT (registrar eventos)
-- e SELECT restrito por RLS (consulta própria).
-- anon estava limpo (apenas INSERT) — sem ação necessária.
--
-- IMPACTO: ZERO downtime. Sem breaking changes no frontend.

REVOKE DELETE     ON public.frontend_telemetry FROM authenticated;
REVOKE UPDATE     ON public.frontend_telemetry FROM authenticated;
REVOKE REFERENCES ON public.frontend_telemetry FROM authenticated;
REVOKE TRIGGER    ON public.frontend_telemetry FROM authenticated;

-- Garantir que INSERT e SELECT continuam (necessários)
GRANT INSERT ON public.frontend_telemetry TO authenticated;
GRANT SELECT ON public.frontend_telemetry TO authenticated;

NOTIFY pgrst, 'reload schema';
