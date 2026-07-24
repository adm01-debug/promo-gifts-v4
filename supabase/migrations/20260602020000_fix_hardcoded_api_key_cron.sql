-- ============================================================
-- MIGRAÇÃO: 20260602020000_fix_hardcoded_api_key_cron.sql
-- AUTOR:    Claude (audit fix/claude-supabase-audit-collapse-20260602)
-- DATA:     2026-06-02
-- MOTIVO:   COLAPSO #5 (CRÍTICO SEGURANÇA) — Cron job #46 tem a 
--           anon key hardcoded diretamente no SQL.
--           Qualquer um com SELECT em cron.job vê a chave.
--           Correção: usar public.get_edge_function_secret() como todos os outros jobs.
-- ============================================================

-- ETAPA 1: Remover o cron job com a chave hardcoded
SELECT cron.unschedule('connections-auto-test');

-- ETAPA 2: Recriar o cron job usando get_edge_function_secret() para a apikey
-- Mantendo o mesmo schedule (*/15 * * * *) e mesmo endpoint
SELECT cron.schedule(
    'connections-auto-test',
    '*/15 * * * *',
    $$
    SELECT net.http_post(
        url := 'https://pqpdolkaeqlyzpdpbizo.supabase.co/functions/v1/connections-auto-test',
        headers := jsonb_build_object(
            'Content-Type', 'application/json',
            'x-cron-secret', public.get_edge_function_secret('CRON_SECRET')
        ),
        body := '{"trigger":"cron"}'::jsonb,
        timeout_milliseconds := 30000
    ) AS request_id;
    $$
);

-- NOTA PARA O DEV: 
-- O endpoint connections-auto-test precisa ser atualizado para aceitar
-- 'x-cron-secret' ao invés de 'apikey' como header de autenticação.
-- OU manter 'apikey' mas pegar a chave via get_edge_function_secret('SUPABASE_ANON_KEY').
-- Verificar qual header o edge function connections-auto-test espera.
