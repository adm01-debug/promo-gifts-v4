-- Placeholder para versao 20250103000000 (renomeado de 20250103_placeholder.sql).
-- Motivo: '20250103_*.sql' ordena DEPOIS de '20250103010000_*.sql' na filesystem
-- porque '_' (ASCII 95) > '0' (ASCII 48), mas no DB '20250103' ordena ANTES.
-- Isso criava mismatch ciclico de posicao no Supabase CLI.
-- Fix: usar timestamp completo '20250103000000' que ordena corretamente em ambos.
SELECT 1;
