-- ============================================================
-- MIGRATION: deepseek_v4_update_function_routing
-- Migrar 12 funções compatíveis para DeepSeek V4.
-- Data     : 2026-06-15 · Branch: feat/deepseek-v4-migration
--
-- REGRAS:
--   • vision_in / image_out → INTOCADAS (V4 não suporta)
--   • V4-Flash: funções chat/volume (11 funções)
--   • V4-Pro  : bi-copilot (tools+json_mode complexo)
--   • Antigo primary → vira fallback[0] (resiliência mantida)
--   • DeepSeek V3 (bfdf0cad) removido de TODOS os fallbacks
--   • DeepSeek R1 removido de bi-copilot e expert-chat
--     (não satisfazia tools/json_mode — era pulado em runtime)
--
-- IDs:
--   DS_V4_FLASH = e375d89c-8f14-44c9-892b-d213372dbc44
--   DS_V4_PRO   = de69480c-c8dd-4ecc-aa5c-5587fb02ce01
-- ============================================================

-- GRUPO A: ex-DeepSeek V3 primary → V4-Flash (fallbacks inalterados)
UPDATE public.ai_function_routing SET primary_model_id='e375d89c-8f14-44c9-892b-d213372dbc44',
    notes='Recomendações personalizadas — alto volume, custo crítico. Primary: V4-Flash (migrado de V3 em 2026-06-15). Fallbacks: Gemini Flash Lite → GPT-5 Nano.', updated_at=now()
WHERE function_name='ai-recommendations';

UPDATE public.ai_function_routing SET primary_model_id='e375d89c-8f14-44c9-892b-d213372dbc44',
    notes='Busca semântica — alto volume. Primary: V4-Flash (migrado de V3 em 2026-06-15). Fallbacks: Gemini Flash Lite → GPT-5 Nano.', updated_at=now()
WHERE function_name='semantic-search';

UPDATE public.ai_function_routing SET primary_model_id='e375d89c-8f14-44c9-892b-d213372dbc44',
    notes='Insights de tendências. Primary: V4-Flash (migrado de V3 em 2026-06-15). Fallbacks: Sonnet 4.6 → Gemini Flash Lite.', updated_at=now()
WHERE function_name='trends-insights';

-- GRUPO B: ex-Sonnet 4.6 primary → V4 (Sonnet vira fallback[0])
UPDATE public.ai_function_routing SET
    primary_model_id='de69480c-c8dd-4ecc-aa5c-5587fb02ce01',
    fallback_model_ids=ARRAY['5b3fb0cd-b05f-4a71-a309-0c984c6e8255','c51d60a4-7abf-4970-a3ed-70e178810e04','e06d9e43-e498-4916-bfa0-e274cca1762e']::uuid[],
    notes='Copilot de BI. Primary: V4-Pro (migrado de Sonnet 4.6 em 2026-06-15). Fallbacks: Sonnet 4.6 → GPT-5 → Gemini 2.5 Pro. R1 removido (sem tools+json_mode).', updated_at=now()
WHERE function_name='bi-copilot';

UPDATE public.ai_function_routing SET
    primary_model_id='e375d89c-8f14-44c9-892b-d213372dbc44',
    fallback_model_ids=ARRAY['5b3fb0cd-b05f-4a71-a309-0c984c6e8255','c51d60a4-7abf-4970-a3ed-70e178810e04','e06d9e43-e498-4916-bfa0-e274cca1762e']::uuid[],
    notes='Chat com vendedor — tools + streaming. Primary: V4-Flash (migrado de Sonnet 4.6 em 2026-06-15). Fallbacks: Sonnet 4.6 → GPT-5 → Gemini 2.5 Pro. R1 removido.', updated_at=now()
WHERE function_name='expert-chat';

UPDATE public.ai_function_routing SET
    primary_model_id='e375d89c-8f14-44c9-892b-d213372dbc44',
    fallback_model_ids=ARRAY['5b3fb0cd-b05f-4a71-a309-0c984c6e8255','c51d60a4-7abf-4970-a3ed-70e178810e04','e06d9e43-e498-4916-bfa0-e274cca1762e']::uuid[],
    notes='BI insights de mercado. Primary: V4-Flash (migrado de Sonnet 4.6 em 2026-06-15). Fallbacks: Sonnet 4.6 → GPT-5 → Gemini 2.5 Pro.', updated_at=now()
