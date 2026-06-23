-- APLICADO: PENDENTE
-- Migration: revoke_frontend_telemetry_anon_grants
-- Data: 2026-06-23
-- Autor: Claude (PhD DB validation session)
--
-- CONTEXTO:
-- Auditoria de segurança identificou que as roles 'anon' e 'authenticated'
-- possuem grants de DELETE e UPDATE na tabela frontend_telemetry.
-- Esses grants são desnecessários e representam risco de segurança:
--   - anon DELETE: permite que qualquer visitante delete logs de telemetria
--   - anon UPDATE: permite que qualquer visitante modifique logs de telemetria
-- O correto: anon e authenticated só precisam de INSERT (registrar eventos)
-- e SELECT restrito por RLS (se necessário para o próprio usuário).
--
-- REFERÊNCIA: userMemories — 'frontend_telemetry anon DELETE/UPDATE grants
-- should be revoked' (pendente desde sessão anterior)
--
-- IMPACTO: ZERO downtime. Sem breaking changes no frontend
-- (frontend só faz INSERT em frontend_telemetry, não DELETE/UPDATE)

-- ============================================================
-- 1. Revogar grants desnecessários de DELETE e UPDATE
-- ============================================================
REVOKE DELETE ON public.frontend_telemetry FROM anon;
REVOKE DELETE ON public.frontend_telemetry FROM authenticated;
REVOKE UPDATE ON public.frontend_telemetry FROM anon;
REVOKE UPDATE ON public.frontend_telemetry FROM authenticated;

-- ============================================================
-- 2. Confirmar que INSERT permanece (necessário para telemetria)
-- ============================================================
-- Estes GRANT são idempotentes — já existem, apenas confirmando:
GRANT INSERT ON public.frontend_telemetry TO anon;
GRANT INSERT ON public.frontend_telemetry TO authenticated;

-- ============================================================
-- 3. Verificação pós-aplicação (rodar manualmente)
-- ============================================================
-- SELECT grantee, privilege_type
-- FROM information_schema.role_table_grants
-- WHERE table_name = 'frontend_telemetry'
--   AND table_schema = 'public'
--   AND grantee IN ('anon', 'authenticated')
-- ORDER BY grantee, privilege_type;
-- Esperado: apenas INSERT (sem DELETE, UPDATE para anon/authenticated)
