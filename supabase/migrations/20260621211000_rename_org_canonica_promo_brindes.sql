-- APLICADO 2026-06-21 (Supabase MCP execute_sql, projeto doufsxqlfjyuvxuezpln).
-- A migracao 20260527143139 tentou renomear a org para "Promo Brindes" mas mirava o id
-- fantasma (35c6a2a6) inexistente -> UPDATE 0 linhas. Aqui alinhamos o registro REAL
-- (5db5aee1) ao FIXED_ORG do front-end (name/slug). Idempotente.
UPDATE public.organizations
SET name = 'Promo Brindes', slug = 'promo-brindes'
WHERE id = '5db5aee1-064b-4ef4-9193-345dcd8274ea';
