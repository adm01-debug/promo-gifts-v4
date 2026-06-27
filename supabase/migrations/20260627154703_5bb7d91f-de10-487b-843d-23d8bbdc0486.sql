-- Remove tabela órfã `quote_comments` (UI consumidora foi removida).
-- CASCADE também derruba policies, triggers, constraints e índices dependentes.
DROP TABLE IF EXISTS public.quote_comments CASCADE;