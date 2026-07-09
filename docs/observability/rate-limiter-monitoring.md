# Rate-Limiter Monitoring — Consumidores

**Fix:** 2026-07-09 · `_shared/rate-limiter.ts` migrou de `esm.sh` para
`npm:@supabase/supabase-js@2.49.4` (PRs #1640, #1643) e as 6 funções
consumidoras foram redeployadas.

## Consumidores validados (smoke test pós-deploy)

| Função                | POST vazio | Diagnóstico                    |
| --------------------- | ---------- | ------------------------------ |
| ai-recommendations    | 401        | auth OK · boot OK              |
| expert-chat           | 401        | auth OK · boot OK              |
| log-login-attempt     | 400        | validação Zod OK · boot OK     |
| receive-crm-callback  | 401        | api_key OK · boot OK           |
| semantic-search       | 401        | auth OK · boot OK              |
| visual-search         | 401        | auth OK · boot OK              |

Todas responderam 4xx (validação/auth). Ausência de 5xx confirma bundle limpo
com o novo import `npm:@supabase/supabase-js@2.49.4`.

## CI — auto-redeploy

Workflow `.github/workflows/redeploy-rate-limiter-consumers.yml` dispara em
push para `main` que altere `supabase/functions/_shared/rate-limiter.ts`.
Detecta consumidores via `grep -rl "_shared/rate-limiter"`, redeploya cada um
em matrix (`max-parallel: 3`), e roda smoke test HTTP POST — falha o job se
qualquer função retornar 5xx.

## Observabilidade e alertas

Cobertura já ativa via infraestrutura existente (não foi criado nada novo):

1. **Structured logging** — Toda edge chamada pelo browser emite eventos JSON
   com `request_id` na tabela `webhook_delivery_metrics` via
   `_shared/structured-logger.ts` (memória `Structured Logging & Correlation`).
   As 6 consumidoras já estão instrumentadas.

2. **Alertas Sentry** — `webhook-alerts-monitor` (cron 1/min, janela 5min)
   lê `webhook_delivery_metrics` e envia eventos ao Sentry via envelope API
   com tags `alert/source/direction/severity` e `fingerprint` agrupador.
   Thresholds:
   - ≥3 falhas consecutivas → `error`
   - ≥5 respostas 5xx OU >20% no total → `error`
   - >40% respostas 4xx → `warning`

   Requer secret `SENTRY_DSN_SERVER` (sem ele o monitor roda dry).

3. **Diagnóstico manual** — `webhook_delivery_metrics` + RPC
   `get_webhook_delivery_summary(_minutes)` + painel
   `/admin/telemetria` (seção "Saúde da Aplicação", RPC
   `get_app_health_summary`) exibem KPIs (req/min, %4xx, %5xx, p95/p99) por
   função e lookup por `X-Request-Id` (memória `App Health Dashboard`).

## Rate-limit específico

Falhas do rate-limiter (`console.error("[rate-limiter] Error checking...")`)
aparecem no log da função consumidora. Para filtrar no Sentry, use a query
`message:"[rate-limiter]"` na função afetada.

Se o rate-limit DB (`check_edge_rate_limit` RPC) começar a bloquear em massa,
o comportamento `failClosed`/`failOpen` já está definido por endpoint no
próprio consumidor — auth endpoints são `fail-closed`, os demais `fail-open`.
