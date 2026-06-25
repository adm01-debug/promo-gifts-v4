Auditoria exaustiva — gaps encontrados e plano de correção

Estado atual
- Hook `useDiscountApproval.ts` ✅ correto: `invalidateWidget()` nos 4 caminhos, deps OK.
- Widget `MyDiscountRequestsWidget.tsx` ✅ correto: `totalPending` via `useMemo`, badge `discount-widget-pending-total` com `data-count`, realtime com `refetchType: 'active'`.
- CI: novo job `discount-widget-badge-live` adicionado com `--repeat-each=3` ✅.

Gaps reais identificados na revisão (alto risco de skip silencioso ou flake)

GAP 1 — POST sem `seller_id` no spec 04ck
- O spec atual envia o INSERT em `discount_approval_requests` sem `seller_id`. Os outros specs (`discount-approval-seed-page.ts` linha 119) enviam `seller_id: sellerId` explicitamente.
- Sem `seller_id`, a RLS `dar_insert_scope` (que valida `seller_id = auth.uid()`) rejeita o INSERT → o `expect(inserted.id).toBeTruthy()` falha sem explicar a causa real.

GAP 2 — `pickEligibleQuote` não filtra por dono
- A query `quotes?select=id&order=created_at.desc&limit=40` traz quotes de qualquer vendedor visíveis ao admin.
- INSERT de `discount_approval_requests` para quote de outro seller dispara RLS, ou pior: cria registro "órfão" do ponto de vista do widget (porque o widget filtra `seller_id=eq.{userId}`), fazendo o badge NÃO incrementar.
- Precisa filtrar `quotes?seller_id=eq.<adminUid>` (com paginação suficiente) e preferir quote do admin sem pending ativo.

GAP 3 — Captura do `auth.uid()` ausente
- Para os GAPs 1 e 2 precisamos do `user.id` do admin. O JWT do localStorage já carrega `user.id` (visto em `discount-approval-seed-page.ts`). Vou ler `parsed.user.id` no mesmo `evaluate` que lê o JWT (helper `readJwtAndUid`).

GAP 4 (menor) — Duplicação de cobertura entre jobs
- O job antigo `discount-approval-e2e` roda glob `04c` que inclui `04ck`. O novo job roda `04ck ×3`. Não é bug, apenas ruído — manter por ora porque cobrem cenários complementares (×1 + ×3).

Mudanças a aplicar (apenas no spec)

`e2e/flows/04ck-discount-widget-pending-badge-live.spec.ts`:
1. Trocar `readJwt` por `readJwtAndUid` retornando `{ jwt, uid }`.
2. `pickEligibleQuote(page, jwt, uid)`:
   - `quotes?select=id&seller_id=eq.<uid>&order=created_at.desc&limit=40`
   - Mesma lógica de excluir quotes com pending ativo.
3. POST com `seller_id: uid` no payload.
4. Mensagens de `expect` mais explícitas mencionando a causa provável (RLS) para diagnóstico.
5. Manter cleanup `DELETE` e seletores via `TID()`.

Critérios de validação (auto-checagem mental, sem rodar Playwright local — sem secrets)
- INSERT do spec respeita `dar_insert_scope` (`seller_id = auth.uid()`).
- Widget recebe evento realtime porque filtra `seller_id=eq.<userId>` e o INSERT bate com isso.
- `pickEligibleQuote` só retorna quote do admin sem pending → impossível colidir com `uniq_dar_quote_pending`.
- PATCH `approved` continua válido (admin decidindo a própria solicitação — mesmo padrão do `04cd`).
- Cleanup `DELETE` admin sobre o próprio registro → RLS OK.
- Quando `totalPending` volta a 0, `Badge` desmonta e `toHaveCount(0)` valida.

Arquivos afetados
- `e2e/flows/04ck-discount-widget-pending-badge-live.spec.ts` (editar).

Sem alteração em hook, widget, schema, RLS, funções, edge functions ou CI.