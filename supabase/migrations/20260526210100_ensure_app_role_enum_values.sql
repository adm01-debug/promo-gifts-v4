-- Replay-safe: garante que 'agente' e 'coordenador' existem no enum app_role
-- antes da migration 20260526210206 que faz INSERT desses valores em
-- ai_usage_quotas.role (já convertida para app_role em 20260522155300).
--
-- Em produção esses valores foram adicionados via lovable_db_query (fora de
-- migration, ver comentário de 20260522155300). Snapshots de preview anteriores
-- a essa operação out-of-band não têm os valores no enum, causando:
--   ERROR: invalid input value for enum app_role: "agente" (SQLSTATE 22P02)
--
-- ALTER TYPE ADD VALUE IF NOT EXISTS é idempotente (PostgreSQL 9.6+).
-- Em produção essa migration é um no-op (valores já existem).

ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'agente';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'coordenador';
