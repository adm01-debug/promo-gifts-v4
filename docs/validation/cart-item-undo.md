# Validação — Undo ao remover item do carrinho

**Data:** 2026-07-02
**Escopo:** `handleRemoveWithUndo` em `src/components/cart/CartHeaderButton.tsx` (linhas 155-192, 680, 729)
**Infra reutilizada:** `showUndoToast` (`src/utils/undoToast.tsx`), `restoreItems` (`SellerCartContext` → `useSellerCarts`)

---

## 1. Análise estática

| Item | Resultado |
|---|---|
| Callsites de `removeItem` no `CartHeaderButton` (2) trocados por `handleRemoveWithUndo` | ✅ |
| Outros callsites de `removeItem` intactos (`useSellerCartsPage.ts`, contexto) | ✅ |
| Snapshot congelado via spread literal (sem referência ao objeto original) | ✅ (comprovado no teste "mutação posterior") |
| `null → undefined` em 6 campos opcionais (`product_sku`, `product_image_url`, `color_name`, `color_hex`, `notes`, `sort_order`) | ✅ |
| `cart.id` capturado no closure do `.map`, não `activeCartId` | ✅ |

## 2. Testes unitários — `CartHeaderButton.undoSnapshot.test.ts`

| ID | Caso | Status |
|---|---|---|
| T1/T2 | `removeItem(id)` + `showUndoToast` com título/description/duration corretos; `onUndo` restaura com shape `AddToCartInput` | ✅ |
| T5 | 6 campos null → todos `undefined` (nenhum `null` no payload) | ✅ |
| T7 | Cascata de 3 removes, `onUndo` invocado fora de ordem, cada snapshot preserva seu `product_id` | ✅ |
| T8 | 2 carts distintos (`cart-X`, `cart-Y`), cada `onUndo` restaura no cart correto | ✅ |
| — | Mutação do item de origem após snapshot NÃO afeta payload | ✅ |

**Total:** 5/5 passando (`bunx vitest run` — 14ms).

## 3. Fuzz 500 + race 50 — `scripts/validate-cart-undo.mjs`

| Cenário | Iterações | Falhas |
|---|---|---|
| Fuzz: nomes com emoji, strings de 5000 chars, `price=0`, `price=999999.99`, `quantity=999999`, nullables randomizados | 500 | 0 |
| Race: 50 snapshots + mutação in-place dos itens de origem | 50 | 0 |

**Total:** 550/550 (`node scripts/validate-cart-undo.mjs`). Snapshot sempre valida contra o schema Zod de `AddToCartInput` e permanece imutável.

## 4. Fase 4 (E2E Playwright) — não executada

Playwright E2E completo requer stack Chromium + baselines visuais em CI. A validação unitária + fuzz cobre o comportamento crítico do helper. Recomenda-se rodar o spec `e2e/carrinhos/cart-item-undo.spec.ts` em plano separado quando desejado.

## 5. Gaps encontrados

| Severidade | Gap | Recomendação |
|---|---|---|
| 🔵 Info | Sem cobertura E2E da UX real (toast visível, timeout, multi-toast) | Criar spec Playwright em plano futuro |
| 🔵 Info | `showUndoToast` não desduplica se o mesmo item for removido→desfeito→removido novamente antes do timeout | Aceitável — cada ação gera um toast independente (padrão do repo) |
| 🔵 Info | `restoreItems` insere um novo `id` (não restaura o `id` original do item) — se algum consumidor observar o `id`, verá mudança | Comportamento herdado da mutation existente; documentado apenas |

**Nenhum gap 🔴/🟡.** Nenhuma alteração de produção recomendada.

## 6. Critério de sucesso

- ✅ 5/5 testes unitários passam
- ✅ 550/550 iterações fuzz passam
- ⏸ E2E: adiada (plano separado)
- ✅ Relatório entregue

---

**Conclusão:** feature aprovada. Snapshot é robusto contra nullables, mutações posteriores, cascata e múltiplos carts.
