-- ============================================================
-- MIGRATION: fix_admin_settings_check_key_not_empty
-- Objetivo : Adicionar CHECK CONSTRAINT que impede key vazia ou
--            com apenas espaços em branco.
-- Data     : 2026-06-15
-- Branch   : chore/admin-settings-hardening
-- Origem   : Gap detectado em bateria de testes exaustiva (7.01/7.06)
--
-- PROBLEMA:
--   Coluna key é text NOT NULL mas sem CHECK CONSTRAINT.
--   key = '' ou key = '   ' seriam aceitas pelo banco.
--   Um hook que gravasse key='' criaria uma linha inacessível
--   pelos hooks reais (que usam key nomeado como 'retest_cooldown').
--
-- SOLUÇÃO:
--   CHECK (trim(key) <> '') — bloqueia vazio, só-espaços e NULL
--   (NULL já é bloqueado pelo NOT NULL, mas o CHECK é defensivo)
--
-- IMPACTO:
--   Frontend: 0 — hooks usam chaves nomeadas tipo 'retest_cooldown'
--   Backend : 0 — nenhuma função grava key vazia
--   Tabela  : 0 rows — sem violação retroativa
--
-- REVERSÃO (se necessário):
--   ALTER TABLE public.admin_settings DROP CONSTRAINT chk_admin_settings_key_not_empty;
-- ============================================================

ALTER TABLE public.admin_settings
    ADD CONSTRAINT chk_admin_settings_key_not_empty
    CHECK (trim(key) <> '');
