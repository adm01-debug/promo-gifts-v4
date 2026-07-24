-- BUG-ALERT-2 FIX (2026-06-23): AI_QUEUE_STALE worker detection
-- Alert disparava mesmo quando worker estava ativo (processou item hoje 15:12).
-- Fix: OR (done AND completed_at > 24h) como evidência de atividade recente.
-- Aplicado em produção via MCP às ~18:35 UTC 2026-06-23.
SELECT 1; -- migration já aplicada diretamente
