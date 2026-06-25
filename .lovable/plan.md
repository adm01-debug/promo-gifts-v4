## Objetivo

Garantir que o badge de pendentes no `MyDiscountRequestsWidget` reflita a verdade do banco assim que (a) o vendedor envia/retenta uma solicitação ou (b) o admin aprova/rejeita, sem refresh manual.

## Mudanças

### 1) `src/hooks/quotes/useDiscountApproval.ts`
- Importar `useQueryClient` de `@tanstack/react-query`.
- Criar helper `invalidateWidget()` que chama:
  ```ts
  queryClient.invalidateQueries({
    queryKey: ['my-discount-requests-widget'],
    refetchType: 'active',
  });
  ```
- Chamar em todos os caminhos de sucesso:
  - `requestApproval` → INSERT novo
  - `requestApproval` → dedup samePct (já existe pending igual)
  - `requestApproval` → fallback 23505 idempotente
  - `respondToApproval` → após approve/reject do admin
- Adicionar `invalidateWidget` às deps dos `useCallback` correspondentes.

### 2) `src/components/dashboard/MyDiscountRequestsWidget.tsx`
- `const totalPending = useMemo(() => all.filter(r => r.status === 'pending').length, [all]);`
- Renderizar `Badge` no header (ao lado do título), só quando `totalPending > 0`, com:
  - `data-testid="discount-widget-pending-total"`
  - `data-count={totalPending}`
- No `useEffect` do realtime, trocar a invalidação atual para incluir `refetchType: 'active'`, garantindo refetch de todas as páginas do `useInfiniteQuery`.
- Manter `pendingDupCounts` e badge `×N` por linha inalterados.

### 3) Criar `e2e/flows/04ck-discount-widget-pending-badge-live.spec.ts`
- Login como vendedor; navega ao dashboard.
- Lê count inicial em `[data-testid="discount-widget-pending-total"]` (0 se ausente).
- POST REST autenticado criando 1 `discount_approval_requests` pending para um quote do próprio vendedor (`seller_id = auth.uid()`), seguindo o padrão de `04cb`.
- Aguarda `data-count` incrementar em até 25s (realtime) sem refresh manual.
- PATCH REST mudando o pending para `approved` → `data-count` decrementa em até 25s.
- Cleanup do registro criado no `afterEach`.

## Critérios de aceitação

- Mesma aba após `requestApproval`: badge atualiza em <500ms (invalidate síncrono).
- Decisão de admin em outra aba: <3s com realtime, <8s no fallback de polling.
- Badge `×N` por linha continua funcional.
- Sem impacto em RLS, schema ou edge functions.

## Arquivos afetados

- `src/hooks/quotes/useDiscountApproval.ts` (editar)
- `src/components/dashboard/MyDiscountRequestsWidget.tsx` (editar)
- `e2e/flows/04ck-discount-widget-pending-badge-live.spec.ts` (criar)
