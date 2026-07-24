-- ============================================================
-- MIGRATION: deepseek_v4_register_models
-- Registrar DeepSeek-V4-Flash e DeepSeek-V4-Pro em ai_models.
-- Data     : 2026-06-15 · Branch: feat/deepseek-v4-migration
-- Urgência : deepseek-chat depreca em 24/jul/2026 (39 dias).
-- Fonte    : https://api-docs.deepseek.com/news/news260424
-- ============================================================

-- 1. DeepSeek V4-Flash
INSERT INTO public.ai_models (
    id, provider_id, model_id, display_name, capabilities,
    cost_input_per_1m, cost_output_per_1m, cost_per_image,
    max_input_tokens, max_output_tokens, is_active, metadata
) VALUES (
    gen_random_uuid(),
    '404b2f04-6e86-4240-997a-ce4390d3cebc',
    'deepseek-v4-flash',
    'DeepSeek V4-Flash',
    '{"chat":true,"tools":true,"image_out":false,"json_mode":true,"streaming":true,"vision_in":false,"reasoning":true}'::jsonb,
    0.14, 0.28, 0.00, 1000000, 384000, true,
    '{"context_window":1000000,"max_output_tokens":384000,"thinking_mode":true,"deprecates":["deepseek-chat"],"cache_hit_price_input":0.0028,"released":"2026-04-24","notes":"Substituto direto do deepseek-chat (deprecado 24/jul/2026)."}'::jsonb
);

-- 2. DeepSeek V4-Pro
INSERT INTO public.ai_models (
    id, provider_id, model_id, display_name, capabilities,
    cost_input_per_1m, cost_output_per_1m, cost_per_image,
    max_input_tokens, max_output_tokens, is_active, metadata
) VALUES (
    gen_random_uuid(),
    '404b2f04-6e86-4240-997a-ce4390d3cebc',
    'deepseek-v4-pro',
    'DeepSeek V4-Pro',
    '{"chat":true,"tools":true,"image_out":false,"json_mode":true,"streaming":true,"vision_in":false,"reasoning":true}'::jsonb,
    0.435, 0.87, 0.00, 1000000, 384000, true,
    '{"context_window":1000000,"max_output_tokens":384000,"thinking_mode":true,"cache_hit_price_input":0.003625,"released":"2026-04-24","notes":"V4-Pro: SOTA open-source em agentic coding."}'::jsonb
);
