## Contexto e premissas

- O banco canônico do app é o externo `doufsxqlfjyuvxuezpln` (project knowledge — REGRA #1). A ferramenta de migration do Lovable Cloud aponta para `pqpdolkaeqlyzpdpbizo` e não tem os dados nem o CHECK real. Por isso a migration será entregue como **arquivo SQL versionado** em `supabase/migrations/` para ser aplicado pelo PO no projeto Gold — **não vou rodar `supabase--migration`** (que iria contra a regra "NUNCA criar schema novo sem confirmação no Cloud interno").
- O CHECK atual referenciado nas migrations históricas: `('draft','pending','sent','approved','rejected','expired','converted')` (7). FE tem 10 (faltam `pending_approval`, `viewed`, `cancelled`).
- Telemetria reaproveita `createClientLogger` já usado em `quoteService.ts`.

## Entregáveis

### 1. Migration SQL alinhando o CHECK (arquivo, não aplicada)

Arquivo novo: `supabase/migrations/20260625120000_align_quote_status_check.sql`

```sql
-- UP: alinhar CHECK aos 10 status do FE (QUOTE_STATUSES)
ALTER TABLE public.quotes DROP CONSTRAINT IF EXISTS valid_quote_status;

-- Pré-saneamento defensivo: nada deve sobrar fora do enum.
-- Aborta a migration se houver linha incompatível (em vez de silenciosamente coagir).
DO $$
DECLARE bad_count int;
BEGIN
  SELECT count(*) INTO bad_count FROM public.quotes
  WHERE status IS NOT NULL
    AND status NOT IN ('draft','pending','pending_approval','sent','viewed',
                       'approved','rejected','expired','cancelled','converted');
  IF bad_count > 0 THEN
    RAISE EXCEPTION 'align_quote_status_check abortada: % linha(s) com status fora do enum', bad_count;
  END IF;
END $$;

ALTER TABLE public.quotes
  ADD CONSTRAINT valid_quote_status
  CHECK (status IN (
    'draft','pending','pending_approval','sent','viewed',
    'approved','rejected','expired','cancelled','converted'
  ));
```

Arquivo de rollback: `supabase/migrations/rollback/20260625120000_align_quote_status_check.down.sql`

```sql
-- DOWN: voltar para 7 status legados (rollback seguro)
-- Reverte primeiro qualquer registro com status novo para evitar violação.
UPDATE public.quotes SET status = 'pending'
 WHERE status IN ('pending_approval','viewed','cancelled');

ALTER TABLE public.quotes DROP CONSTRAINT IF EXISTS valid_quote_status;
ALTER TABLE public.quotes
  ADD CONSTRAINT valid_quote_status
  CHECK (status IN ('draft','pending','sent','approved','rejected','expired','converted'));
```

Atualizar o JSDoc em `src/lib/quote-status-config.ts` indicando que o gap está endereçado pela migration `20260625120000` (pendente de aplicação no banco Gold).

### 2. Telemetria de transições inválidas

Arquivo novo: `src/lib/telemetry/quoteStatusTelemetry.ts`

- Exporta `logInvalidStatusTransition({ quoteId, from, to, reason, source })`.
- Usa `createClientLogger('quote_status_transition')`; emite evento `quote_status_transition_blocked` com `quoteId`, `from`, `to`, `reason` (`out_of_enum` | `not_allowed_by_config` | `db_check_violation`), `source` (`ui` | `service` | `db`).

Pontos de instrumentação:
- `src/lib/quote-status-config.ts` → `canTransition(from, to, quoteId?)` passa a chamar `logInvalidStatusTransition` quando retorna `false` (mantém retorno booleano; quoteId opcional para não quebrar testes existentes).
- `src/services/quoteService.ts` → no `updateQuoteStatus` (ou equivalente), antes do `update`: se `canTransition` falha, loga + lança erro tipado `QuoteTransitionBlockedError`. No `.catch` do Supabase, se o erro vier com `code 23514` e mensagem contendo `valid_quote_status`, loga com `reason: 'db_check_violation'` e relança como erro amigável.

### 3. Teste E2E (Playwright) — transição inválida + fallback UI

Arquivo novo: `e2e/flows/quotes/quote-invalid-status-transition.spec.ts` (segue [E2E Helpers Policy] e [E2E Named Resources]).

Cenário:
1. `loginAs('seller')` e cria orçamento via API helper já existente (status inicial `draft`), nome via `e2eName('quote-invalid-status')`.
2. **Caminho UI (bloqueio no FE):** abre `/orcamentos/:id`, tenta acionar a ação que dispararia `draft→converted` via console patch ou via chamada direta a `updateQuoteStatus` (exposto em `window.__e2e` apenas quando `import.meta.env.MODE==='test'`); espera toast saneado padrão e ausência de mudança de status (poll por `Sel.quote.statusBadge`).
3. **Caminho DB (CHECK violation):** força `supabase.from('quotes').update({ status: 'not_a_status' })` via helper E2E e espera erro 23514; valida que a UI, ao recarregar a lista, mostra o **banner "pending-only"** já implementado quando o seed só tem `pending` (reaproveita fixture). Valida via `Sel.quotes.pendingOnlyBanner` (novo testid a adicionar em `QuotesListPage.tsx`: `data-testid="quotes-pending-only-banner"`).
4. Cleanup via `e2eName` prefix (helper já padrão).

Ajustes mínimos de produção para suportar o teste:
- Adicionar `data-testid="quotes-pending-only-banner"` no `<Alert>` do `QuotesListPage.tsx`.
- Adicionar `data-testid="quote-status-badge"` no badge de status da página de detalhe (se ainda não existir).
- Expor `window.__e2e.updateQuoteStatus` apenas quando `import.meta.env.MODE === 'test'` em `src/lib/e2e/exposeForTests.ts` (já existe um padrão similar — confirmo ao implementar).

## Arquivos a criar/editar

- **Novo:** `supabase/migrations/20260625120000_align_quote_status_check.sql`
- **Novo:** `supabase/migrations/rollback/20260625120000_align_quote_status_check.down.sql`
- **Novo:** `src/lib/telemetry/quoteStatusTelemetry.ts`
- **Novo:** `e2e/flows/quotes/quote-invalid-status-transition.spec.ts`
- **Editar:** `src/lib/quote-status-config.ts` (instrumenta `canTransition` + atualiza JSDoc)
- **Editar:** `src/services/quoteService.ts` (telemetria + tradução do erro 23514)
- **Editar:** `src/pages/quotes/QuotesListPage.tsx` (testid no banner)
- **Editar (se necessário):** página de detalhe do orçamento (testid no badge)
- **Editar (se necessário):** `src/lib/e2e/exposeForTests.ts` para expor helper

## Fora de escopo

- **Aplicar** a migration no banco Gold (REGRA #1 — só o PO aplica; entrego o SQL).
- Mudanças visuais nos chips/funil.
- Refatoração do `useQuoteFunnel` (já removido).

## Riscos e mitigação

- Aplicar o CHECK com dados sujos quebraria o `ALTER`. Mitigado pelo `DO $$` de pré-checagem que aborta com mensagem clara.
- Rollback poderia falhar se houver linhas com status novo; mitigado por `UPDATE … SET status='pending'` antes do `ADD CONSTRAINT` (decisão conservadora — documentar no PR que isso é lossy).
- Telemetria em `canTransition` pode gerar ruído em testes unitários existentes; uso de `quoteId` opcional + flag `silent` para o uso em testes mantém compatibilidade.
