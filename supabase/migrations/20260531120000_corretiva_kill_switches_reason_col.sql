-- ============================================================================
-- ETAPA 1 — Correção: migração 20260525200103 usou coluna `description`
-- (inexistente). A coluna correta é `reason`. Esta migração insere os 6
-- switches que falharam silenciosamente naquela migração + edge_generate_mockup.
--
-- Idempotente: ON CONFLICT (switch_name) DO NOTHING — reaplicável sem risco.
-- Todos habilitados (enabled=true) por padrão; desabilitar via UPDATE para
-- contenção rápida de incidentes.
-- ============================================================================

INSERT INTO public.system_kill_switches (switch_name, enabled, reason, legacy_message)
VALUES
  (
    'edge_crm_db_bridge',
    true,
    'Kill switch para crm-db-bridge — desabilitar em caso de incidente CRM.',
    'A função crm-db-bridge foi desabilitada por manutenção. Tente novamente em instantes.'
  ),
  (
    'edge_webhook_dispatcher',
    true,
    'Kill switch para webhook-dispatcher — desabilitar para parar todos os webhooks de saída.',
    'O dispatcher de webhooks está temporariamente indisponível.'
  ),
  (
    'edge_ai_recommendations',
    true,
    'Kill switch para ai-recommendations (HuggingFace inference).',
    'Recomendações por IA temporariamente indisponíveis. Exibindo catálogo padrão.'
  ),
  (
    'edge_expert_chat',
    true,
    'Kill switch para expert-chat (LLM externo via proxy).',
    'Chat com especialista temporariamente indisponível. Tente novamente mais tarde.'
  ),
  (
    'edge_bi_copilot',
    true,
    'Kill switch para bi-copilot (Lovable AI Gateway).',
    'BI Copilot temporariamente indisponível. Use os relatórios manuais.'
  ),
  (
    'edge_generate_mockup',
    true,
    'Kill switch para generate-mockup (geração de imagens via IA externa).',
    'Geração de mockup temporariamente indisponível. Tente novamente em instantes.'
  )
ON CONFLICT (switch_name) DO NOTHING;