WHERE function_name='market-intelligence-insights';

UPDATE public.ai_function_routing SET
    primary_model_id='e375d89c-8f14-44c9-892b-d213372dbc44',
    fallback_model_ids=ARRAY['5b3fb0cd-b05f-4a71-a309-0c984c6e8255','c51d60a4-7abf-4970-a3ed-70e178810e04','e06d9e43-e498-4916-bfa0-e274cca1762e']::uuid[],
    notes='Agente de voz — tools + streaming. Primary: V4-Flash (migrado de Sonnet 4.6 em 2026-06-15). Fallbacks: Sonnet 4.6 → GPT-5 → Gemini 2.5 Pro.', updated_at=now()
WHERE function_name='voice-agent';

-- GRUPO C: ex-GPT-5 Mini primary → V4-Flash (GPT-5 Mini vira fallback[0], V3 removido)
UPDATE public.ai_function_routing SET
    primary_model_id='e375d89c-8f14-44c9-892b-d213372dbc44',
    fallback_model_ids=ARRAY['4ada165d-c63a-4354-ab09-735572f0db9b','09cec844-bdea-4da6-91fc-a8da8b00ab63']::uuid[],
    notes='Conselheiro IA em comparações. Primary: V4-Flash (migrado de GPT-5 Mini em 2026-06-15). Fallbacks: GPT-5 Mini → Haiku 4.5. V3 removido.', updated_at=now()
WHERE function_name='comparison-ai-advisor';

UPDATE public.ai_function_routing SET
    primary_model_id='e375d89c-8f14-44c9-892b-d213372dbc44',
    fallback_model_ids=ARRAY['4ada165d-c63a-4354-ab09-735572f0db9b','09cec844-bdea-4da6-91fc-a8da8b00ab63']::uuid[],
    notes='Prompt criativo para imagem (temp=0.9). Primary: V4-Flash (migrado de GPT-5 Mini em 2026-06-15). Fallbacks: GPT-5 Mini → Haiku 4.5. V3 removido.', updated_at=now()
WHERE function_name='generate-ad-prompt';

UPDATE public.ai_function_routing SET
    primary_model_id='e375d89c-8f14-44c9-892b-d213372dbc44',
    fallback_model_ids=ARRAY['4ada165d-c63a-4354-ab09-735572f0db9b','e572102d-22ad-4ce3-8bf6-5187ba7e97d9']::uuid[],
    notes='SEO automático para produtos (temp=0.7). Primary: V4-Flash (migrado de GPT-5 Mini em 2026-06-15). Fallbacks: GPT-5 Mini → Gemini 2.5 Flash. V3 removido.', updated_at=now()
WHERE function_name='generate-product-seo';

UPDATE public.ai_function_routing SET
    primary_model_id='e375d89c-8f14-44c9-892b-d213372dbc44',
    fallback_model_ids=ARRAY['4ada165d-c63a-4354-ab09-735572f0db9b','5b3fb0cd-b05f-4a71-a309-0c984c6e8255']::uuid[],
    notes='Builder de kits via IA (chat+json_mode). Primary: V4-Flash (migrado de GPT-5 Mini em 2026-06-15). Fallbacks: GPT-5 Mini → Sonnet 4.6. V3 removido.', updated_at=now()
WHERE function_name='kit-ai-builder';

UPDATE public.ai_function_routing SET
    primary_model_id='e375d89c-8f14-44c9-892b-d213372dbc44',
    fallback_model_ids=ARRAY['4ada165d-c63a-4354-ab09-735572f0db9b','09cec844-bdea-4da6-91fc-a8da8b00ab63']::uuid[],
    notes='Score criativo JSON (temp=0.3). Primary: V4-Flash (migrado de GPT-5 Mini em 2026-06-15). Fallbacks: GPT-5 Mini → Haiku 4.5. V3 removido.', updated_at=now()
WHERE function_name='magic-up-score';
