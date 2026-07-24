# Onda 21 — Painel Live `invokeEdgeSafe` (client-side)

**Data:** 2026-07-23
**Escopo:** `src/lib/edge/invokeTelemetrySink.ts` + `EdgeInvokeLivePanel.tsx` +
slot em `/admin/telemetria` + testes exaustivos.
**Meta:** dar visualização imediata da saúde da superfície `invokeEdgeSafe`
**sem depender** da RPC `get_edge_invoke_summary` (ainda em draft — REGRA #1).

---

## Simulações prévias

| Bateria | Cenários | Resultado |
|---|---|---|
| **B1** — Buffer FIFO cap (600 pushes, esperar 500) | 1 | ✅ oldest descartado, ordem preservada |
| **B2** — Subscribe/unsubscribe/notify | 3 | ✅ count exato, unsubscribe honrado |
| **B3** — Payload inválido (NaN, string vazia) | 1 | ✅ nunca lança |
| **B4** — Agregação (janela, p50/p95/p99, ratios) | 4 | ✅ percentis monótonos, sum invariants |
| **B5** — Fuzz 500 eventos aleatórios × 8 fns × 4 kinds | 500 | ✅ 0 exceções, 0<errorRatio<1, p95≥p50, p99≥p95 |

Total: **~509 cenários** determinísticos + fuzz.

---

## Entregas

| # | Item | Status |
|---|---|---|
| 21.1 | `invokeTelemetrySink.ts` — ring buffer + agregação + pub/sub | ✅ |
| 21.2 | Hooks em `safeInvokeCall.ts` (start/ok/failed/breaker) | ✅ |
| 21.3 | `EdgeInvokeLivePanel.tsx` — KPIs + tabela por fn + toggle 1/5/15/60min | ✅ |
| 21.4 | Slot em `AdminTelemetriaPage` abaixo do `AppHealthDashboard` | ✅ |
| 21.5 | Testes exaustivos (9 casos + fuzz 500) | ✅ 9/9 verdes |
| 21.6 | Wrapper existente segue verde (22/22) | ✅ |

---

## Invariantes preservados

- **REGRA #1/#8:** nenhuma DDL, nenhuma migration aplicada. Painel é
  100% client-side, in-memory.
- **Sem PII:** sink guarda apenas `fn`, `requestId`, `latencyMs`,
  `errorKind`, `attempts`. Bodies e headers ficam de fora.
- **Nunca-throw:** `recordInvokeEvent` isolado em try/catch; `subscribe`
  listeners também.
- **SSOT preservado:** único ponto de emissão continua sendo
  `safeInvokeCall.ts` — Gate `check-invoke-direct-calls` intacto.

---

## Complementaridade com Onda 20

- **Onda 20 (server-side):** RPC `get_edge_invoke_summary` + histórico
  em `webhook_delivery_metrics` (após aplicação manual).
- **Onda 21 (client-side):** visão da **sessão atual**, útil para
  debugging local / QA. Zero dependência de rede depois do primeiro
  invoke — o painel se auto-alimenta.

Quando a RPC 20.3 for aplicada, `AppHealthDashboard` cobre a visão
histórica; este painel continua útil como "console do dev".

---

## Próxima onda

**Onda 22** — Export CSV/JSON dos eventos do sink + botão "Copiar
request-id" com deep-link para o lookup do `AppHealthDashboard`,
fechando o loop live → histórico.
