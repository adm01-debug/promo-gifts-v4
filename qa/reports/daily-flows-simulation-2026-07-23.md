# Daily Flows Simulation — 2026-07-23

**Escala:** 1× · **Cenários:** 1523 · **Falhas:** 17

## Sumário por fluxo

| Fluxo | Total | Passou | Falhou |
|---|---:|---:|---:|
| `quote-calc` | 600 | 600 | 0 |
| `price-freshness` | 375 | 375 | 0 |
| `cnpj-validation` | 214 | 214 | 0 |
| `invoke-edge-policy` | 174 | 174 | 0 |
| `webhook-idempotency` | 60 | 43 | 17 |
| `magazine-publish` | 100 | 100 | 0 |

## Gaps detectados (primeiros 20)

| Fluxo | Invariante | Esperado | Observado | Cenário |
|---|---|---|---|---|
| webhook-idempotency | same-key-same-event | `"order.created"` | `"quote.updated"` | `{"dedupKey":"idem-A"}` |
| webhook-idempotency | same-key-same-event | `"order.created"` | `"quote.updated"` | `{"dedupKey":"idem-B"}` |
| webhook-idempotency | same-key-same-event | `"quote.updated"` | `"order.created"` | `{"dedupKey":"idem-C"}` |
| webhook-idempotency | same-key-same-event | `"order.created"` | `"quote.updated"` | `{"dedupKey":"idem-B"}` |
| webhook-idempotency | same-key-same-event | `"quote.updated"` | `"order.created"` | `{"dedupKey":"idem-C"}` |
| webhook-idempotency | same-key-same-event | `"order.created"` | `"quote.updated"` | `{"dedupKey":"idem-A"}` |
| webhook-idempotency | same-key-same-event | `"order.created"` | `"quote.updated"` | `{"dedupKey":"idem-A"}` |
| webhook-idempotency | same-key-same-event | `"quote.updated"` | `"order.created"` | `{"dedupKey":"idem-C"}` |
| webhook-idempotency | same-key-same-event | `"order.created"` | `"quote.updated"` | `{"dedupKey":"idem-A"}` |
| webhook-idempotency | same-key-same-event | `"order.created"` | `"quote.updated"` | `{"dedupKey":"idem-A"}` |
| webhook-idempotency | same-key-same-event | `"order.created"` | `"quote.updated"` | `{"dedupKey":"idem-A"}` |
| webhook-idempotency | same-key-same-event | `"order.created"` | `"quote.updated"` | `{"dedupKey":"idem-A"}` |
| webhook-idempotency | same-key-same-event | `"order.created"` | `"quote.updated"` | `{"dedupKey":"idem-A"}` |
| webhook-idempotency | same-key-same-event | `"order.created"` | `"quote.updated"` | `{"dedupKey":"idem-A"}` |
| webhook-idempotency | same-key-same-event | `"quote.updated"` | `"order.created"` | `{"dedupKey":"idem-C"}` |
| webhook-idempotency | same-key-same-event | `"order.created"` | `"quote.updated"` | `{"dedupKey":"idem-B"}` |
| webhook-idempotency | same-key-same-event | `"order.created"` | `"quote.updated"` | `{"dedupKey":"idem-A"}` |
