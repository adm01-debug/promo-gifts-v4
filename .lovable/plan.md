Plano de implementação

1. Preservar a invalidação imediata no hook
- Manter `useQueryClient` e o helper `invalidateWidget()` em `src/hooks/quotes/useDiscountApproval.ts`.
- Confirmar `invalidateWidget()` nos quatro caminhos de sucesso:
  - INSERT novo em `requestApproval`.
  - Dedup `samePct` com pending já existente.
  - Fallback idempotente `23505`.
  - `respondToApproval` após approve/reject.
- Manter `invalidateWidget` nas deps dos `useCallback`.
- Sem alterações em schema, RLS, funções ou edge functions.

2. Preservar o badge total no widget
- Manter `totalPending` derivado de `all` em `src/components/dashboard/MyDiscountRequestsWidget.tsx`.
- Manter badge de header com:
  - `data-testid="discount-widget-pending-total"`
  - `data-count={totalPending}`
  - renderização apenas quando `totalPending > 0`.
- Manter badge diagnóstico `×N` por linha (via `pendingDupCounts`) inalterado.
- Manter invalidação do realtime com `refetchType: 'active'`.

3. Tornar o E2E `04ck` determinístico
- Em `e2e/flows/04ck-discount-widget-pending-badge-live.spec.ts`:
  - Não pular quando o widget ainda não está visível (badge ausente = 0 é estado válido).
  - Logar com sessão admin (padrão do `04cd`) para que o PATCH `approved` passe pela RLS sem skip.
  - Selecionar um quote do próprio usuário sem pending ativo, para não colidir com o índice único parcial e não esconder `23505` em skip.
  - Ler `data-count` como 0 quando o badge não existir.
  - Asserts: incremento <25s após POST pending; decremento <25s após PATCH approved; badge sumir quando contagem volta a 0.
  - Cleanup `DELETE` do registro criado no `afterEach`.
  - Seletores via `TID()`/`TID_PREFIX()` do SSOT em `e2e/fixtures/selectors.ts`.

Critérios de aceite
- Mesma aba após `requestApproval`: badge atualiza via invalidate síncrono.
- Decisão admin em outra aba: <3s com realtime, <8s no fallback de polling.
- Badge `×N` por linha continua funcional.
- Spec falha em regressões reais em vez de pular cenários críticos.

Arquivos afetados
- `src/hooks/quotes/useDiscountApproval.ts` (verificar — sem alteração se já conforme).
- `src/components/dashboard/MyDiscountRequestsWidget.tsx` (verificar — sem alteração se já conforme).
- `e2e/flows/04ck-discount-widget-pending-badge-live.spec.ts` (editar conforme item 3).