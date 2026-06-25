Plano de implementação

1. Preservar e validar a invalidação imediata no hook
- Manter `useQueryClient` e o helper `invalidateWidget()` em `src/hooks/quotes/useDiscountApproval.ts`.
- Confirmar que `invalidateWidget()` é chamado nos quatro caminhos de sucesso exigidos:
  - INSERT novo em `requestApproval`.
  - Dedup `samePct` com pending já existente.
  - Fallback idempotente `23505`.
  - `respondToApproval` após approve/reject.
- Manter `invalidateWidget` nas dependências dos `useCallback`.
- Não alterar schema, RLS, funções ou edge functions.

2. Preservar e validar o badge total no widget
- Manter `totalPending` derivado de `all` em `src/components/dashboard/MyDiscountRequestsWidget.tsx`.
- Manter o badge de header com:
  - `data-testid="discount-widget-pending-total"`
  - `data-count={totalPending}`
  - renderização apenas quando `totalPending > 0`.
- Manter o badge diagnóstico `×N` por linha baseado em `pendingDupCounts` sem alterações.
- Manter a invalidação do realtime com `refetchType: 'active'` para refetch ativo da query do widget.

3. Corrigir o E2E `04ck` para ser determinístico
- Ajustar `e2e/flows/04ck-discount-widget-pending-badge-live.spec.ts` para não pular a validação principal quando o widget ainda não aparece por não haver pendentes iniciais.
- Usar uma sessão com permissão suficiente para simular a decisão admin via PATCH, seguindo o padrão de specs próximos como `04cd`, evitando que o teste pule a metade de decremento por RLS.
- Criar/selecionar um quote elegível sem pending ativo, para evitar colisão com o índice único parcial e não transformar `23505` em skip silencioso.
- Ler o contador como 0 quando o badge estiver ausente e validar:
  - incremento após POST pending, sem refresh manual, em até 25s;
  - decremento após PATCH approved, sem refresh manual, em até 25s;
  - remoção do badge quando a contagem volta para 0.
- Implementar cleanup no `afterEach` para remover/neutralizar o registro criado pelo teste quando possível.
- Alinhar seletores à política E2E do projeto usando `TID()`/`TID_PREFIX()` em vez de seletores literais soltos.

Critérios de aceite cobertos
- Mesma aba: invalidação ativa após `requestApproval` continua garantindo atualização rápida.
- Outra aba/dispositivo: realtime com `refetchType: 'active'` e polling fallback continuam cobrindo atualização sem refresh.
- Badge total reflete pending do banco; badge `×N` por linha permanece funcional.
- E2E passa a falhar em regressões reais em vez de pular cenários críticos por ausência inicial do widget, colisão de pending ou permissão insuficiente.