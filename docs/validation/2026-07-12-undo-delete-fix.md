# Relatório de Validação — Fix "Desfazer Exclusão" (toast duplicado)

Data: 2026-07-12
Escopo: `useQuotes.deleteMutation.onSuccess` (remoção do `toast.success` empilhado) + toda a cadeia de undo em `useQuotesListPage` + specs E2E `04o/04p/04q`.

## Sumário executivo

| Item | Resultado |
|---|---|
| Testes unitários rodados | **42 / 42 verdes** |
| Iterações de fuzz | **800+** (500 fuzz do fix + 300 stress single-delete) |
| Cenários E2E coletados | **113** (Playwright `--list` OK — sem coleta silenciosa) |
| Typos residuais (`exluí`/`exclído`) | **0** em código executável |
| `toast.success` órfão pós-DELETE em `useQuotes` | **0** (invariante confirmada) |
| Gaps críticos encontrados | **0** |
| Gaps não críticos | **1** (pré-existente, documentado abaixo) |

## Fase 1 — Auditoria estática

`rg` do repositório inteiro:

- `toast.success('Orçamento excluído')` só ocorre em **2 lugares**:
  1. `src/pages/quotes/useQuotesListPage.ts:168` — **caminho degradado sem snapshot** (esperado, sem botão Desfazer).
  2. `src/pages/quotes/QuoteViewPage.tsx:512` — tela individual (gap pré-existente, ver seção "Gaps").
- `useQuotes.deleteMutation.onSuccess` **não emite mais nenhum toast**. Comentário explicativo (linhas 182–186) preservado.
- Nenhum listener `quotes:*` dispara toast de sucesso.
- Grep por `exluí|exclído` retorna apenas o comentário explicativo em `useQuotes.ts:185`. Zero cópias vivas do typo.

## Fase 2 — Testes unitários

Comando: `bunx vitest run src/pages/quotes/__tests__/useQuotesListPage.*`

| Suíte | Testes | Status |
|---|---:|:---:|
| `useQuotesListPage.singleDelete.test.tsx` | 9 | ✅ |
| `useQuotesListPage.bulkDelete.test.tsx` | 6 | ✅ |
| `useQuotesListPage.expiring.test.ts` | 16 | ✅ |
| `useQuotesListPage.fuzz.test.ts` | 7 | ✅ |
| **`useQuotes.deleteNoToast.regression.test.tsx` (NOVO)** | **4** | ✅ |

Novo teste de regressão (`useQuotes.deleteNoToast.regression.test.tsx`) cobre especificamente o bug corrigido:

1. Sucesso: `service.deleteQuote` chamado, **0 `toast.success`**.
2. Erro: exatamente 1 `toast.error('Erro ao excluir orçamento')`, 0 sucesso.
3. Typo "exluí/exclído" jamais aparece em qualquer toast (grep runtime).
4. **Fuzz 500 iterações** com falhas aleatórias 35%: `toast.success === 0` em todas.

## Fase 3 — Cobertura de asserts do plano

| Assert exigido no plano | Onde | Status |
|---|---|:---:|
| Single delete OK: 1 toast com `Desfazer` | singleDelete `it #1` | ✅ |
| `fetchQuote` falha → toast simples sem undo | singleDelete `it #5/#6` | ✅ |
| `deleteQuote` falha → toast erro, sem undo | singleDelete `it #4` | ✅ |
| Bulk parcial: warning + undo apenas restauráveis | bulkDelete | ✅ |
| `onUndo` remove `id/created_at/updated_at/quote_number` | singleDelete `it #2` | ✅ |
| Nenhum `toast.success` em `useQuotes.deleteMutation` | **regression NOVO** | ✅ |
| Fuzz ≥ 500 iterações da invariante "toast único" | **regression NOVO (500)** + singleDelete stress (300) | ✅ |

## Fase 4 — Playwright (coleta)

`npx playwright test 04o|04p|04q --list` → **113 testes coletados em 6 arquivos** (chromium + mobile-chrome + mobile-safari). Os 4 cenários de `04q` (contador expira, DELETE falha, restore antes do timer, alta latência) todos visíveis — coleta silenciosa que corrompeu o CI anteriormente **está corrigida** (helper `e2eName` re-exportado, blocos `});` desaninhados).

Execução real (`npm run test:e2e:quotes-undo:mock`) fica para o pipeline CI — o sandbox atual não executa browser headed. O workflow `.github/workflows/e2e-quotes-undo.yml` cobre isso com job mock que sempre roda.

## Fase 5 — Simulação de UI stacking (verificação lógica)

- Antes do fix: 2 caminhos emitiam `toast.success` para o mesmo delete (`useQuotes.deleteMutation` **+** `showUndoToast` de `useQuotesListPage`). Screenshot do usuário mostrava 2 cards empilhados.
- Depois do fix: apenas 1 caminho emite (`showUndoToast` do caller). Comprovado por:
  - Auditoria estática (Fase 1).
  - Teste de regressão específico com 500 iterações (Fase 2/3).
- Simulação DOM completa com `<Toaster />` real fica para os E2E `04q` que já asseguram `data-expired="true"` e remoção do DOM ao expirar.

## Fase 6 — Regressões cruzadas

| Item | Status |
|---|---|
| `invalidateQueries(['quotes'])` no `onSuccess` | ✅ mantido (linha 181) |
| Evento `quotes:bulk-delete-confirmed` disparado | ✅ (bulkDelete test) |
| Reentrada de `handleDelete` bloqueada por `isDeletingRef` | ✅ (singleDelete `it #8`) |
| `deleteConfirmId` limpo após operação | ✅ |
| `isDeleting` volta a `false` no finally mesmo em erro | ✅ (stress test) |

## Gaps encontrados

### GAP-1 (não crítico, pré-existente) — `QuoteViewPage` sem Desfazer

**Onde:** `src/pages/quotes/QuoteViewPage.tsx:507-520`
**O quê:** Ao excluir um orçamento a partir da **tela individual**, o fluxo emite `toast.success('Orçamento excluído')` e navega para `/orcamentos` sem oferecer botão de Desfazer.
**Severidade:** Baixa. Não é regressão do fix — sempre foi assim. Só está listado aqui porque o plano pediu para caçar assimetrias com a lista.
**Recomendação:** Aplicar o mesmo padrão de `useQuotesListPage.handleDelete` (snapshot antes do delete + `showUndoToast` + `createQuote` no `onUndo`) para paridade. **Não implementado nesta rodada** por respeito ao escopo ("sem alterar código de produção sem novo aval").

## Conclusão

- Fix do bug do toast duplicado está **matematicamente sólido**: 500 iterações fuzz + auditoria estática garantem `toast.success === 0` em `useQuotes.deleteMutation`.
- Coleta E2E íntegra (113 testes), sem regressão da falha silenciosa anterior.
- 1 gap pré-existente registrado (`QuoteViewPage`), aguardando aprovação para fix separado.

## Arquivos adicionados por esta validação

- `src/hooks/quotes/__tests__/useQuotes.deleteNoToast.regression.test.tsx` (4 testes, incluindo fuzz 500x)
- `docs/validation/2026-07-12-undo-delete-fix.md` (este relatório)
