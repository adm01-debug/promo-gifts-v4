# Canário sintético — `log-login-attempt`

**Status:** Draft SQL (não aplicado). Aplicação depende de aprovação do PO
conforme REGRA #1/#8 (nenhuma alteração de schema/cron em `doufsxqlfjyuvxuezpln`
sem autorização explícita).

## Objetivo

Detectar regressão silenciosa do contrato "nunca-5xx" entre deploys. O gate
estático + fuzz cobre commits; o canário cobre **runtime** — se o deploy
introduzir uma regressão que só aparece em produção (ex: variável de ambiente
ausente, RLS quebrada, network policy do worker), o canário dispara alerta
antes de qualquer usuário real ver blank-screen.

## Design

- **Trigger:** cron pg_cron a cada 5 minutos (12 chamadas/hora).
- **Payload:** `{ email: "canary@promogifts.internal", success: false, failure_reason: "synthetic", user_agent: "canary/1.0" }`.
- **Comportamento esperado:** `200 { ok: true }` OU `200 { ok: false, fallback: true }`.
  Ambos são degradação **aceita**. O único fail-mode é status >= 500 ou timeout > 5s.
- **Filtragem no dashboard:** o registro do canário na tabela `login_attempts`
  tem `email = 'canary@promogifts.internal'` — filtrar out no `/admin/telemetria`.

## Métricas expostas (via `webhook_delivery_metrics`)

Já cobertas pela infra existente:

- **Latência p95/p99** — do painel `App Health Dashboard`, filtrar `edge=log-login-attempt` E `path=/canary`.
- **Taxa de fallback** — `event=log_login_fallback` (emitido pela Onda 1).
- **Circuit breaker** — header `X-LLA-Breaker` na resposta; state != `closed` por >5min → alerta.

## Draft SQL (para aplicar quando aprovado)

Salvo em `supabase/cron/cron-config.sql` no bloco marcado `JOB 5 (DRAFT)`.
NÃO aplicar sem revisão do PO. O bloco está comentado por default.

## Alertas Sentry (spec)

Adicionar no `webhook-alerts-monitor` (edge function já existente):

- **P0:** ≥3 canários consecutivos com status 5xx OU timeout → `error` fingerprint `canary/log-login-attempt/5xx`.
- **P1:** taxa de fallback do canário > 50% em janela 15min → `warning`.
- **P2:** latência p95 > 1s em janela 30min → `warning`.

Nenhuma dessas mudanças requer código novo — apenas configurar thresholds
no monitor existente.

## Rollback

`SELECT cron.unschedule('canary-log-login-attempt');`

## Referências

- Contrato "nunca-5xx": `qa/reports/log-login-attempt-exhaustive-2026-07-22.md`
- Gate estático: `scripts/check-log-login-attempt-contract.mjs`
- Structured logging: memória `Structured Logging & Correlation`
