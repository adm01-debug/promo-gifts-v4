## Objetivo

Garantir que o badge de pendentes no `MyDiscountRequestsWidget` reflita a verdade do banco assim que (a) o vendedor envia/retenta uma solicitação ou (b) o admin aprova/rejeita, sem precisar de refresh manual.

## Diagnóstico atual

O widget já tem:
- Realtime em `discount_approval_requests` filtrado por `seller_id` → invalida a query.
- Polling de 15s (5s no fallback).
- `pendingDupCounts` derivado de `all` (linhas carregadas via `useInfiniteQuery`).

Pontos cegos que causam o badge "atrasado":
1. **`requestApproval` não invalida a query do widget.** Após sucesso, 23505 idempotente ou retry bem-sucedido, o widget só atualiza quando o realtime entrega o evento (pode levar 1–3s) ou quando o polling dispara. Em redes lentas o usuário percebe atraso.
2. **`respondToApproval` (admin) também não invalida** a query do vendedor — depende 100% do realtime, que pode estar em fallback.
3. **Não existe contador agregado visível** de pending no header — o usuário só vê o badge `×N` quando há duplicidade. Um total claro ajuda a perceber a atualização.
4. **Realtime usa `invalidateQueries` sem `refetchType: 'active'` explícito** — está OK por padrão, mas vamos reforçar para garantir refetch de todas as páginas do `useInfiniteQuery`.

## Mudanças

### 1) `src/hooks/quotes/useDiscountApproval.ts`
- Importar `useQueryClient` do `@tanstack/react-query`.
- Após sucesso de `requestApproval` (INSERT novo, dedup samePct, 23505 idempotente) E após sucesso de `respondToApproval`, chamar:
  ```ts
  queryClient.invalidateQueries({
    queryKey: ['my-discount-requests-widget'],
    refetchType: 'active',
  });
  ```
- Chave parcial (sem `userId`) garante invalidação independente de qual aba/sessão disparou.

### 2) `src/components/dashboard/MyDiscountRequestsWidget.tsx`
- Calcular `totalPending = all.filter(r => r.status === 'pending').length`.
- Adicionar badge no header (ao lado do título), com `data-testid="discount-widget-pending-total"` e `data-count={totalPending}`, só renderiza quando `totalPending > 0`.
- Reforçar a invalidação do realtime para `refetchType: 'active'` (sintoma raro de páginas stale).
- Manter `pendingDupCounts` e o badge `×N` por linha como hoje.

### 3) Spec E2E (curto) — `e2e/flows/04ck-discount-widget-pending-badge-live.spec.ts`
- Login como vendedor; navega ao dashboard.
- Conta inicial via `[data-testid="discount-widget-pending-total"]` (ou 0 se ausente).
- Faz POST direto via REST autenticado criando 1 pending para um quote do próprio vendedor (cenário já usado em 04cb).
- Sem refresh, espera o `data-count` incrementar dentro de 20s (realtime) ou 8s (polling fallback).
- PATCH direto via REST mudando o pending para `approved` → `data-count` decrementa dentro de 20s.

## Critérios de aceitação

- Após `requestApproval` bem-sucedido na mesma aba, o badge atualiza em <500ms (invalidate síncrono).
- Após decisão de admin em outra aba/dispositivo, o badge atualiza em <3s com realtime ativo, <8s no fallback.
- Badge `×N` por linha continua funcional para diagnóstico de duplicidade.
- Nenhum impacto em RLS, schema ou edge functions.

## Arquivos afetados

- `src/hooks/quotes/useDiscountApproval.ts` (editar)
- `src/components/dashboard/MyDiscountRequestsWidget.tsx` (editar)
- `e2e/flows/04ck-discount-widget-pending-badge-live.spec.ts` (criar)
