# Runbook — `EDGE_FUNCTIONS_BASE_URL` (base URL das Edge Functions p/ callers SQL)

> Status: 2026-05-30. Aplica-se a qualquer ambiente (prod/stage/dev/branch).

## O que e

Callers SQL (cron jobs, triggers, RPCs) que precisam chamar uma Edge Function
montam a URL via `public.get_edge_functions_base_url()`. Esse helper resolve a
base URL **em runtime**, nesta ordem de precedencia:

1. GUC  `current_setting('app.edge_functions_base_url')`
2. Vault secret `EDGE_FUNCTIONS_BASE_URL`
3. **fail-closed** — levanta excecao explicita se nenhum estiver configurado.

O valor e **especifico por ambiente** (cada projeto Supabase tem seu
`https://<project_ref>.supabase.co`). Por isso **nao** e gravado em migration
replayavel — seria hardcode de um ambiente. A migration versiona o *codigo*
(o cron usando o helper); este runbook versiona o *requisito* de config.

## Sintoma quando NAO esta configurado

Cron/trigger que usa o helper falha. Dois formatos possiveis:

- Corpo legado (current_setting direto): `ERROR: null value in column "url" of
  relation "http_request_queue" violates not-null constraint` — a cada tick,
  poluindo `cron.job_run_details`.
- Corpo novo (helper): `ERROR: Base URL das Edge Functions nao configurada...`
  — erro claro, fail-closed.

Diagnostico rapido:

```sql
-- Deve retornar https://<ref>.supabase.co; se levantar excecao, nao esta configurado.
SELECT public.get_edge_functions_base_url();

-- Crons falhando por url nula nas ultimas 24h:
SELECT j.jobname, count(*) FILTER (WHERE d.status='failed') AS failed
FROM cron.job j
JOIN cron.job_run_details d ON d.jobid = j.jobid
WHERE d.start_time > now() - interval '24 hours'
GROUP BY j.jobname HAVING count(*) FILTER (WHERE d.status='failed') > 0;
```

## Como configurar (escolha UM; Vault e o recomendado em prod)

### Opcao A — Vault (recomendado: persistente, idiomatico no Supabase)

```sql
DO $$
DECLARE
  v_name text := 'EDGE_FUNCTIONS_BASE_URL';
  v_val  text := 'https://<project_ref>.supabase.co';   -- <<< troque pelo ref do AMBIENTE
  v_id uuid;
BEGIN
  SELECT id INTO v_id FROM vault.secrets WHERE name = v_name;
  IF v_id IS NULL THEN
    PERFORM vault.create_secret(v_val, v_name, 'Base URL das Edge Functions');
  ELSE
    PERFORM vault.update_secret(v_id, v_val, v_name, 'Base URL das Edge Functions');
  END IF;
END $$;
```

### Opcao B — GUC (tem precedencia sobre o Vault)

```sql
ALTER DATABASE postgres SET app.edge_functions_base_url = 'https://<project_ref>.supabase.co';
-- aplica a NOVAS sessoes; o cron worker conecta a cada run, entao pega no proximo tick.
```

Formato aceito (validado pelo helper): `^https://[a-z0-9-]+\.supabase\.co$`
(sem barra final, sem path).

## Ambiente de PRODUCAO atual

- `project_ref` = `doufsxqlfjyuvxuezpln`
- Base URL    = `https://doufsxqlfjyuvxuezpln.supabase.co`
- Configurado via **Vault** (`EDGE_FUNCTIONS_BASE_URL`) em 2026-05-30.

## Consumidores conhecidos do helper

- cron `connections-auto-test` (a cada 15 min)
- trigger `public.dispatch_quote_webhook_event` (quotes/orders/discount webhooks)
- RPC `public.retry_failed_webhook_deliveries`

Se a base URL nao estiver setada, **todos** falham silenciosa ou ruidosamente.
