-- fix_version: drop_quote_comments_v1
-- ANTI-REGRESSION: substitui 20260627154703_5bb7d91f-de10-487b-843d-23d8bbdc0486.sql
-- (gerado pelo Lovable com UUID, removido em 2026-06-27).
-- Aplicada diretamente via apply_migration; este arquivo existe para manter
-- a rastreabilidade no repo e evitar que o runner reaplique a UUID deletada.
DROP TABLE IF EXISTS public.quote_comments CASCADE;
