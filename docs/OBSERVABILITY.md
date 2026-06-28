# Observabilidade — Promo Gifts

> **SSOT** para logs estruturados, correlação por `request_id` e dashboards/alertas.
> Última atualização: 2026-04-27 (Onda Observability).

## 1. Correlação ponta-a-ponta (`request_id`)

Cada chamada do client → edge function → DB carrega um único `request_id` (UUIDv4):

| Camada       | Origem                                               | Header                | Helper                                              |
|--------------|------------------------------------------------------|-----------------------|-----------------------------------------------------|
| Client       | `newRequestId()` em `src/lib/telemetry/requestId.ts` | `X-Request-Id`        | `createClientLogger(scope)`                         |
| Edge Fn      | `getOrCreateRequestId(req)` (`_shared/request-id.ts`)| `X-Request-Id` (echo) | `createStructuredLogger({ fn, requestId, req })`    |
| DB           | gravado em colunas `request_id` (auditoria/metrics)  | n/a                   | passar via parâmetro RPC ou body de insert         |
| Sentry       | tag `request_id` em `captureException`               | n/a                   | `createClientLogger(...).error(...)` faz forwarding |

**Regra:** toda nova edge function DEVE usar `createStructuredLogger`. Toda chamada `supabase.functions.invoke` em rota crítica DEVE enviar `headers: log.headers()`.

## 2. Logger estruturado (formato JSON)

Edge:
```json
{"ts":"2026-04-27T12:00:00Z","level":"info","fn":"quote-sync","request_id":"…","event":"request_end","method":"POST","path":"/quote-sync","status":200,"duration_ms":124}
```

Client (em PROD):
```json
{"ts":"…","level":"warn","scope":"auth.signIn","request_id":"…","event":"signin_failed","reason":"invalid_credentials"}
```

Severidades:
- `info`  → fluxo normal (não dispara alerta).
- `warn`  → 4xx, validação, rate-limit. Sentry `captureMessage`.
- `error` → 5xx, exceção não tratada, integração quebrada. Sentry `captureException`.

## 3. Webhooks — métricas e dashboard

Tabela: `public.webhook_delivery_metrics` (append-only, escrita por `service_role`).

Funções consumidoras já instrumentadas (escrevem 1 linha por entrega):
- `webhook-inbound`, `webhook-dispatcher`, `product-webhook`, `sync-quote-bitrix`, `quote-sync`, `bitrix-sync`.

Dashboard (admin → `/admin/observabilidade`):

```sql
SELECT * FROM public.get_webhook_delivery_summary(60);  -- últimos 60 min
```

Retorna por `source` × `direction` × `status_class` (2xx/3xx/4xx/5xx):
- `total`, `failures`, `p95_ms`, `last_failure_at`.

## 4. Alertas Sentry

| Alerta                       | Condição                                                | Severidade | Canal       |
|------------------------------|---------------------------------------------------------|------------|-------------|
| 5xx burst (edge)             | `event.tags.scope:edge.* level:error` ≥ 5 em 5 min      | P1         | Slack #ops  |
| 4xx anômalo (auth)           | `scope:auth.*` `event:*_failed` ≥ 20 em 10 min          | P2         | Slack #ops  |
| Webhook outbound failing     | `scope:webhook.outbound level:error` ≥ 3 em 5 min       | P1         | PagerDuty   |
| Webhook inbound 4xx          | `scope:webhook.inbound event:reject_*` ≥ 10 em 10 min   | P2         | Slack #int  |
| Step-up MFA bypass attempt   | `scope:auth.stepUp event:bypass_attempt`                | P0         | PagerDuty   |
| AI gateway saturation        | `scope:ai.gateway event:rate_limited` ≥ 50 em 5 min     | P2         | Slack #ai   |

Configurar via Sentry → Alerts → Create Alert Rule, filtrando pelas tags
`scope`, `event` e `request_id` emitidas pelos loggers.

### Métrica complementar: webhook 5xx via DB

Cron Sentry/cronjob externo pode rodar:
```sql
SELECT source, failures, p95_ms, last_failure_at
FROM public.get_webhook_delivery_summary(15)
WHERE status_class = '5xx' AND failures >= 3;
```
e disparar webhook se retornar linhas.

## 5. Rotas críticas instrumentadas (client)

- `auth.signIn`, `auth.signOut`, `auth.stepUp`, `auth.passwordRecovery`
- `quote.create`, `quote.approvePublic`, `quote.syncBitrix`
- `mcp.issueKey`, `mcp.revokeKey`
- `magicUp.generate`, `magicUp.share`
- `comparison.publicShare`
- `connections.testCredentials`

Padrão:
```ts
const log = createClientLogger('quote.create');
log.info('start', { items: cart.length });
try {
  const { data, error } = await supabase.functions.invoke('quote-sync', {
    body: payload,
    headers: log.headers(),       // propaga X-Request-Id
  });
  if (error) { log.error('failed', { err: error }); throw error; }
  log.info('ok', { quoteId: data.id });
} catch (err) {
  log.error('exception', { err });
  throw err;
}
```

