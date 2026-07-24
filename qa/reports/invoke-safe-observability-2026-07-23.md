# Onda 20 — Observabilidade da superfície `invokeEdgeSafe`

**Data:** 2026-07-23
**Escopo:** `src/lib/edge/safeInvokeCall.ts` + gate CI + draft SQL da RPC agregada.
**Meta:** transformar a blindagem (Ondas 17–19) em sinal operacional.

---

## Simulações prévias

| Bateria | Cenários | Resultado |
|---|---|---|
| **B1** — Fuzz de telemetria (`fuzz × 120` + 6 casos determinísticos) | 126 | ✅ 0 exceções · 100% emitem `edge_invoke_start` · 100% terminam com `ok/failed/breaker_open` |
| **B2** — Contrato structured-logger (mock SSOT, scope `edge.invoke`) | 6 | ✅ severidades fixas · sem PII · `request_id` presente em todos |
| **B3** — Correlação X-Request-Id (geração, override via option, override via header) | 3 × 60 | ✅ id do resultado ≡ id do log ≡ id do header outbound |

Total: **~370 cenários** (126 fuzz × 3 dimensões + 8 casos determinísticos).

---

## Entregas

| # | Item | Status |
|---|---|---|
| 20.1 | Logger `edge.invoke` no wrapper (`start/ok/failed/breaker_open`) | ✅ |
| 20.2 | `X-Request-Id` outbound + `result.requestId` | ✅ |
| 20.3 | RPC `get_edge_invoke_summary` (draft SQL — REGRA #1) | ✅ draft |
| 20.4 | Painel `/admin/telemetria` aba "Edge Invokes" | 🔜 depende da 20.3 aplicada |
| 20.5 | Gate CI: `safeInvokeCall.ts` em `CRITICAL_MODULES` | ✅ |
| 20.6 | Testes exaustivos (`+6` casos + fuzz 120) | ✅ |
| 20.7 | Doc `invoke-safe-migration.md` seção "Telemetria" | ✅ |

---

## Invariantes preservados

- **REGRA #1:** nenhuma DDL executada em Gold. RPC ficou como draft.
- **REGRA #8:** nenhuma migration aplicada automaticamente.
- **SSOT (Onda 18):** `.invoke-direct-baseline.json` intacto (0 call sites diretos).
- **Nunca-throw:** wrapper continua devolvendo `SafeInvokeResult`, agora + `requestId`.

## Próxima onda

Aplicar `qa/migrations-draft/2026-07-23_get_edge_invoke_summary.sql` via painel
Supabase → montar aba "Edge Invokes" em `/admin/telemetria` reutilizando
`AppHealthDashboard` (memory: App Health Dashboard).
