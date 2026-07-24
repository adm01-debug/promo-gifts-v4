# Migração para `invokeEdgeSafe` — SSOT de `functions.invoke`

**Onda 17-18.** Toda chamada nova a Supabase Edge Function DEVE passar pelo
wrapper `invokeEdgeSafe` (`src/lib/edge/safeInvokeCall.ts`). O gate
`scripts/check-invoke-direct-calls.mjs` (rodado no CI) falha se aparecer um
`supabase.functions.invoke(...)` fora da baseline congelada em
`.invoke-direct-baseline.json`.

## Por quê

`invokeEdgeSafe` aplica o mesmo contrato provado em `safeAuthCall`:

- **Nunca-throw** — sempre resolve `{ kind: 'ok' | 'err', ... }`.
- **Timeout por tentativa** (default 10 s).
- **Retry exponencial** só em falhas transitórias (network/server/timeout).
- **Circuit breaker por `op`** (5 falhas / 30 s → cooldown 60 s).
- **Classificação de erro** (`client | credential | ratelimit | network | server | timeout | unknown`).
- **`userMessage` sanitizada** — sem status bruto/stack em produção.
- **Parser defensivo** do body do erro (JSON quebrado / HTML de proxy não explode).

## Antes / depois

```ts
// ❌ Antes — cru
const { data, error } = await supabase.functions.invoke('minha-fn', {
  body: { foo: 1 },
});
if (error) toast.error(error.message); // vaza técnica, sem retry, sem breaker
```

```ts
// ✅ Depois — via SSOT
import { invokeEdgeSafe } from '@/lib/edge/safeInvokeCall';

const r = await invokeEdgeSafe<{ ok: boolean }>('minha-fn', {
  body: { foo: 1 },
  op: 'minha-fn.doThing',
});
if (r.kind === 'ok') {
  // r.data tipado
} else {
  toast.error(r.userMessage);          // já sanitizada
  logger.warn(r.errorKind, r.op);      // classificação p/ observabilidade
}
```

## Regras da allowlist (`.invoke-direct-baseline.json`)

1. É um **snapshot congelado** — cresce apenas em cenários excepcionais, e
   sempre acompanhado de justificativa no PR.
2. **Regressão** (call site novo fora da baseline) → CI falha.
3. **Migração legítima** (call site removido/portado para `invokeEdgeSafe`) →
   rodar `UPDATE_BASELINE=1 node scripts/check-invoke-direct-calls.mjs` e
   commitar a baseline junto do refactor.
4. `STRICT_BASELINE=1` transforma entradas mortas em erro (usado em ondas
   finais para forçar zeragem).

## O que o gate ignora

- Arquivos de teste (`__tests__/`, `*.test.ts`, `e2e/`).
- O próprio SSOT (`src/lib/edge/safeInvokeCall.ts`).
- Padrão dentro de comentários (linha e bloco) ou de strings.

## Próximas ondas

- **19** — migrar call sites críticos (`log-login-attempt`, `crm-db-bridge`,
  `webhook-dispatcher`, `manage-users`, `step-up-verify`).
- **20** — workflow semanal `edge-invoke-fuzz-weekly.yml` (stress do wrapper).
- **21** — `useInvokeEdge` com toast + telemetria integrados.

---

## Onda 20 — Telemetria & Correlação

Após 19 (migração completa: baseline = 0), o wrapper agora emite telemetria
estruturada e propaga `X-Request-Id` para o edge.

### Eventos emitidos pelo `edge.invoke`

| Evento                       | Nível | Campos principais                                                 |
|------------------------------|-------|-------------------------------------------------------------------|
| `edge_invoke_start`          | info  | `fn`, `op`, `request_id`, `has_body`, `max_retries`               |
| `edge_invoke_ok`             | info  | `fn`, `request_id`, `latency_ms`, `attempts`                      |
| `edge_invoke_failed`         | warn  | `fn`, `request_id`, `latency_ms`, `error_kind`, `attempts`        |
| `edge_invoke_breaker_open`   | warn  | `fn`, `request_id`, `latency_ms`                                  |

> `error_kind` ∈ `credential | ratelimit | network | server | timeout | client | unknown`.
> O motor (`safeAuthCall`) continua emitindo `<op>_ok/_failed/_exhausted/_breaker_open`
> em paralelo — o wrapper apenas espelha em nível "superfície" para agregação por edge.

### Propagação de `X-Request-Id`

- Se o caller não fornecer, o wrapper gera um UUID v4 por chamada.
- O header `X-Request-Id` é injetado no request outbound automaticamente.
- Precedência: `options.requestId` > `options.headers['X-Request-Id']` > gerado.
- O ID é devolvido em `result.requestId` para o caller correlacionar em Sentry
  ou em logs próprios.

```ts
const r = await invokeEdgeSafe('my-fn', { body });
Sentry.setTag('request_id', r.requestId);
```

### Métricas agregadas — `get_edge_invoke_summary(_minutes)`

Draft SQL em `qa/migrations-draft/2026-07-23_get_edge_invoke_summary.sql`
(aplicar via painel Supabase — REGRA #1). Retorna req/min, p50/p95/p99, %erro
por edge nos últimos N minutos, lendo `webhook_delivery_metrics`.

### Gate CI

`scripts/check-client-structured-logging.mjs` inclui `src/lib/edge/safeInvokeCall.ts`
em `CRITICAL_MODULES` — regressão silenciosa no logger falha o CI.
