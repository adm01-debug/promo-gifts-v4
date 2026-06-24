-- BUG-HSC-1 FIX (2026-06-23): fn_system_health_summary Check 2
-- Verificava is_generated='ALWAYS' para next_entry_date/next_entry_quantity
-- mas estas colunas são preenchidas por trigger (decisão arquitetural deliberada).
-- Fix: verificar EXISTÊNCIA das colunas em vez de modo de geração.
-- Resultado: health_checks.pass=6/6, healthy=true.
-- Aplicado em produção via MCP às ~18:45 UTC 2026-06-23.
SELECT 1; -- migration já aplicada diretamente
