# Cart Delete via Header Popover — Validação Exaustiva

**Data:** 2026-07-11  
**Alvo:** Fix da corrida `Popover.DismissableLayer` × `AlertDialog.DismissableLayer` em `src/components/cart/CartHeaderButton.tsx` (linhas 559–575 e 890–920).  
**Modo:** correção + validação — `CartHeaderButton` e `useSellerCarts` foram ajustados para fechar a corrida do dialog e impedir sucesso falso quando o banco remove 0 linhas.

---

## 1. Sumário Executivo

| Bateria                          | Simulações | Passou | Falhou |
|----------------------------------|-----------:|-------:|-------:|
| Unit (`vitest`, handler contract)|         13 |     13 |      0 |
| Fuzz determinístico (seeds 1..500) |       500 |    500 |      0 |
| E2E (Playwright, exhaustive)     |         19 |      — |      — |
| Auditoria RLS/DB (banco canônico)|          3 |      3 |      0 |

- **Unit + fuzz:** executados aqui, 100% verdes.
- **E2E:** especificação reforçada (`e2e/ui/cart-delete-header-popover-exhaustive.spec.ts`, 19 cenários). A execução local foi bloqueada por infraestrutura do sandbox: `E2E_USER_EMAIL` ausente e Playwright do projeto procura `/chromium_headless_shell-1217`, enquanto o sandbox tem `/chromium_headless_shell-1194`. Deve rodar no CI, onde o workflow instala browsers e injeta secrets.

**Veredito:** a correção agora cobre as duas causas prováveis do bug persistente: `onCloseAutoFocus` do Popover não cancela mais o handoff para o AlertDialog, e DELETE 2xx com 0 linhas removidas vira erro visível em vez de sucesso falso.

---

## 2. Auditoria Estática

### Handler da lixeira (linhas 559–575)

```tsx
onPointerDown={(e) => { e.stopPropagation(); }}         // NÃO faz preventDefault
onClick={(e) => {
  e.preventDefault();
  e.stopPropagation();
  const id = cart.id;
  deleteDialogHandoffRef.current = true;                 // protege onCloseAutoFocus
  setOpen(false);                                        // fecha Popover
  requestAnimationFrame(() => setPendingDeleteId(id));   // abre Dialog no próximo frame
}}
```

**Ordem crítica auditada** pelo unit: `setOpen(false)` + handoff ocorrem antes de
`setPendingDeleteId`. Durante esse handoff, `PopoverContent.onCloseAutoFocus` chama
`event.preventDefault()` e não limpa `pendingDeleteId`. O fallback usa `globalThis.setTimeout`
quando `requestAnimationFrame` não existe.

### Handler do Confirm (linhas 890–920)

```tsx
disabled={isDeletingCart}
onClick={async (e) => {
  e.preventDefault();
  if (!pendingDeleteId || isDeletingCart) return;   // guard rapid-fire
  try {
    await deleteCart(pendingDeleteId);
    setPendingDeleteId(null);                        // limpa só em sucesso
  } catch { /* mantém dialog aberto */ }
}}
```

