Plano já implementado nos turnos anteriores — sem mudanças adicionais necessárias.

Estado atual verificado

1. `src/hooks/quotes/useDiscountApproval.ts`
- `useQueryClient` importado e `invalidateWidget()` helper presente.
- `invalidateWidget()` chamado nos 4 caminhos de sucesso:
  - INSERT novo em `requestApproval`.
  - Dedup `samePct`.
  - Fallback idempotente `23505`.
  - `respondToApproval`.
- `invalidateWidget` nas deps dos `useCallback`.

2. `src/components/dashboard/MyDiscountRequestsWidget.tsx`
- `totalPending` derivado de `all` via `useMemo`.
- Badge de header com `data-testid="discount-widget-pending-total"`, `data-count={totalPending}`, renderizado só quando `totalPending > 0`.
- `pendingDupCounts` e badge `×N` por linha preservados.
- Realtime com `refetchType: 'active'`.

3. `e2e/flows/04ck-discount-widget-pending-badge-live.spec.ts`
- Login admin (`loginAs(page, "admin")`).
- Seleção de quote do próprio admin sem pending ativo.
- Leitura de `data-count` como 0 quando o badge não existe.
- Asserts de incremento e decremento <25s sem refresh.
- Verificação de remoção do badge ao voltar para 0.
- Cleanup `DELETE` no `afterEach`.
- Seletores via `TID()` do SSOT em `e2e/fixtures/selectors.ts`.

Próximo passo sugerido
- Rodar `npx playwright test e2e/flows/04ck --repeat-each=3` para confirmar estabilidade.