-- =============================================================
-- MIGRATION: fix_discount_approval_audit_percent_checks
-- Data: 2026-06-26
-- GAP IDENTIFICADO em validação exaustiva pós-correção principal:
--
-- discount_approval_audit NÃO tinha CHECK constraints de range
-- nos campos de percentual, enquanto a tabela-origem
-- discount_approval_requests já as possui.
--
-- IMPACTO: valores negativos e > 100% eram aceitos na tabela
-- de audit, criando inconsistência com os dados de origem.
--
-- FIX: Adicionar 3 CHECKs (IS NULL OR [0,100]) nos campos:
--   - requested_discount_percent
--   - max_allowed_percent
--   - real_discount_percent
--
-- Compatibilidade: IS NULL → seguro para campos nullable.
-- Dados existentes verificados: 0 rows violam o constraint.
--
-- ANTI-REGRESSION: fix_version dar_audit_percent_checks_v1
-- =============================================================

ALTER TABLE public.discount_approval_audit
  ADD CONSTRAINT daa_requested_percent_range
    CHECK (requested_discount_percent IS NULL OR
           (requested_discount_percent >= 0 AND requested_discount_percent <= 100)),
  ADD CONSTRAINT daa_max_allowed_percent_range
    CHECK (max_allowed_percent IS NULL OR
           (max_allowed_percent >= 0 AND max_allowed_percent <= 100)),
  ADD CONSTRAINT daa_real_discount_percent_range
    CHECK (real_discount_percent IS NULL OR
           (real_discount_percent >= 0 AND real_discount_percent <= 100));

NOTIFY pgrst, 'reload schema';