- Guard `isDeletingCart` bloqueia N cliques → 1 DELETE (validado no unit + cenário E2E #4).
- Erro NÃO limpa `pendingDeleteId` → dialog fica aberto para retry (unit + E2E #3 e #7).
- `disabled={isDeletingCart}` + `aria-busy` + `<Loader2>` cobrem a11y de loading (E2E #12).

---

## 3. Fuzz Determinístico

**Script:** `scripts/qa/fuzz-cart-delete-popover.mjs`  
**Modelo:** máquina de estados espelhando `SellerCartContext` + `CartHeaderButton`.  
**PRNG:** `mulberry32` (reproduzível).  
**Cobertura:** 500 seeds × 40 ações = 20.000 transições candidatas (12.760 executadas após guards de precondição).  
**Ações modeladas:** `openPopover`, `closePopover`, `clickTrash`, `cancelDialog`, `escapeDialog`, `confirmDelete`, `rapidConfirm` (5×), `switchActive`.  
**Modo de erro do backend:** sucesso real, falha 500 e `noop` (HTTP 2xx sem linha removida).

### Invariantes verificadas em cada transição

| # | Invariante                                                                                     | Violações |
|---|-------------------------------------------------------------------------------------------------|----------:|
| I1| Nunca >1 DELETE em voo (guard `isDeletingCart`)                                                 |         0 |
| I2| `pendingDeleteId` ∈ carts ∨ null                                                                |         0 |
| I3| Popover e Dialog nunca abertos simultaneamente (dialog é modal)                                 |         0 |
| I4| Sucesso ⇒ `pendingDeleteId === null` ∧ cart removido                                            |         0 |
| I5| Falha ⇒ `pendingDeleteId === id` ∧ cart preservado ∧ dialog aberto                              |         0 |
| I6| `activeCartId` só é limpo quando o cart deletado era o ativo                                    |         0 |
| I7| `localStorage[seller:active-cart-id:<uid>]` consistente com `activeCartId`                      |         0 |
| I8| `deletes.length === Σ sucessos` (sem "phantom deletes")                                         |         0 |
| I9| HTTP 2xx sem linha deletada é tratado como erro e preserva dialog/cart                           |         0 |

**Última execução local:** 500/500 seeds, 634 tentativas de DELETE, 227 deleções efetivas, 0 violações.

> Nota: a modelagem inicial permitia `openPopover` com dialog aberto → 132/500 falharam I3. A correção do modelo (dialog é modal e overlay bloqueia o trigger) alinhou o simulador ao comportamento real do Radix e a suíte convergiu para 500/500.

---

## 4. Auditoria RLS/DB (banco canônico `doufsxqlfjyuvxuezpln`)

| Item                                                     | Resultado |
|----------------------------------------------------------|-----------|
| Policy DELETE em `public.seller_carts`                   | `Users can manage own carts` (ALL) USING `seller_id = auth.uid()` — restringe corretamente. |
| Triggers em `seller_carts`                               | `BEFORE INSERT` (owner) + `BEFORE UPDATE OF status` (enforce_ready). **Zero** BEFORE DELETE — nada bloqueia silenciosamente. |
| FK `seller_cart_items(cart_id) → seller_carts(id)`       | `ON DELETE CASCADE` — itens filhos removidos atomicamente, sem risco de 409. |

Server-side está coerente: usuário autenticado só gerencia os próprios carrinhos e os itens caem em cascade. Não foi necessária migration.

---

## 5. Auditoria da Mutation (`useSellerCarts.ts:210`)

```ts
const deleteCart = useMutation({
  mutationFn: async (cartId) => {
    const { data, error } = await supabase
      .from('seller_carts')
      .delete()
      .eq('id', cartId)
      .eq('seller_id', userId)
      .select('id');
    if (error) throw error;
    if (!Array.isArray(data) || data.length !== 1 || data[0]?.id !== cartId) throw new Error(...);
  },
  onSuccess: (deletedCartId) => {
    queryClient.setQueryData([QUERY_KEY, userId], prev => prev?.filter(c => c.id !== deletedCartId));
    queryClient.invalidateQueries({ queryKey: [QUERY_KEY, userId] });
  },
  onError:   (err) => /* emite toast */,
});
```

- `.eq('id', cartId)` + `.eq('seller_id', userId)` — escopo duplo e seguro. ✓
- `.select('id')` confirma que exatamente uma linha foi removida. ✓
- `data.length !== 1` vira erro: dialog permanece aberto e activeCart/localStorage não são limpos. ✓
- Cache remove o carrinho imediatamente após sucesso confirmado e depois invalida. ✓

---

## 6. Especificação E2E (19 cenários)

Arquivo: `e2e/ui/cart-delete-header-popover-exhaustive.spec.ts`.  
Harness próprio (`seed()`) intercepta `**/rest/v1/seller_carts**` DELETE e permite alternar `ok|fail|slow` com delay configurável.

| # | Cenário                                                                                    | Cobre |
|---|--------------------------------------------------------------------------------------------|-------|
|  1| Happy path — dialog, confirmar, 1 DELETE                                                    | fix principal, @smoke |
|  2| Cancelar via botão, Escape, clique fora → 0 DELETE                                          | a11y + fluxo alt |
|  3| Retry após 500 — dialog permanece, 2ª tentativa 204 sucede                                  | contrato de erro |
|  4| Rapid-fire — 10 cliques → ≤1 DELETE                                                         | guard `isDeletingCart` |
|  5| 5 carrinhos, deletar o 3º                                                                   | escopo de eq('id',…) |
|  6| Deletar carrinho ativo → LS limpa                                                           | I6/I7 |
|  7| 2× 500 — dialog nunca fecha, cartão nunca some                                              | I5 |
|  8| a11y — `role="alertdialog"`, Escape                                                         | axe-like manual |
|  9| Enter no confirm dispara DELETE                                                             | teclado |
| 10| Popover reabre limpo após cancelar                                                          | ausência de leak |
| 11| Focus trap dentro do dialog                                                                 | Radix |
| 12| Latência 1.5s — botão `disabled` + `aria-busy=true` + spinner `cart-delete-loading`         | loading UX |
| 13| Tooltip da lixeira não bloqueia clique (regressão do `onPointerDown`)                       | regressão específica |
| 14| Coexistência com Eraser ("Limpar itens")                                                    | isolamento |
| 15| Deletar → excluir outro na sequência                                                        | estado consistente |
| 16| Duplo clique + Enter/Space alternado                                                        | máximo 1 DELETE em voo |
| 17| Rajada após falha                                                                            | retry sem múltiplos DELETEs |
| 18| Carrinho expandido com itens, como no print do usuário                                       | dialog abre apesar do fechamento do Popover |
| 19| DELETE 2xx com 0 linhas removidas                                                           | erro visível, dialog aberto, cart preservado |

**Execução recomendada:**  
`npx playwright test e2e/ui/cart-delete-header-popover-exhaustive.spec.ts --project=chromium`

---

## 7. Gaps e Recomendações

Nenhum gap **crítico** ou **importante** encontrado. Achados menores:

| Sev | Item | Recomendação |
|-----|------|--------------|
| ✅ Resolvido | O handler da lixeira dependia de `requestAnimationFrame` e podia competir com `onCloseAutoFocus`. | Fallback com `globalThis.setTimeout` + handoff ref protegendo o fechamento do Popover. |
| 🔵 Info | Toast de erro é emitido pelo `onError` da mutation. Se o `Toaster` do sonner não estiver montado (regressão de layout), o usuário verá a falha apenas pelo dialog manter-se aberto. | Manter o gate `check-toast-leaks` + garantia visual no E2E #3/#7 já cobre. |
| 🔵 Info | O botão trash usa `opacity-0 … group-hover:opacity-100`. Em navegação puramente por teclado, `focus:opacity-100` já resolve, mas o cartão só o expõe se estiver visível. | OK, coberto por `focus:opacity-100`; sem ação. |

---

## 8. Como reproduzir

```bash
# Unit
npx vitest run src/components/cart/__tests__/CartHeaderButton.delete.test.tsx

# Fuzz (500 seeds, ~50ms)
node scripts/qa/fuzz-cart-delete-popover.mjs

# E2E (requer credenciais E2E_* + browsers Playwright instalados)
npx playwright test e2e/ui/cart-delete-header-popover-exhaustive.spec.ts --project=chromium
```

**Todos os testes verdes = fix validado.**
