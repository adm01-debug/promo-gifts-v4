-- APLICADO: 2026-06-22 via execute_sql (bug-fix session)
-- BUG-CAT-400: categories tabela tem coluna 'is_active' mas frontend
-- (Lovable-generated code) faz queries com .eq('active', true) -> 400.
-- Fix: adicionar 'active' como GENERATED ALWAYS AS (is_active) STORED.
-- Forward-compatible: codigo existente com is_active continua funcionando;
-- queries com active=eq.true agora tambem funcionam corretamente.
-- Semantica preservada: active=true <=> is_active=true (NULL propaga NULL).

ALTER TABLE public.categories
ADD COLUMN IF NOT EXISTS active boolean GENERATED ALWAYS AS (is_active) STORED;

-- Recarregar schema cache do PostgREST para expor nova coluna e
-- corrigir simultaneamente o 404 em get_favorite_list_counts (cache stale).
SELECT pg_notify('pgrst', 'reload schema');
