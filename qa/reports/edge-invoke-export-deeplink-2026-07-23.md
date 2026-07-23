# Onda 22 — Export CSV/JSON + Copy request-id + deep-link para lookup

**Data:** 2026-07-23
**Escopo:** `src/lib/edge/invokeExport.ts` + integração no
`EdgeInvokeLivePanel` + listener no `AppHealthDashboard`.
**Meta:** fechar o loop live → histórico. O dev captura um evento
suspeito no painel live, copia o `request-id` ou dispara "buscar no
histórico" e o `AppHealthDashboard` já roda o lookup e faz scroll até
o card, sem digitação manual.

---

## Simulações prévias

| Bateria | Cenários | Resultado |
|---|---|---|
| **B1** — CSV header/rows/ISO/escape (vírgula/aspas/nl) + campos ausentes + array vazio + fuzz 200 | 205 | ✅ shape estável, 0 exceções |
| **B2** — JSON válido, iso presente, `[]` para vazio | 2 | ✅ |
| **B3** — `buildDownloadFilename` determinístico, respeita extensão | 2 | ✅ |
| **B4** — `triggerDownload` cria/click/revoke, nunca lança sem DOM | 2 | ✅ |
| **B5** — `emitRequestIdLookup` dispara CustomEvent com detail; ignora vazio | 2 | ✅ |
| **B6** — `copyRequestId` sucesso/erro/vazio | 3 | ✅ |

Total: **~216 cenários**, 16 casos determinísticos + fuzz 200.
Resultado: **47/47 testes verdes** em `src/lib/edge/__tests__/`.

---

## Entregas

| # | Item | Status |
|---|---|---|
| 22.1 | `invokeExport.ts` — CSV/JSON/filename/download/copy/emit | ✅ |
| 22.2 | Botões CSV/JSON no header do painel live | ✅ |
| 22.3 | Tabela "Eventos recentes" (últimos 20) com badges por kind | ✅ |
| 22.4 | Botão Copy request-id (icon-only, aria-label) por linha | ✅ |
| 22.5 | Botão "Buscar no histórico" dispara `app-health:lookup-request-id` | ✅ |
| 22.6 | `AppHealthDashboard` escuta o CustomEvent, roda `lookupRequestId` e faz `scrollIntoView` | ✅ |
| 22.7 | Testes exaustivos (16) + fuzz 200 | ✅ |

---

## Invariantes preservados

- **REGRA #1/#8:** zero DDL. Exports são 100% client-side (Blob API).
- **Sem PII:** exporta apenas campos já presentes no sink
  (`ts/kind/fn/requestId/latencyMs/errorKind/attempts`). Nada de body,
  headers ou usuário.
- **Nunca-throw:** `triggerDownload`, `emitRequestIdLookup` e
  `copyRequestId` isolam falhas em try/catch e retornam `false`/no-op.
- **SSOT preservado:** wrapper `invokeEdgeSafe` intacto (22/22),
  sink intacto (9/9), gate `check-invoke-direct-calls` inalterado.

---

## Próxima onda

**Onda 23** — Persistir preferência de janela (1/5/15/60 min) do
painel em `localStorage` + atalho de teclado `?` na página
`/admin/telemetria` mostrando as ações disponíveis (copiar,
exportar, buscar).
