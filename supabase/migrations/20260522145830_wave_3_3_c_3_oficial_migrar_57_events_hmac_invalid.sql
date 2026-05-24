-- Wave 3.3.C.3 - backfill one-time de 57 eventos inbound (HMAC invalido) do Lovable
-- PLACEHOLDER INTENCIONAL (reconciliacao de historico 2026-05-23):
-- Migration era um INSERT one-time de 57 linhas de TESTE em inbound_webhook_events
-- (todas signature_valid=false, payloads {"event":"test"}). Ja aplicada em prod.
-- Substituida por no-op para evitar re-insercao de dados de teste em previews.
-- Os dados reais permanecem intactos no banco de producao.
SELECT 1;
