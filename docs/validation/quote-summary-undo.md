# Validação — Undo remove item no Resumo do Novo Orçamento

**Data:** 2026-07-02
**Escopo:** `QuoteBuilderSummaryColumn.tsx` (handler onClick do 🗑) + `QuoteBuilderPage.tsx` (prop `onRestore`)
**Infra Playwright validada em conjunto:** `alert-dialog-visual.spec.ts`, `confirm-dialog-visual.spec.ts`, npm scripts, workflows CI.

---

## Fase 1 — Análise estática

| Check | Resultado |
|---|---|
| `qa:typecheck` (arquivos alterados) | ✅ Sem novos erros |
| Call sites `removeItem` no domínio Quote | ✅ Apenas 2: `QuoteBuilderSummaryColumn` (com undo) e `QuoteItemEditorSheet` (undo próprio já existente). Sem órfãos. |
| Toast duplicado em `useQuoteItems.removeItem` | ✅ Não existe — `removeItem` não dispara toast. |
| Imutabilidade do snapshot | ✅ `setItems` em `useQuoteItems` usa `prev.filter` e `[...prev]`. Snapshot é referência a objeto imutável — não vaza. |
| Ordem no `onClick` | ✅ `removeItem → setActiveItemIndex → showUndoToast` — `showUndoToast` só usa `snapshot` local. |
| `Math.min(index, next.length)` no restore | ✅ Presente em `QuoteBuilderPage.tsx:748`. Idêntico ao helper já existente em `QuoteItemEditorSheet` (`:775`). |
| `QuoteItem` fields cobertos | ✅ Todos os 22 campos do tipo passam por spread + splice sem perda. |

---

## Fase 2 — Testes unitários

Arquivo: `src/components/quotes/__tests__/QuoteBuilderSummaryColumn.undo.test.ts`

| # | Cenário | Resultado |
|---|---|---|
| T1 | Snapshot imutável entre remove e undo | ✅ |
| T2 | Restore no índice original (meio da lista) | ✅ |
| T3 | `Math.min` clampa quando array encolheu | ✅ |
| T4 | Sem `onRestore` prop → toast NÃO chamado (opt-in) | ✅ |
| T5 | Snapshot preserva todos os campos ricos (personalizations, notes, hex, etc.) | ✅ |
| T6 | 2 removes + 2 undos LIFO restauram ordem original | ✅ |

**Total: 6/6 passed** — `bunx vitest run` em 2.13s.

---

## Fase 3 — Fuzz (550 iterações)

Script: `scripts/validate-quote-summary-undo.mjs`

- **500 iterações base** com QuoteItems randômicos (emoji, RTL, XSS payload, 5k chars, `NaN`, `MAX_SAFE_INTEGER`, personalizations 0..20 com técnicas duplicadas).
- **50 iterações race** (remove A, remove B, undo B, undo A) — verifica LIFO com clamp.

```
Base:  500/500 passed
Race:  50/50 passed
Total: 550/550 passed
```

**Zero divergência de snapshot** em `JSON.stringify(before) === JSON.stringify(after)`.

---

## Fase 4 — Infra Playwright (validação estática)

| Check | Resultado |
|---|---|
| Scripts npm `e2e:{alert,confirm}-dialog(:update)?` + `e2e:dialogs(:update)?` | ✅ Todos presentes, todos com `--project=chromium-public` |
| YAML de `e2e-update-alert-dialog-snapshots.yml` | ✅ Válido, `permissions.contents=write`, job `update-snapshots` |
| YAML de `e2e-update-confirm-dialog-snapshots.yml` | ✅ Válido + cache Playwright adicionado |
| Specs sem dependência de `storageState` (rota pública) | ✅ 0 ocorrências em ambos |
| Rotas `/__test/alert-dialog` e `/__test/confirm-dialog` | ✅ Registradas em `public-routes.tsx:36-37` |
| HTTP dos harnesses (`180/320/375/768`) | ✅ 200 OK em todos os viewports |
| Parser `playwright test --list` | ✅ 20 testes coletados sem erro de import (4 AlertDialog × 4 viewports + 4 ConfirmDialog × 4 variants × 4 viewports = 20) |

**Não executado no sandbox:** run real com Chromium (falta `libglib-2.0.so.0` no ambiente Nix). Fluxo esperado é rodar via workflow `E2E · Update Alert Dialog snapshots` / `E2E · Update Confirm Dialog snapshots` no GitHub Actions ou local com `npm run e2e:bootstrap`.

---

## Gaps identificados

| # | Severidade | Descrição | Ação sugerida |
|---|---|---|---|
| G1 | **info** | Não há E2E que clique o 🗑 do Resumo e verifique o toast Desfazer visualmente. Só validado por unit + fuzz. | Adicionar spec em plano separado (`e2e/orcamentos/quote-summary-undo.spec.ts`). |
| G2 | **info** | Se o usuário clicar excluir várias vezes rápido, cada clique dispara um toast independente. Sonner empilha — não há de-dupe. Mesmo comportamento do Carrinho e do EditorSheet (padrão do projeto). | Manter como está (consistência com resto do app). |
| G3 | **info** | Ao restaurar, se o item tinha `id`, ele é reinserido com o mesmo `id` — ok para persistência (autosave usa upsert). Se dois undos consecutivos executarem, não há colisão. Validado em T6. | Nenhuma. |
| G4 | **info** | Baselines PNG dos specs Playwright ainda não geradas (aguardam CI/dev com `libglib`). | Disparar workflow manual **E2E · Update Alert Dialog snapshots** após merge. |

**Nenhum P0 / P1 / P2 encontrado.**

---

## Conclusão

Feature **Undo no Resumo do Novo Orçamento** aprovada:
- 6/6 unit tests ✅
- 550/550 fuzz iterations ✅
- Análise estática limpa ✅

Infra Playwright validada estaticamente ✅ — execução real de snapshots depende do CI (workflow dispatch) ou máquina dev com libs de sistema.
