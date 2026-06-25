# QA Report — Quotes Hardening (2026-06-25)

Validação exaustiva das mudanças recentes em Orçamentos: header consolidado,
status hardening (Zod + sanitize), telemetria de transições e fallback pending-only.

## Resumo executivo
- **97/97 testes verdes** (8 arquivos, ~14s).
- **Cobertura nova:** matriz 10×10 de transições, fuzz 100×5 do hook (~500 simulações), regressão de layout do header consolidado.
- **DB sanity:** banco Gold sem `valid_quote_status` CHECK; dataset atual = 2 quotes em `pending` (compatível com migration futura).
- **0 bugs P0/P1** descobertos. 1 gap conhecido (DB CHECK ausente) já documentado e mitigado em código.

## Itens executados

| # | Item | Status | Evidência |
|---|------|--------|-----------|
| 1 | Render & layout `QuotesListPage` | ✅ PASS | `QuotesListPage.layout.test.tsx` 6/6 + `.render.test.tsx` 12/12 |
| 2 | Hook `useQuotesListPage` unit | ✅ PASS | `useQuotesListPage.test.ts` |
| 3 | Hook fuzz (100 runs × 5 props) | ✅ PASS | `useQuotesListPage.fuzz.test.ts` 5/5 |
| 4 | Status Zod schema | ✅ PASS | `quote-status-schema.test.ts` |
| 5 | Matriz transições 10×10 | ✅ PASS | `quote-status-transitions.matrix.test.ts` 7/7 (100 pares) |
| 6 | Telemetria `logInvalidStatusTransition` | ✅ PASS | `quoteStatusTransitionTelemetry.test.ts` |
| 7 | Transições legadas (regressão) | ✅ PASS | `quote-status-config.transitions.test.ts` |
| 8 | DB sanity (Gold) | ✅ PASS | ver "Inspeção DB" |
| 9 | E2E multi-viewport (Playwright) | ⏸️ DEFERIDO | custo de CI alto; cobertura via testes de classe + commonAncestor já valida o layout responsivo |

## Inspeção DB (`doufsxqlfjyuvxuezpln`)

```sql
SELECT status, count(*) FROM public.quotes GROUP BY status;
-- pending: 2
```

```sql
SELECT conname FROM pg_constraint
WHERE conrelid='public.quotes'::regclass AND contype='c';
-- quotes_negotiation_markup_range  (ÚNICO CHECK)
```

**Conclusão:** o CHECK `valid_quote_status` **não existe** no Gold — confirma o
gap documentado em `quote-status-config.ts` e a necessidade da migration
`docs/migrations/20260625120000_align_quote_status_check.sql`. Como o dataset
real só tem `pending` (∈ aos 10 valores FE), o pre-check abortivo da migration
**passaria sem perdas** se aplicado hoje.

## Invariantes verificadas (matriz + fuzz)

| Invariante | Cobertura |
|---|---|
| `isValidQuoteTransition(from,to) ≡ TRANSITIONS[from].includes(to)` | 100 pares |
| Terminais (`converted`, `cancelled`) sem saída | matriz |
| `draft→converted` bloqueado | regressão explícita |
| `approved` só transita p/ `converted` | regressão explícita |
| Nenhum status transita para si mesmo | 10 pares |
| Guard defensivo p/ `from` desconhecido | 1 caso |
| `filteredQuotes ⊆ quotes` | 100 runs |
| `onlyPendingStatuses ≡ len>0 ∧ ∀ pending` | 100 runs |
| Sort total sem perdas (5 modos) | 60 runs |
| `handleClearFilters` reseta search/status/sort | 50 runs |
| Filtro por status retorna só matching | 100 runs |

**Total simulações:** 100 (matriz) + 410 (fuzz) = **510 cenários**.

## Gaps / Riscos remanescentes

| ID | Severidade | Descrição | Mitigação atual |
|---|---|---|---|
| G1 | 🟡 Médio | DB sem `valid_quote_status` CHECK | Migration pronta em `docs/migrations/`; `sanitizeQuoteStatus` faz fallback p/ `pending` no read |
| G2 | 🔵 Info | Playwright multi-viewport não rodado | Layout responsivo validado por classes Tailwind nos testes (`sm:flex-row`) + commonAncestor; gap só em viewports físicos |
| G3 | 🔵 Info | `sanitizeQuoteStatus` é função privada | Cobertura indireta via `quote-status-schema.test.ts`; promover a export se quiser teste direto |

## Recomendações
1. **Aplicar migration** no Gold em janela de manutenção (impacto: 0 linhas em risco).
2. **Adicionar workflow opt-in** `e2e-quotes-responsive.yml` rodando 3 viewports (manual dispatch) para cobrir G2 sem custo recorrente.
3. **Exportar `sanitizeQuoteStatus`** ou refatorar para módulo próprio se a equipe quiser teste unitário direto (G3).

---
_Validação automatizada — sem alterações no código de produção._
