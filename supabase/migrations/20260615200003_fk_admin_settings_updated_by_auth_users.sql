-- ============================================================
-- MIGRATION: fk_admin_settings_updated_by_auth_users
-- Objetivo : Adicionar FK updated_by → auth.users(id) ON DELETE SET NULL
-- Data     : 2026-06-15
-- Branch   : chore/admin-settings-hardening
-- Melhoria : #3 de 4 — Integridade referencial do campo updated_by
--
-- CONTEXTO:
--   admin_settings.updated_by é uuid nullable sem FK.
--   Qualquer UUID (mesmo inválido) pode ser gravado, sem validação.
--   Ao adicionar FK: banco garante que updated_by referencia um
--   usuário real em auth.users.
--
-- ON DELETE SET NULL:
--   Se o usuário admin for deletado do sistema, updated_by vira NULL
--   automaticamente — a linha de configuração sobrevive intacta.
--   Sem ON DELETE SET NULL, a deleção do usuário falharia por FK
--   violação (comportamento indesejável para um campo de auditoria).
--
-- PRÉ-CONDIÇÕES VERIFICADAS:
--   rows_in_table = 0  (sem risco de violação retroativa)
--   auth.users existe (schema auth, relname users)
--   Nenhuma FK existente com este nome
--
-- IMPACTO:
--   Frontend: 0 — hooks não setam updated_by (campo fica NULL)
--   Backend : 0 — nenhuma função grafa nesta coluna
--   Futuro  : se alguém setar updated_by, precisa ser UUID válido
--
-- REVERSÃO (se necessário):
--   ALTER TABLE public.admin_settings DROP CONSTRAINT fk_admin_settings_updated_by;
-- ============================================================

ALTER TABLE public.admin_settings
    ADD CONSTRAINT fk_admin_settings_updated_by
    FOREIGN KEY (updated_by)
    REFERENCES auth.users(id)
    ON DELETE SET NULL;
