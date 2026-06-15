-- ============================================================
-- MIGRATION: deepseek_v4_deprecate_v3_models
-- Marcar V3 e R1 como deprecated (NÃO deletar — aguardar
-- 24/jul/2026 para confirmar zero uso e histórico auditável).
-- Data     : 2026-06-15 · Branch: feat/deepseek-v4-migration
-- ============================================================

UPDATE public.ai_models SET
    display_name = 'DeepSeek V3 (Chat) [DEPRECATED 24/jul/2026]',
    is_active = false,
    metadata = metadata || '{"deprecated":true,"deprecated_at":"2026-06-15","deprecation_deadline":"2026-07-24","replaced_by":"deepseek-v4-flash","notes":"deepseek-chat retira em 24/jul/2026 15:59 UTC."}'::jsonb
WHERE model_id = 'deepseek-chat';

UPDATE public.ai_models SET
    display_name = 'DeepSeek R1 (Reasoning) [DEPRECATED 24/jul/2026]',
    is_active = false,
    metadata = metadata || '{"deprecated":true,"deprecated_at":"2026-06-15","deprecation_deadline":"2026-07-24","replaced_by":"deepseek-v4-flash (thinking mode)","notes":"deepseek-reasoner retira em 24/jul/2026."}'::jsonb
WHERE model_id = 'deepseek-reasoner';
