-- PASSO 49: Registrar kill switches para as funções críticas (T19)
-- Todas habilitadas por padrão — desabilitar via UPDATE para contenção rápida

INSERT INTO system_kill_switches (switch_name, enabled, description)
VALUES
  ('edge_crm_db_bridge',       true, 'Kill switch para crm-db-bridge — desabilitar em caso de incidente CRM'),
  ('edge_webhook_dispatcher',  true, 'Kill switch para webhook-dispatcher — desabilitar para parar todos os webhooks'),
  ('edge_ai_recommendations',  true, 'Kill switch para ai-recommendations (HuggingFace)'),
  ('edge_expert_chat',         true, 'Kill switch para expert-chat (LLM externo)'),
  ('edge_bi_copilot',          true, 'Kill switch para bi-copilot (Lovable AI Gateway)')
ON CONFLICT (switch_name) DO NOTHING;
