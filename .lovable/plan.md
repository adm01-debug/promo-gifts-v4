## Objetivo
Validar exaustivamente as mudanças recentes em `QuotesListPage` (header consolidado + Buscar/Ordenar + banner pending) e nas camadas adjacentes (status hardening, telemetria de transições, fallback pending-only) que entraram nas últimas rodadas. Sem editar código de produção — apenas testes, simulações e auditoria.

## Escopo da validação

### 1. Render & layout (`QuotesListPage`)
- Vitest + Testing Library: render com 0, 1, N quotes; com `error`; com `onlyPendingStatuses=true`; loading.
- Asserts: `data-testid="page-title-orcamentos"`, `quote-new-button`, `quotes-only-pending-banner` presentes; ordem DOM esperada (título → filtros → botão; banner abaixo).
- Snapshot do header em viewport sm/lg via classes (presença de `sm:flex-row`, `sm:w-[260px]`, `sm:w-[170px]`).
- A11y: `aria-label="Buscar orçamentos"` no input; Select com role combobox.

### 2. Playwright (headless) — preview real
- Rota `/orcamentos` em 360px, 640px, 768px, 1280px, 1920px.
- Screenshots por viewport; assertir que `getByTestId('page-title-orcamentos')` e `getByTestId('quote-new-button')` estão na mesma linha (bounding box top alinhado ±4px) em ≥768px.
- Input + Select existem e estão clicáveis; digitar termo dispara filtragem; trocar sort reordena.
- Verificar ausência de regressão: Status Chips abaixo, ScrollArea intacto, dialogs abrem.

### 3. Hook `useQuotesListPage` — fuzz/property-based
- 200 datasets randomizados (status mix, datas, valores, nulls) via fast-check:
  - Invariante: `filteredQuotes ⊆ quotes`.
  - `onlyPendingStatuses === (quotes.length>0 && quotes.every(q=>q.status==='pending'))`.
  - `sortBy` é estável e total (sem perdas) para todas as 4 opções.
  - `handleClearFilters` zera `searchTerm` e `statusFilter='all'`.
  - Busca case-insensitive em `quote_number|client_name|client_company`.

### 4. Status hardening — `sanitizeQuoteStatus` + Zod
- 50 inputs adversariais: `null`, `undefined`, `''`, `'PENDING'`, `'approve'`, `' approved '`, `123`, `{}`, `'<script>'`, `'pending\u0000'`, todos os 10 válidos.
- Invariante: retorno sempre ∈ `QUOTE_STATUSES`; toda entrada inválida gera 1 log `quote_status_unknown` com payload sanitizado.
- Re-roda suíte `quote-status-schema.test.ts` e `quote-status-config.transitions.test.ts`.

### 5. Transições — telemetria `logInvalidStatusTransition`
- Matriz 10×10 (100 transições): para cada `(from,to)`:
  - Se `QUOTE_VALID_TRANSITIONS[from].includes(to)` → `canTransition===true`, 0 logs.
  - Senão → `false` + exatamente 1 log com `{quoteId, from, to, reason:'config', source:'fe'}`.
- Mock do `updateQuoteStatus` com erro Postgres `23514` → 1 log `db_check_violation`, rethrow `QuoteTransitionBlockedError`.
- Caso especial `draft→converted`: bloqueado em FE e telemetrado.

### 6. E2E mockado — `04l-quote-invalid-status-transition.spec.ts`
- Re-executar com `--repeat-each=10` em chromium-smoke para detectar flakiness.
- Validar que banner `quotes-only-pending-banner` aparece quando seed só tem `pending` e some quando seed mista.

### 7. Auditoria estática
- `tsgo` (typecheck) nos arquivos tocados.
- `npm run check:edge-cors` e `lint:baseline` para garantir 0 regressões.
- `rg "kpis|funnelData"` em `src/pages/quotes/**` — deve ser 0 (regressão da remoção anterior).
- `rg "Access-Control"` em `_shared/cors.ts` — confirmar SSOT.

### 8. DB sanity (read-only)
- `supabase--read_query`: `SELECT status, count(*) FROM quotes GROUP BY 1` para confirmar quais valores reais existem hoje em produção (`doufsxqlfjyuvxuezpln`), checando se algum violaria o futuro CHECK constraint do `docs/migrations/20260625120000_align_quote_status_check.sql`.
- Inspecionar `pg_constraint` para confirmar ausência atual do `valid_quote_status`.

### 9. Relatório final
- Tabela markdown em `qa/QUOTES_HARDENING_REPORT.md`:
  - Cobertura (% statements/branches dos arquivos tocados).
  - Lista de bugs/gaps encontrados (severity: 🔴/🟡/🔵).
  - Status de cada item 1–8 (PASS/FAIL com evidência).
  - Riscos remanescentes + recomendações.

## Entregáveis (novos arquivos, sem alterar produção)
- `src/pages/quotes/__tests__/QuotesListPage.layout.test.tsx` (render + a11y + ordem DOM).
- `src/pages/quotes/__tests__/useQuotesListPage.fuzz.test.ts` (fast-check, 200 runs).
- `src/lib/__tests__/quote-status-transitions.matrix.test.ts` (matriz 10×10).
- `src/services/__tests__/quoteService.sanitize.adversarial.test.ts` (50 inputs).
- `e2e/flows/quotes/quotes-list-header-responsive.spec.ts` (5 viewports + screenshots).
- `qa/QUOTES_HARDENING_REPORT.md` (relatório consolidado).

## Fora de escopo
- Edição de código de produção. Se a validação revelar bug, abrir item no relatório com proposta de fix — implementação fica para nova rodada autorizada.
- Aplicar migration no banco Gold.
- Mudanças visuais/UX além das já aprovadas.

## Riscos da própria validação
- 200 runs de fuzz podem demorar ~30s; isolar em arquivo próprio para não inflar suíte default.
- Playwright em 5 viewports + repeat-each=10 do E2E custa ~3–5min de CI; restringir a workflow opt-in se necessário.
