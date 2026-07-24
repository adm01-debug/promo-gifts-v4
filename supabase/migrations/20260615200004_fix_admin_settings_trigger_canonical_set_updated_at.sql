-- ============================================================
-- MIGRATION: fix_admin_settings_trigger_canonical_set_updated_at
-- Objetivo : Padronizar trigger updated_at de admin_settings para
--            usar set_updated_at() — função canônica do projeto
--            (usada por 66 tabelas vs 29 que ainda usam o legado).
-- Data     : 2026-06-15
-- Branch   : chore/admin-settings-hardening
-- Melhoria : #4 de 4 — Consistência arquitetural de triggers
--
-- CONTEXTO:
--   O projeto tem 2 funções trigger semanticamente idênticas:
--     set_updated_at()           → canônica (66 tabelas)
--     update_updated_at_column() → legada   (29 tabelas, inclui admin_settings)
--   Ambas executam exatamente: NEW.updated_at = NOW(); RETURN NEW;
--   Nenhuma diferença funcional — apenas histórica.
--   admin_settings usa a legada. Esta migration corrige isso.
--
-- IMPACTO:
--   Comportamento de updated_at: IDÊNTICO (mesma lógica)
--   Frontend: 0 impacto
--   Backend : 0 impacto
--   Trigger antigo é descartado e substituído — sem sobreposição.
--
-- REVERSÃO (se necessário):
--   DROP TRIGGER IF EXISTS trg_admin_settings_set_updated_at ON public.admin_settings;
--   CREATE TRIGGER update_admin_settings_updated_at
--     BEFORE UPDATE ON public.admin_settings
--     FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
-- ============================================================

-- 1. Remover o trigger legado
DROP TRIGGER IF EXISTS update_admin_settings_updated_at ON public.admin_settings;

-- 2. Criar o trigger canônico com nomenclatura padronizada
CREATE TRIGGER trg_admin_settings_set_updated_at
    BEFORE UPDATE ON public.admin_settings
    FOR EACH ROW
    EXECUTE FUNCTION public.set_updated_at();
