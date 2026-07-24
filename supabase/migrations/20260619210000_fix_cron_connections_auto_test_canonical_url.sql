-- ============================================================
-- MIGRAÇÃO CORRETIVA: fix_cron_connections_auto_test_canonical_url
-- DATA:   2026-06-19
-- MOTIVO: Drift entre o histórico de migrations e o estado vivo do banco.
--
--   A última migration que tocou o cron 'connections-auto-test'
--   (20260602020000_fix_hardcoded_api_key_cron) recria o job com a URL
--   HARDCODED do projeto PROIBIDO (Lovable Cloud) 'pqpdolkaeqlyzpdpbizo'.
--   A produção já foi corrigida para o projeto canônico Gold
--   'doufsxqlfjyuvxuezpln' (SSOT — ver CLAUDE.md REGRA #1), mas um replay
--   limpo das migrations (branch novo / DR rebuild) reintroduziria a URL
--   proibida — o cron passaria a chamar a edge function no projeto errado.
--
--   Esta migration faz o histórico convergir para o estado canônico que já
--   está em produção. É idempotente e NÃO altera o comportamento em prod
--   (recria o job com a forma idêntica à que já existe).
--
-- VERIFICAÇÃO (live DB doufsxqlfjyuvxuezpln, 2026-06-19, read-only):
--   • Nenhuma função hardcoda 'pqpdolkaeqlyzpdpbizo' (scan pg_get_functiondef).
--   • Nenhum cron job referencia o ref proibido.
--   • public.get_edge_functions_base_url() resolve para a URL canônica.
--   • cron 'connections-auto-test' (jobid 48) JÁ usa a URL canônica.
--   Portanto este é o único ponto de drift remanescente (apenas no histórico).
-- ============================================================

-- Unschedule idempotente: remove pelo jobid resolvido a partir do nome.
-- Se o job não existir, o SELECT retorna conjunto vazio (no-op, sem erro) —
-- diferente de cron.unschedule('<nome>'), que lança exceção se ausente.
SELECT cron.unschedule(jobid)
FROM cron.job
WHERE jobname = 'connections-auto-test';

-- Recria o job com a URL CANÔNICA e secret resolvido via
-- get_edge_function_secret() — forma idêntica à já presente em produção.
SELECT cron.schedule(
    'connections-auto-test',
    '*/15 * * * *',
    $$
    SELECT net.http_post(
        url := 'https://doufsxqlfjyuvxuezpln.supabase.co/functions/v1/connections-auto-test',
        headers := jsonb_build_object(
            'Content-Type', 'application/json',
            'x-cron-secret', public.get_edge_function_secret('CRON_SECRET')
        ),
        body := '{"trigger":"cron"}'::jsonb,
        timeout_milliseconds := 30000
    ) AS request_id;
    $$
);