## 6. Como debugar uma falha

1. Pegue o `request_id` exibido ao usuário ou no erro do Sentry (tag `request_id`).
2. **Edge logs** (Lovable Cloud → Edge Function logs): grep pelo id.
3. **Auth logs** / **DB logs**: idem.
4. **Webhook metrics**: `SELECT * FROM webhook_delivery_metrics WHERE request_id = '…'`.

## 7. Gates de CI

- `tests/observability/structured-logger.test.ts` — garante schema de saída.
- `scripts/check-edge-structured-logging.mjs` — gate (próxima onda) para garantir que toda nova edge function importa `createStructuredLogger`.

## 8. Inventário de prontidão (T26 do redeploy Fase 3, 2026-05-12)

| Capacidade | Estado | Cobertura |
|---|---|---|
| Sentry integrado | ✅ | `src/lib/sentry.ts` + `error-reporter.ts` |
| Structured logger client | ✅ | `src/lib/telemetry/structuredLogger.ts` |
| Structured logger edge | ✅ | `_shared/structured-logger.ts` (via `createStructuredLogger`) |
| `request_id` correlation client → edge → DB | ✅ | seção 1 deste doc |
| Webhook metrics (`webhook_delivery_metrics`) | ✅ | `get_webhook_delivery_summary(minutes)` |
| Dashboard admin | ✅ | `/admin/observabilidade` |
| CI gate sobre estrutura de logs | ✅ | seção 7 deste doc |

### Gaps conhecidos (Fase 4+ — não bloqueia redeploy 10/10)

| Gap | Severidade | Onde fica documentado |
|---|---|---|
| Sem RUM (Real User Monitoring) — Web Vitals não capturados em produção | Médio | abrir issue dedicada na Fase 4 |
| Healthcheck endpoint público (`/api/health`) inexistente — Lovable não tem auto-monitor, Vercel sim mas só sobre `*.vercel.app` | Médio | abrir issue dedicada na Fase 4 |
| Retention de logs Supabase ≤ 7 dias (default plan) — sem externalização para storage longo | Médio | avaliar custo de Log Drains Supabase ou export via cron |
| Sem alerta automático sobre quota Supabase (DB, storage, edge invocations) | Baixo | Sentry Pulse cobre parte; revisar thresholds |
| Audit interna `audit_rls_coverage()` / `audit_rls_matrix()` existem mas resultado não é monitorado | Baixo | agendar cron + alerta Sentry se cobertura cair |

### Recomendação operacional

A prontidão atual (Sentry + structured logger + webhook metrics + request_id ponta-a-ponta) **é suficiente para redeploy 10/10**. Os gaps acima são melhorias incrementais — abrir issues separadas e priorizar conforme volume de tráfego pós-redeploy.

## 9. Debug toggle: `window.__DEBUG_QUOTE_TABLE`

Flag de runtime para diagnosticar alinhamento header/body do `QuoteItemsTable`
(scrollbar gutter, padding dinâmico, larguras de colunas em ambientes com
scrollbar overlay vs. clássica).

### Habilitar

No DevTools (console) da página `/orcamentos/...`:

```js
window.__DEBUG_QUOTE_TABLE = true;
// para desligar:
window.__DEBUG_QUOTE_TABLE = false;
```

A flag é lida em cada `measure()` (disparado por mount, resize do scroller e
mudança de conteúdo via `ResizeObserver`). Não requer reload.

### Logs emitidos

`console.debug("[QuoteItemsTable]", payload)` com o seguinte shape:

| Campo | Tipo | Significado |
|---|---|---|
| `tableUid` | string | id único do par de tabelas (header/body) |
| `scrollerWidth` | number | `scroller.offsetWidth` |
| `clientWidth` | number | `scroller.clientWidth` |
| `scrollbarPad` | number | `offsetWidth - clientWidth` → padding-right aplicado no header wrapper |
| `viewport` | `{w,h}` | viewport atual (px) |

### Como interpretar

- `scrollbarPad === 0` em desktop com conteúdo que rola → provável scrollbar
  **overlay** (macOS, Chromium em alguns OSes). Alinhamento já está correto sem
  padding.
- `scrollbarPad` entre 12–17 → scrollbar **clássica** (Windows/Linux Chromium e
  Firefox). Padding aplicado garante paridade com colunas do body.
- `scrollbarPad` oscilando entre valores não-zero a cada resize → suspeitar de
  loop de `ResizeObserver`. Verificar `dependencies` do `useLayoutEffect`.
- Delta header↔body > 2px no E2E mesmo com `scrollbarPad` correto → conferir
  `<colgroup>` (larguras devem ser idênticas) e `table-layout: fixed`.

### Cobertura E2E

`e2e/quotes/quote-items-table-header-radius.spec.ts` valida o toggle
(`window.__DEBUG_QUOTE_TABLE = true` → espera `console.debug` com prefixo
`[QuoteItemsTable]`) e roda no matrix cross-browser (`chromium-public`,
`firefox-public`, `webkit-public`) via `.github/workflows/e2e-quote-items-table-header.yml`.
