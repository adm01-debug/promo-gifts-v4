## Plano: hardening de status de orçamentos + cobertura de testes

### Escopo (4 entregas)

#### 1. Validação runtime de `QuoteStatus` (Zod + telemetria)
- Em `src/types/quote.ts`: adicionar `quoteStatusSchema = z.enum([...QUOTE_STATUSES])` e exportar `QUOTE_STATUSES` como const tuple. `QuoteStatus` passa a ser inferido (`z.infer`). Zero quebra de tipo.
- Em `src/services/quoteService.ts` (`fetchQuotes`/`getQuote`): validar cada linha vinda do banco com `quoteStatusSchema.safeParse(row.status)`. Se falhar:
  - log estruturado via `createClientLogger('quotes_service').warn('quote_status_unknown', { quoteId, status })`
  - fallback do registro para `status = 'pending'` (não derruba UI)
- O guard cobre o cenário "DB adicionou status novo sem atualizar FE".

#### 2. Banner informativo quando só há `pending`
- Em `useQuotesListPage`: novo computed `onlyPendingStatuses = quotes.length > 0 && quotes.every(q => q.status === 'pending')`, retornado pelo hook.
- Em `QuotesListPage.tsx`: quando `onlyPendingStatuses === true`, renderizar `<Alert variant="info">` discreto acima dos filtros: "Todos os orçamentos visíveis estão em status **Pendente**. Avance o fluxo enviando ou aprovando para popular o funil."
- Chips e sort continuam funcionando exatamente como hoje.

#### 3. Testes unitários

**3.1 `src/lib/__tests__/quote-status-config.transitions.test.ts`** (acrescentar — já existe)
- Suite "transições inválidas explícitas": tabela com 12+ pares bloqueados, incluindo `draft→converted`, `pending→converted`, `cancelled→qualquer`, `converted→draft`, `approved→sent`, `approved→cancelled`.
- Suite "status fora do enum retorna false sem throw" (regressão BUG-016).

**3.2 `src/types/__tests__/quote-status-schema.test.ts`** (novo)
- 10 valores válidos passam; 6 valores inválidos (`'foo'`, `null`, `''`, `'PENDING'`, `'draft '`, `123`) reprovados.
- `QUOTE_STATUSES` é tuple readonly com 10 itens (snapshot da SSOT).

**3.3 `src/pages/quotes/__tests__/useQuotesListPage.test.ts`** (novo)
- Mock `@/hooks/quotes` com `useQuotes` retornando dataset controlado.
- Cenários (8):
  - vazio → `filteredQuotes.length === 0`, `onlyPendingStatuses === false`
  - só pending (3 quotes) → `onlyPendingStatuses === true`
  - mistos (`pending` + `sent` + `approved`) → `onlyPendingStatuses === false`
  - filtro `statusFilter='approved'` filtra corretamente
  - busca `searchTerm` ≥ 2 chars aplica Fuse
  - sort `highest`/`lowest`/`expiring`/`newest`/`oldest`
  - `handleClearFilters` zera os 3 controles
  - `handleMarkApproved` chama `updateQuoteStatus(id, 'approved')`

**3.4 `src/pages/quotes/__tests__/QuotesListPage.render.test.tsx`** (novo)
- Mock do hook + `MemoryRouter`. Cobre:
  - estado `loading` renderiza `QuotesSkeleton`
  - estado `error` renderiza banner com texto do erro
  - dataset vazio renderiza `EmptyState`
  - dataset só-pending renderiza o banner novo do item 2
  - dataset com 5 quotes renderiza header com contagem e botão `quote-new-button` (testid preservado)
  - **regressão chave:** nenhum elemento com texto `Total em Aberto`, `Funil de Vendas`, `Aprovados`, `Conversão` aparece no DOM

#### 4. Documentação do gap DB CHECK
- Em `src/lib/quote-status-config.ts` (topo), adicionar comentário JSDoc:
  ```
  ⚠️ DB CHECK constraint `valid_quote_status` aceita apenas 7 status
  ('draft','pending','sent','approved','rejected','expired','converted').
  FE define 10 (faltam pending_approval/viewed/cancelled). Alinhar via
  migration EXIGE aprovação explícita do PO (regra do projeto).
  Até lá, transições para os 3 status FE-only só funcionam em-memória.
  ```
- Sem migration neste plano (respeita regra "NUNCA criar/alterar schema sem confirmação").

### Arquivos afetados
- `src/types/quote.ts` (refactor com Zod, mantendo export type `QuoteStatus`)
- `src/services/quoteService.ts` (parse + fallback + log)
- `src/lib/quote-status-config.ts` (comentário JSDoc)
- `src/pages/quotes/useQuotesListPage.ts` (computed `onlyPendingStatuses`)
- `src/pages/quotes/QuotesListPage.tsx` (banner condicional)
- `src/lib/__tests__/quote-status-config.transitions.test.ts` (mais cenários)
- `src/types/__tests__/quote-status-schema.test.ts` (novo)
- `src/pages/quotes/__tests__/useQuotesListPage.test.ts` (novo)
- `src/pages/quotes/__tests__/QuotesListPage.render.test.tsx` (novo)

### Critérios de aceitação
- `vitest run src/types src/lib src/pages/quotes` verde local.
- Coverage: cada cenário listado acima vira ao menos 1 `expect`.
- Nenhuma quebra de API pública do hook (mantém os outros campos retornados intactos).
- Nenhuma alteração de schema/migration neste ciclo.
- `data-testid="quote-new-button"` preservado (não quebra E2E `04ck`).

### Fora de escopo (explícito)
- Migration alinhando CHECK do banco — pendente aprovação separada.
- Refatorar `useQuoteFunnel` (já removido do consumo).
- Mudar visual dos chips ou layout do header.