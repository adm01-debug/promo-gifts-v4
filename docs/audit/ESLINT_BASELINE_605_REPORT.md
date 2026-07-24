# Relatório detalhado — 605 erros legados ESLint

**Data-base:** commit `5d9c12bb1` (snapshot original).
**Total:** 605 erros em 212 arquivos, 59 regras distintas.

---

## 🧭 Resumo executivo

| Categoria | Erros | % | Estratégia |
|---|---:|---:|---|
| ✅ **Auto-fixáveis** (ESLint `--fix` resolve) | 277 | 45.8% | Um comando: `xargs -a files.txt npx eslint --fix` |
| ⚙️ **Semi-automáticas** (script mecânico ou anotação em massa) | 202 | 33.4% | Scripts AST + `eslint-disable-next-line` justificado |
| 🔧 **Manuais** (julgamento contextual) | 151 | 25.0% | Refatoração caso-a-caso |

---

## 📏 Por regra

| Regra | Erros | Arqs | Classe | Descrição |
|---|---:|---:|:-:|---|
| `@typescript-eslint/require-await` | 94 | 27 | ⚙️ | Função `async` sem `await` |
| `@typescript-eslint/sort-type-constituents` | 92 | 61 | ✅ | Ordena membros de union/intersection types |
| `@typescript-eslint/no-unused-vars` | 42 | 24 | ⚙️ | Variáveis declaradas mas não usadas |
| `no-restricted-syntax` | 35 | 16 | 🔧 | Sintaxe proibida por regras de projeto (E2E, etc.) |
| `prefer-template` | 25 | 17 | ✅ | Substitui concatenação por template literals |
| `eqeqeq` | 24 | 12 | ⚙️ | Prefere `===` sobre `==` |
| `no-eq-null` | 24 | 12 | ⚙️ | Proíbe `== null` (idiomático!) |
| `@typescript-eslint/no-shadow` | 22 | 11 | 🔧 | Idem para TS |
| `no-shadow` | 22 | 11 | 🔧 | Variável com mesmo nome de outra do escopo externo |
| `no-promise-executor-return` | 22 | 9 | 🔧 | Executor de Promise não deve retornar valor |
| `unused-imports/no-unused-imports` | 18 | 12 | ✅ | Imports não utilizados |
| `no-duplicate-imports` | 18 | 18 | ⚙️ | Imports duplicados do mesmo módulo |
| `@typescript-eslint/consistent-type-imports` | 17 | 12 | ✅ | Uso de `import type` para tipos |
| `@typescript-eslint/prefer-regexp-exec` | 13 | 7 | ✅ | Prefere `RegExp.exec()` sobre `String.match()` |
| `@typescript-eslint/non-nullable-type-assertion-style` | 12 | 11 | ✅ | Prefere `x!` sobre `x as NonNullable<T>` |
| `react/jsx-closing-tag-location` | 11 | 5 | ✅ | Posição da tag JSX de fechamento |
| `@typescript-eslint/prefer-includes` | 11 | 7 | ✅ | Prefere `.includes()` sobre `.indexOf() !== -1` |
| `@typescript-eslint/require-array-sort-compare` | 10 | 3 | 🔧 | `sort()` sem função comparadora |
| `react-hooks/exhaustive-deps` | 8 | 8 | 🔧 | Deps de hooks incompletas |
| `import/first` | 8 | 7 | ✅ | Imports antes de outros statements |
| `@typescript-eslint/prefer-optional-chain` | 7 | 6 | ✅ | Prefere `a?.b?.c` em vez de `a && a.b && a.b.c` |
| `react/jsx-boolean-value` | 6 | 3 | ✅ | Booleanos JSX sem `={true}` |
| `react/jsx-props-no-multi-spaces` | 6 | 6 | ✅ | Espaços múltiplos entre props JSX |
| `@typescript-eslint/no-invalid-void-type` | 5 | 3 | 🔧 | `void` em posição inválida (union type) |
| `no-console` | 5 | 2 | 🔧 | Uso de `console.log` |
| `no-sync` | 4 | 1 | 🔧 | APIs síncronas de I/O em Node |
| `prefer-exponentiation-operator` | 4 | 4 | ✅ | Prefere `**` sobre `Math.pow()` |
| `react/jsx-closing-bracket-location` | 4 | 3 | ✅ | Posição do `>` de fechamento JSX |
| `logical-assignment-operators` | 4 | 3 | ✅ | Prefere `||=`, `&&=`, `??=` |
| `@typescript-eslint/no-explicit-any` | 4 | 3 | 🔧 | Tipo `any` explícito |
| `@typescript-eslint/naming-convention` | 4 | 3 | 🔧 | Convenção de nomes |
| `prefer-arrow-callback` | 4 | 4 | ✅ | Callbacks como arrow functions |
| `@typescript-eslint/prefer-readonly` | 3 | 3 | ✅ | Membros `private` que nunca são reatribuídos |
| `@typescript-eslint/prefer-promise-reject-errors` | 3 | 3 | 🔧 | `Promise.reject()` com Error, não string |
| `@typescript-eslint/dot-notation` | 3 | 2 | ✅ | Idem para TS |
| `dot-notation` | 3 | 2 | ✅ | Notação `.prop` em vez de `["prop"]` |
| `object-shorthand` | 2 | 1 | ✅ | Shorthand `{ foo }` em vez de `{ foo: foo }` |
| `no-unneeded-ternary` | 2 | 2 | ✅ | Ternário redundante |
| `@typescript-eslint/no-unnecessary-template-expression` | 2 | 2 | ✅ | Template literal desnecessário |
| `@typescript-eslint/return-await` | 2 | 2 | ✅ | Consistência em `return await` |
| `prefer-const` | 2 | 1 | ✅ | `let` que nunca reatribuído deve ser `const` |
| `block-spacing` | 2 | 1 | ✅ | Espaço dentro de `{ }` |
| `jsx-a11y/role-supports-aria-props` | 2 | 2 | 🔧 | aria-* incompatível com role |
| `@typescript-eslint/no-unnecessary-type-arguments` | 2 | 1 | ✅ | Argumento de tipo redundante |
| `react/jsx-first-prop-new-line` | 2 | 2 | ✅ | Primeira prop JSX em nova linha |
| `@typescript-eslint/method-signature-style` | 2 | 1 | ✅ | Assinatura de método `foo(): void` vs `foo: () => void` |
| `@typescript-eslint/no-meaningless-void-operator` | 1 | 1 | ✅ | `void` sobre expressão que já retorna void |
| `jsx-a11y/aria-role` | 1 | 1 | 🔧 | role ARIA inválido |
| `@typescript-eslint/no-loop-func` | 1 | 1 | 🔧 | Função criada dentro de loop capturando var |
| `no-self-compare` | 1 | 1 | 🔧 | Comparação de variável consigo mesma |
| `no-void` | 1 | 1 | ✅ | Operador `void` sem propósito |
| `no-whitespace-before-property` | 1 | 1 | ✅ | Espaço antes de `.prop` |
| `react/state-in-constructor` | 1 | 1 | ✅ | Posição do `state` em class components |
| `jsx-a11y/no-redundant-roles` | 1 | 1 | 🔧 | role redundante em elemento semântico |
| `no-multi-assign` | 1 | 1 | 🔧 | Atribuição encadeada `a = b = c` |
| `@typescript-eslint/no-useless-constructor` | 1 | 1 | ✅ | Idem para TS |
| `no-useless-constructor` | 1 | 1 | ✅ | Construtor vazio inútil |
| `@typescript-eslint/consistent-generic-constructors` | 1 | 1 | ✅ | Consistência em `new Map<K,V>()` vs `Map<K,V> = new Map()` |
| `no-lonely-if` | 1 | 1 | ✅ | `if` solitário dentro de `else` |

---

## 📂 Top 30 arquivos por volume

| # | Arquivo | Erros | Regras (nº ocorrências) |
|---:|---|---:|---|
| 1 | `src/pages/magazine/__tests__/useMagazineEditor.staleRef.test.ts` | 28 | `require-await`×23, `no-shadow`×2, `no-shadow`×2, `no-duplicate-imports`×1 |
| 2 | `src/pages/magazine/hooks/__tests__/useMagazineReaderState.test.ts` | 27 | `require-await`×13, `no-promise-executor-return`×10, `require-array-sort-compare`×2, `prefer-regexp-exec`×1, `no-multi-assign`×1 |
| 3 | `src/components/quotes/__tests__/QuoteBuilderSummaryCollapseAll.fuzz.test.ts` | 16 | `no-shadow`×7, `no-shadow`×7, `prefer-readonly`×1, `no-self-compare`×1 |
| 4 | `src/components/products/__tests__/ColorSwatchInlineSelect.exhaustive.test.tsx` | 13 | `no-restricted-syntax`×5, `jsx-closing-tag-location`×4, `jsx-closing-bracket-location`×2, `no-duplicate-imports`×1, `jsx-boolean-value`×1 |
| 5 | `src/pages/quotes/__tests__/useQuotesListPage.test.ts` | 13 | `require-array-sort-compare`×7, `require-await`×3, `no-unused-vars`×1, `no-duplicate-imports`×1, `no-unused-imports`×1 |
| 6 | `src/pages/quotes/QuoteBuilderPage.tsx` | 11 | `no-unused-vars`×5, `no-unused-imports`×5, `jsx-closing-tag-location`×1 |
| 7 | `src/hooks/products/useSellerCarts.ts` | 9 | `eqeqeq`×4, `no-eq-null`×4, `no-promise-executor-return`×1 |
| 8 | `src/pages/magazine/PublicMagazineView.tsx` | 9 | `eqeqeq`×2, `no-eq-null`×2, `no-shadow`×1, `prefer-optional-chain`×1, `sort-type-constituents`×1, `no-shadow`×1, `exhaustive-deps`×1 |
| 9 | `src/pages/magazine/__tests__/publishAwait.regression.test.ts` | 9 | `require-await`×7, `no-duplicate-imports`×1, `no-promise-executor-return`×1 |
| 10 | `src/pages/products/seller-carts/__tests__/CartHeader.invariants.fuzz.test.ts` | 9 | `no-shadow`×4, `no-shadow`×4, `no-unused-vars`×1 |
| 11 | `src/pages/quotes/__tests__/useQuotesListPage.expiring.test.ts` | 9 | `require-await`×6, `non-nullable-type-assertion-style`×1, `require-array-sort-compare`×1, `no-duplicate-imports`×1 |
| 12 | `src/pages/magazine/components/MagazineMiniMap.tsx` | 8 | `eqeqeq`×3, `no-eq-null`×3, `prefer-arrow-callback`×1, `prefer-template`×1 |
| 13 | `src/pages/magazine/components/templates/chrome.tsx` | 8 | `sort-type-constituents`×8 |
| 14 | `src/components/quotes/QuoteItemsList.tsx` | 7 | `no-unused-vars`×4, `no-unused-imports`×2, `aria-role`×1 |
| 15 | `src/components/quotes/__tests__/PdfGenerationDialog.exhaustive.test.tsx` | 7 | `no-restricted-syntax`×3, `require-await`×2, `no-loop-func`×1, `sort-type-constituents`×1 |
| 16 | `src/lib/supabase/rest-client.ts` | 7 | `no-explicit-any`×2, `no-console`×2, `dot-notation`×1, `no-unused-vars`×1, `dot-notation`×1 |
| 17 | `src/pages/products/seller-carts/CartHeaderActions.tsx` | 7 | `no-unused-vars`×7 |
| 18 | `src/components/common/__tests__/IntelligenceBadges.adversarial.test.tsx` | 6 | `no-restricted-syntax`×6 |
| 19 | `src/hooks/auth/__tests__/login-flow.test.ts` | 6 | `no-promise-executor-return`×3, `no-unused-vars`×2, `require-await`×1 |
| 20 | `src/hooks/products/useProductMatch.ts` | 6 | `eqeqeq`×3, `no-eq-null`×3 |
| 21 | `src/lib/telemetry/navigationMetrics.ts` | 6 | `sort-type-constituents`×3, `naming-convention`×1, `eqeqeq`×1, `no-eq-null`×1 |
| 22 | `src/pages/magazine/hooks/__tests__/useMagazineGoldImport.test.ts` | 6 | `no-promise-executor-return`×3, `require-await`×2, `sort-type-constituents`×1 |
| 23 | `src/pages/products/CartsListPage.tsx` | 6 | `no-unused-vars`×1, `sort-type-constituents`×1, `role-supports-aria-props`×1, `no-unneeded-ternary`×1, `exhaustive-deps`×1, `jsx-props-no-multi-spaces`×1 |
| 24 | `src/pages/products/__tests__/CartHeaderExhaustiveFuzz.test.ts` | 6 | `prefer-template`×3, `prefer-regexp-exec`×2, `sort-type-constituents`×1 |
| 25 | `src/components/dashboard/MyDiscountRequestsWidget.tsx` | 5 | `eqeqeq`×2, `no-eq-null`×2, `sort-type-constituents`×1 |
| 26 | `src/components/pdf/__tests__/PropostaComercialTailwind.watermark.regression.test.tsx` | 5 | `jsx-boolean-value`×3, `no-restricted-syntax`×2 |
| 27 | `src/components/products/__tests__/ColorSwatchTwoLineOverflow.test.tsx` | 5 | `no-restricted-syntax`×2, `prefer-template`×2, `non-nullable-type-assertion-style`×1 |
| 28 | `src/components/products/customization/__tests__/ConfigurationPanelV6.size-line-layout.test.tsx` | 5 | `require-await`×3, `non-nullable-type-assertion-style`×1, `logical-assignment-operators`×1 |
| 29 | `src/components/quotes/QuotesConfigurableList.tsx` | 5 | `no-unused-vars`×2, `jsx-closing-tag-location`×2, `no-unnecessary-template-expression`×1 |
| 30 | `src/hooks/products/__tests__/useSellerCarts.updateItemQuantity.rollback.test.tsx` | 5 | `require-await`×2, `no-shadow`×1, `sort-type-constituents`×1, `no-shadow`×1 |

---

## 📋 Inventário completo por arquivo (212)

<details><summary>Expandir lista completa</summary>

| Arquivo | Erros | Regras |
|---|---:|---|
| `src/pages/magazine/__tests__/useMagazineEditor.staleRef.test.ts` | 28 | `@typescript-eslint/require-await`×23, `@typescript-eslint/no-shadow`×2, `no-shadow`×2, `no-duplicate-imports`×1 |
| `src/pages/magazine/hooks/__tests__/useMagazineReaderState.test.ts` | 27 | `@typescript-eslint/require-await`×13, `no-promise-executor-return`×10, `@typescript-eslint/require-array-sort-compare`×2, `@typescript-eslint/prefer-regexp-exec`×1, `no-multi-assign`×1 |
| `src/components/quotes/__tests__/QuoteBuilderSummaryCollapseAll.fuzz.test.ts` | 16 | `@typescript-eslint/no-shadow`×7, `no-shadow`×7, `@typescript-eslint/prefer-readonly`×1, `no-self-compare`×1 |
| `src/components/products/__tests__/ColorSwatchInlineSelect.exhaustive.test.tsx` | 13 | `no-restricted-syntax`×5, `react/jsx-closing-tag-location`×4, `react/jsx-closing-bracket-location`×2, `no-duplicate-imports`×1, `react/jsx-boolean-value`×1 |
| `src/pages/quotes/__tests__/useQuotesListPage.test.ts` | 13 | `@typescript-eslint/require-array-sort-compare`×7, `@typescript-eslint/require-await`×3, `@typescript-eslint/no-unused-vars`×1, `no-duplicate-imports`×1, `unused-imports/no-unused-imports`×1 |
| `src/pages/quotes/QuoteBuilderPage.tsx` | 11 | `@typescript-eslint/no-unused-vars`×5, `unused-imports/no-unused-imports`×5, `react/jsx-closing-tag-location`×1 |
| `src/hooks/products/useSellerCarts.ts` | 9 | `eqeqeq`×4, `no-eq-null`×4, `no-promise-executor-return`×1 |
| `src/pages/magazine/PublicMagazineView.tsx` | 9 | `eqeqeq`×2, `no-eq-null`×2, `@typescript-eslint/no-shadow`×1, `@typescript-eslint/prefer-optional-chain`×1, `@typescript-eslint/sort-type-constituents`×1, `no-shadow`×1, `react-hooks/exhaustive-deps`×1 |
| `src/pages/magazine/__tests__/publishAwait.regression.test.ts` | 9 | `@typescript-eslint/require-await`×7, `no-duplicate-imports`×1, `no-promise-executor-return`×1 |
| `src/pages/products/seller-carts/__tests__/CartHeader.invariants.fuzz.test.ts` | 9 | `@typescript-eslint/no-shadow`×4, `no-shadow`×4, `@typescript-eslint/no-unused-vars`×1 |
| `src/pages/quotes/__tests__/useQuotesListPage.expiring.test.ts` | 9 | `@typescript-eslint/require-await`×6, `@typescript-eslint/non-nullable-type-assertion-style`×1, `@typescript-eslint/require-array-sort-compare`×1, `no-duplicate-imports`×1 |
| `src/pages/magazine/components/MagazineMiniMap.tsx` | 8 | `eqeqeq`×3, `no-eq-null`×3, `prefer-arrow-callback`×1, `prefer-template`×1 |
| `src/pages/magazine/components/templates/chrome.tsx` | 8 | `@typescript-eslint/sort-type-constituents`×8 |
| `src/components/quotes/QuoteItemsList.tsx` | 7 | `@typescript-eslint/no-unused-vars`×4, `unused-imports/no-unused-imports`×2, `jsx-a11y/aria-role`×1 |
| `src/components/quotes/__tests__/PdfGenerationDialog.exhaustive.test.tsx` | 7 | `no-restricted-syntax`×3, `@typescript-eslint/require-await`×2, `@typescript-eslint/no-loop-func`×1, `@typescript-eslint/sort-type-constituents`×1 |
| `src/lib/supabase/rest-client.ts` | 7 | `@typescript-eslint/no-explicit-any`×2, `no-console`×2, `@typescript-eslint/dot-notation`×1, `@typescript-eslint/no-unused-vars`×1, `dot-notation`×1 |
| `src/pages/products/seller-carts/CartHeaderActions.tsx` | 7 | `@typescript-eslint/no-unused-vars`×7 |
| `src/components/common/__tests__/IntelligenceBadges.adversarial.test.tsx` | 6 | `no-restricted-syntax`×6 |
| `src/hooks/auth/__tests__/login-flow.test.ts` | 6 | `no-promise-executor-return`×3, `@typescript-eslint/no-unused-vars`×2, `@typescript-eslint/require-await`×1 |
| `src/hooks/products/useProductMatch.ts` | 6 | `eqeqeq`×3, `no-eq-null`×3 |
| `src/lib/telemetry/navigationMetrics.ts` | 6 | `@typescript-eslint/sort-type-constituents`×3, `@typescript-eslint/naming-convention`×1, `eqeqeq`×1, `no-eq-null`×1 |
| `src/pages/magazine/hooks/__tests__/useMagazineGoldImport.test.ts` | 6 | `no-promise-executor-return`×3, `@typescript-eslint/require-await`×2, `@typescript-eslint/sort-type-constituents`×1 |
| `src/pages/products/CartsListPage.tsx` | 6 | `@typescript-eslint/no-unused-vars`×1, `@typescript-eslint/sort-type-constituents`×1, `jsx-a11y/role-supports-aria-props`×1, `no-unneeded-ternary`×1, `react-hooks/exhaustive-deps`×1, `react/jsx-props-no-multi-spaces`×1 |
| `src/pages/products/__tests__/CartHeaderExhaustiveFuzz.test.ts` | 6 | `prefer-template`×3, `@typescript-eslint/prefer-regexp-exec`×2, `@typescript-eslint/sort-type-constituents`×1 |
| `src/components/dashboard/MyDiscountRequestsWidget.tsx` | 5 | `eqeqeq`×2, `no-eq-null`×2, `@typescript-eslint/sort-type-constituents`×1 |
| `src/components/pdf/__tests__/PropostaComercialTailwind.watermark.regression.test.tsx` | 5 | `react/jsx-boolean-value`×3, `no-restricted-syntax`×2 |
| `src/components/products/__tests__/ColorSwatchTwoLineOverflow.test.tsx` | 5 | `no-restricted-syntax`×2, `prefer-template`×2, `@typescript-eslint/non-nullable-type-assertion-style`×1 |
| `src/components/products/customization/__tests__/ConfigurationPanelV6.size-line-layout.test.tsx` | 5 | `@typescript-eslint/require-await`×3, `@typescript-eslint/non-nullable-type-assertion-style`×1, `logical-assignment-operators`×1 |
| `src/components/quotes/QuotesConfigurableList.tsx` | 5 | `@typescript-eslint/no-unused-vars`×2, `react/jsx-closing-tag-location`×2, `@typescript-eslint/no-unnecessary-template-expression`×1 |
| `src/hooks/products/__tests__/useSellerCarts.updateItemQuantity.rollback.test.tsx` | 5 | `@typescript-eslint/require-await`×2, `@typescript-eslint/no-shadow`×1, `@typescript-eslint/sort-type-constituents`×1, `no-shadow`×1 |
| `src/pages/magazine/hooks/useMagazineReaderState.ts` | 5 | `no-console`×3, `@typescript-eslint/prefer-promise-reject-errors`×1, `@typescript-eslint/sort-type-constituents`×1 |
| `src/pages/quotes/__tests__/useQuotesListPage.fuzz.test.ts` | 5 | `@typescript-eslint/require-await`×3, `@typescript-eslint/non-nullable-type-assertion-style`×1, `no-duplicate-imports`×1 |
| `src/services/__tests__/magazineEdgeContract.test.ts` | 5 | `@typescript-eslint/dot-notation`×2, `dot-notation`×2, `@typescript-eslint/require-await`×1 |
| `src/services/__tests__/quoteReorderAutosaveRace.test.ts` | 5 | `@typescript-eslint/consistent-generic-constructors`×1, `@typescript-eslint/no-shadow`×1, `no-promise-executor-return`×1, `no-restricted-syntax`×1, `no-shadow`×1 |
| `src/types/magazine.ts` | 5 | `@typescript-eslint/sort-type-constituents`×5 |
| `src/utils/cnpj-errors.ts` | 5 | `@typescript-eslint/sort-type-constituents`×2, `@typescript-eslint/prefer-includes`×1, `eqeqeq`×1, `no-eq-null`×1 |
| `src/utils/undoToast.tsx` | 5 | `@typescript-eslint/sort-type-constituents`×3, `@typescript-eslint/no-invalid-void-type`×2 |
| `src/components/cart/__tests__/CartLimitExhaustive.test.tsx` | 4 | `no-sync`×4 |
| `src/components/quotes/PdfGenerationDialog.tsx` | 4 | `react/jsx-closing-tag-location`×2, `@typescript-eslint/sort-type-constituents`×1, `react-hooks/exhaustive-deps`×1 |
| `src/components/quotes/QuotesStatusChips.tsx` | 4 | `eqeqeq`×2, `no-eq-null`×2 |
| `src/components/quotes/__tests__/PdfGenerationDialog.print.test.tsx` | 4 | `@typescript-eslint/require-await`×4 |
| `src/hooks/admin/useV4Callbacks.ts` | 4 | `@typescript-eslint/sort-type-constituents`×3, `@typescript-eslint/no-explicit-any`×1 |
| `src/hooks/products/useDebouncedCartItemActions.ts` | 4 | `@typescript-eslint/no-unnecessary-type-arguments`×2, `eqeqeq`×1, `no-eq-null`×1 |
| `src/lib/supabase/rls-validator.ts` | 4 | `@typescript-eslint/no-unused-vars`×3, `@typescript-eslint/sort-type-constituents`×1 |
| `src/pages/magazine/hooks/usePageZoom.ts` | 4 | `eqeqeq`×2, `no-eq-null`×2 |
| `src/pages/magazine/hooks/usePresentationMode.ts` | 4 | `eqeqeq`×2, `no-eq-null`×2 |
| `src/pages/products/SellerCartsPage.tsx` | 4 | `@typescript-eslint/no-unused-vars`×2, `unused-imports/no-unused-imports`×2 |
| `src/pages/products/seller-carts/__tests__/CartHeader.contract-snapshot.test.ts` | 4 | `@typescript-eslint/no-shadow`×2, `no-shadow`×2 |
| `src/pages/products/seller-carts/cartViewModePrefs.ts` | 4 | `@typescript-eslint/method-signature-style`×2, `@typescript-eslint/sort-type-constituents`×2 |
| `src/pages/quotes/__tests__/QuotesListPage.fab.focus.test.tsx` | 4 | `@typescript-eslint/consistent-type-imports`×2, `@typescript-eslint/no-useless-constructor`×1, `no-useless-constructor`×1 |
| `src/pages/quotes/__tests__/useQuotesListPage.bulkDelete.test.tsx` | 4 | `@typescript-eslint/require-await`×3, `@typescript-eslint/consistent-type-imports`×1 |
| `src/services/__tests__/quoteNumberConcurrency.test.ts` | 4 | `@typescript-eslint/naming-convention`×2, `@typescript-eslint/prefer-readonly`×1, `no-promise-executor-return`×1 |
| `src/utils/__tests__/cnpj-fuzz-helpers.ts` | 4 | `prefer-template`×3, `@typescript-eslint/sort-type-constituents`×1 |
| `src/components/admin/__tests__/DiscountApprovalHeaderBadge.test.tsx` | 3 | `object-shorthand`×2, `@typescript-eslint/consistent-type-imports`×1 |
| `src/components/admin/telemetry/QuoteBuilderHandoffCard.tsx` | 3 | `@typescript-eslint/no-shadow`×1, `no-shadow`×1, `react-hooks/exhaustive-deps`×1 |
| `src/components/cart/CartHeaderButton.tsx` | 3 | `@typescript-eslint/no-unused-vars`×1, `no-unneeded-ternary`×1, `unused-imports/no-unused-imports`×1 |
| `src/components/cart/__tests__/CartItemErrorAlert.test.tsx` | 3 | `react/jsx-boolean-value`×2, `no-duplicate-imports`×1 |
| `src/components/pdf/proposal/__tests__/ProposalProductTable.adversarial.test.tsx` | 3 | `@typescript-eslint/no-shadow`×1, `@typescript-eslint/prefer-regexp-exec`×1, `no-shadow`×1 |
| `src/components/products/__tests__/ColorSwatchOverflowChip.test.tsx` | 3 | `prefer-template`×2, `no-duplicate-imports`×1 |
| `src/components/products/__tests__/ProductCustomizationOptions.summary-color.fuzz.test.ts` | 3 | `@typescript-eslint/prefer-includes`×3 |
| `src/components/products/customization/__tests__/ConfigurationPanelV6.collapse.test.tsx` | 3 | `@typescript-eslint/prefer-includes`×2, `import/first`×1 |
| `src/components/products/customization/__tests__/ConfigurationPanelV6.confirmed-title.test.tsx` | 3 | `@typescript-eslint/require-await`×3 |
| `src/components/products/customization/__tests__/ConfigurationPanelV6.header-snapshot.test.tsx` | 3 | `@typescript-eslint/require-await`×3 |
| `src/components/quotes/PdfPrintHelpDialog.tsx` | 3 | `@typescript-eslint/sort-type-constituents`×2, `prefer-template`×1 |
| `src/components/quotes/QuoteBuilderSummaryColumn.tsx` | 3 | `react/jsx-closing-tag-location`×2, `react/jsx-props-no-multi-spaces`×1 |
| `src/components/quotes/QuoteItemDetailSheet.tsx` | 3 | `@typescript-eslint/no-unnecessary-template-expression`×1, `@typescript-eslint/no-unused-vars`×1, `unused-imports/no-unused-imports`×1 |
| `src/components/quotes/__tests__/QuoteBuilderSummaryColumn.collapsedHeader.test.ts` | 3 | `@typescript-eslint/prefer-regexp-exec`×3 |
| `src/components/quotes/__tests__/QuotesConfigurableList.selection.test.tsx` | 3 | `block-spacing`×2, `no-restricted-syntax`×1 |
| `src/hooks/customization/__tests__/useCustomizationCollapsePrefs.test.ts` | 3 | `@typescript-eslint/require-await`×3 |
| `src/hooks/products/__tests__/useDebouncedCartItemActions.test.tsx` | 3 | `@typescript-eslint/no-invalid-void-type`×2, `@typescript-eslint/sort-type-constituents`×1 |
| `src/hooks/products/useProductCustomizationOptions.ts` | 3 | `@typescript-eslint/sort-type-constituents`×2, `@typescript-eslint/prefer-optional-chain`×1 |
| `src/hooks/quotes/useDiscountApproval.ts` | 3 | `@typescript-eslint/no-shadow`×1, `no-shadow`×1, `no-void`×1 |
| `src/lib/product-bounds-detector.ts` | 3 | `prefer-template`×2, `@typescript-eslint/naming-convention`×1 |
| `src/lib/quotes/discount-validation-messages.ts` | 3 | `@typescript-eslint/sort-type-constituents`×3 |
| `src/lib/quotes/personalizationSummary.ts` | 3 | `logical-assignment-operators`×2, `@typescript-eslint/prefer-optional-chain`×1 |
| `src/pages/magazine/useMagazineEditor.ts` | 3 | `@typescript-eslint/no-shadow`×1, `no-shadow`×1, `react-hooks/exhaustive-deps`×1 |
| `src/pages/products/__tests__/CartNotesLeakGuards.test.tsx` | 3 | `prefer-template`×2, `@typescript-eslint/prefer-includes`×1 |
| `src/pages/products/seller-carts/__tests__/CartStatusSelect.emptyCart.test.tsx` | 3 | `@typescript-eslint/sort-type-constituents`×2, `import/first`×1 |
| `src/pages/products/seller-carts/mapRestoreCartError.ts` | 3 | `@typescript-eslint/prefer-includes`×2, `@typescript-eslint/sort-type-constituents`×1 |
| `src/pages/quotes/__tests__/QuoteConditions.left-align.test.ts` | 3 | `@typescript-eslint/prefer-regexp-exec`×3 |
| `src/components/admin/DiscountApprovalAuditTrail.tsx` | 2 | `@typescript-eslint/sort-type-constituents`×2 |
| `src/components/admin/products/ProductVariantsSection.tsx` | 2 | `@typescript-eslint/no-unused-vars`×1, `unused-imports/no-unused-imports`×1 |
| `src/components/admin/products/kit-components/ProductKitComponentsSection.tsx` | 2 | `@typescript-eslint/no-unused-vars`×1, `unused-imports/no-unused-imports`×1 |
| `src/components/audit/__tests__/AuditHistory.a11y.test.tsx` | 2 | `@typescript-eslint/consistent-type-imports`×1, `no-restricted-syntax`×1 |
| `src/components/cart/__tests__/PopoverQtyInput.fastcheck.test.ts` | 2 | `@typescript-eslint/no-unused-vars`×1, `unused-imports/no-unused-imports`×1 |
| `src/components/cart/__tests__/SortableCartItemVariant.test.tsx` | 2 | `no-restricted-syntax`×2 |
| `src/components/inventory/__tests__/StockAlertsIndicator.width.test.ts` | 2 | `@typescript-eslint/prefer-regexp-exec`×2 |
| `src/components/products/__tests__/swatchSizing.test.ts` | 2 | `no-restricted-syntax`×2 |
| `src/components/products/customization/LocationPanel.tsx` | 2 | `@typescript-eslint/no-unused-vars`×1, `unused-imports/no-unused-imports`×1 |
| `src/components/quotes/QuoteItemsTable.tsx` | 2 | `@typescript-eslint/no-unused-vars`×1, `react/jsx-props-no-multi-spaces`×1 |
| `src/components/quotes/__tests__/PdfGenerationDialog.footerButton.test.tsx` | 2 | `@typescript-eslint/require-await`×1, `@typescript-eslint/return-await`×1 |
| `src/components/quotes/__tests__/PdfGenerationDialog.headerWarning.test.tsx` | 2 | `@typescript-eslint/require-await`×1, `prefer-template`×1 |
| `src/components/quotes/__tests__/QuoteBuilderActionButtons.fuzz.test.ts` | 2 | `prefer-const`×2 |
| `src/components/quotes/__tests__/QuoteBuilderStepper.test.tsx` | 2 | `no-restricted-syntax`×2 |
| `src/components/ui/calendar.tsx` | 2 | `@typescript-eslint/consistent-type-imports`×1, `react/jsx-props-no-multi-spaces`×1 |
| `src/components/ui/date-picker-field.tsx` | 2 | `@typescript-eslint/sort-type-constituents`×1, `jsx-a11y/role-supports-aria-props`×1 |
| `src/contexts/SellerCartContext.tsx` | 2 | `@typescript-eslint/sort-type-constituents`×1, `prefer-template`×1 |
| `src/contexts/__tests__/SellerCartContext.okNoMetrics.test.tsx` | 2 | `@typescript-eslint/no-explicit-any`×1, `@typescript-eslint/require-await`×1 |
| `src/contexts/__tests__/SellerCartContext.restoreTelemetry.test.tsx` | 2 | `@typescript-eslint/require-await`×2 |
| `src/hooks/common/usePrefetchOnHover.ts` | 2 | `@typescript-eslint/no-invalid-void-type`×1, `@typescript-eslint/sort-type-constituents`×1 |
| `src/hooks/products/__tests__/useSellerCarts.emptyCartGuard.test.tsx` | 2 | `import/first`×2 |
| `src/hooks/quotes/__tests__/discountApprovalFlow.test.ts` | 2 | `@typescript-eslint/require-await`×2 |
| `src/lib/carts/shipping-deadline.ts` | 2 | `@typescript-eslint/sort-type-constituents`×2 |
| `src/lib/quotes/__tests__/collapsedItemsStorage.fuzz.test.ts` | 2 | `eqeqeq`×1, `no-eq-null`×1 |
| `src/lib/quotes/__tests__/exportDiscountAuditPdf.test.ts` | 2 | `no-restricted-syntax`×2 |
| `src/lib/quotes/exportDiscountAuditPdf.ts` | 2 | `@typescript-eslint/sort-type-constituents`×2 |
| `src/lib/telemetry/quoteStatusTelemetry.ts` | 2 | `@typescript-eslint/sort-type-constituents`×2 |
| `src/pages/magazine/MagazineEditorPage.tsx` | 2 | `@typescript-eslint/no-unused-vars`×1, `unused-imports/no-unused-imports`×1 |
| `src/pages/magazine/components/PreviewSidebar.tsx` | 2 | `@typescript-eslint/sort-type-constituents`×2 |
| `src/pages/magazine/components/PublicMagazineToc.tsx` | 2 | `jsx-a11y/no-redundant-roles`×1, `prefer-arrow-callback`×1 |
| `src/pages/magazine/components/steps/DesignStep.tsx` | 2 | `@typescript-eslint/sort-type-constituents`×2 |
| `src/pages/magazine/components/steps/ProductsStep.tsx` | 2 | `@typescript-eslint/no-unused-vars`×1, `unused-imports/no-unused-imports`×1 |
| `src/pages/magazine/components/templates/TemplateRegistry.ts` | 2 | `@typescript-eslint/sort-type-constituents`×2 |
| `src/pages/magazine/components/templates/catalog/ListTemplate.tsx` | 2 | `react/jsx-closing-bracket-location`×1, `react/jsx-first-prop-new-line`×1 |
| `src/pages/magazine/components/templates/editorial/EditorialManifestoTemplate.tsx` | 2 | `react/jsx-closing-bracket-location`×1, `react/jsx-first-prop-new-line`×1 |
| `src/pages/magazine/hooks/useMagazineGoldImport.ts` | 2 | `@typescript-eslint/prefer-optional-chain`×1, `@typescript-eslint/prefer-promise-reject-errors`×1 |
| `src/pages/magazine/utils/contrast.ts` | 2 | `@typescript-eslint/sort-type-constituents`×1, `prefer-exponentiation-operator`×1 |
| `src/pages/products/__tests__/CartHeaderEdgeCases.test.ts` | 2 | `@typescript-eslint/sort-type-constituents`×1, `prefer-template`×1 |
| `src/pages/products/__tests__/CartNotesInternalOnly.test.ts` | 2 | `@typescript-eslint/prefer-regexp-exec`×1, `prefer-template`×1 |
| `src/pages/products/seller-carts/__tests__/CartStatusSelect.test.tsx` | 2 | `@typescript-eslint/sort-type-constituents`×1, `import/first`×1 |
| `src/pages/quotes/__tests__/QuoteConditions.viewports.test.tsx` | 2 | `@typescript-eslint/non-nullable-type-assertion-style`×2 |
| `src/pages/quotes/__tests__/QuotesListPage.deleteDisabled.test.tsx` | 2 | `@typescript-eslint/consistent-type-imports`×2 |
| `src/pages/quotes/__tests__/QuotesListPage.fab.test.tsx` | 2 | `@typescript-eslint/consistent-type-imports`×2 |
| `src/pages/quotes/__tests__/QuotesListPage.layout.test.tsx` | 2 | `@typescript-eslint/consistent-type-imports`×2 |
| `src/pages/quotes/__tests__/QuotesListPage.render.test.tsx` | 2 | `@typescript-eslint/consistent-type-imports`×2 |
| `src/pages/quotes/__tests__/conditions-collapse-persistence.test.ts` | 2 | `no-restricted-syntax`×2 |
| `src/pages/quotes/__tests__/quote-builder-freight-block-fuzz.test.tsx` | 2 | `@typescript-eslint/non-nullable-type-assertion-style`×1, `@typescript-eslint/sort-type-constituents`×1 |
| `src/pages/quotes/quote-view/QuotePromoChampionsSync.ts` | 2 | `@typescript-eslint/prefer-optional-chain`×2 |
| `src/utils/__tests__/cnpj-errors.matrix.test.ts` | 2 | `no-restricted-syntax`×2 |
| `src/components/admin/DiscountApprovalFilterBar.tsx` | 1 | `@typescript-eslint/sort-type-constituents`×1 |
| `src/components/cart/PopoverQtyInput.tsx` | 1 | `@typescript-eslint/sort-type-constituents`×1 |
| `src/components/cart/__tests__/CartStatusChip.label.test.tsx` | 1 | `@typescript-eslint/non-nullable-type-assertion-style`×1 |
| `src/components/cart/__tests__/PopoverQtyInput.exhaustive.test.tsx` | 1 | `prefer-template`×1 |
| `src/components/common/BulkActionsBar.tsx` | 1 | `@typescript-eslint/no-unused-vars`×1 |
| `src/components/common/ConfirmDialog.tsx` | 1 | `@typescript-eslint/sort-type-constituents`×1 |
| `src/components/pdf/__tests__/pdfHardcodedColors.test.ts` | 1 | `prefer-template`×1 |
| `src/components/pdf/proposal/__tests__/ProposalProductTable.visualContrast.test.tsx` | 1 | `prefer-exponentiation-operator`×1 |
| `src/components/pdf/proposal/__tests__/pdfContrastReport.test.ts` | 1 | `prefer-exponentiation-operator`×1 |
| `src/components/pdf/watermarkTokens.ts` | 1 | `prefer-exponentiation-operator`×1 |
| `src/components/products/ProductCard.tsx` | 1 | `react/jsx-props-no-multi-spaces`×1 |
| `src/components/products/ProductColorSwatches.tsx` | 1 | `react/jsx-props-no-multi-spaces`×1 |
| `src/components/products/__tests__/ColorSwatchUnboundedWrap.test.tsx` | 1 | `prefer-template`×1 |
| `src/components/products/customization/ConfigurationPanelV6.tsx` | 1 | `@typescript-eslint/no-meaningless-void-operator`×1 |
| `src/components/quotes/__tests__/CompanyContactSelector.layout.test.tsx` | 1 | `@typescript-eslint/non-nullable-type-assertion-style`×1 |
| `src/components/quotes/__tests__/PdfGenerationDialog.a11y.test.tsx` | 1 | `@typescript-eslint/require-await`×1 |
| `src/components/quotes/__tests__/QuoteBuilderSummaryAlignment.fuzz.test.ts` | 1 | `@typescript-eslint/no-unused-vars`×1 |
| `src/components/quotes/__tests__/QuoteBuilderSummaryColumn.saveDraft.test.tsx` | 1 | `no-promise-executor-return`×1 |
| `src/components/quotes/__tests__/QuoteStatusTimeline.states.test.tsx` | 1 | `@typescript-eslint/require-await`×1 |
| `src/components/security/useSecurityData.ts` | 1 | `react-hooks/exhaustive-deps`×1 |
| `src/components/shared/CompanyListAvatar.tsx` | 1 | `@typescript-eslint/sort-type-constituents`×1 |
| `src/components/ui/__tests__/ConfirmDialog.keyboard.test.tsx` | 1 | `@typescript-eslint/sort-type-constituents`×1 |
| `src/components/ui/__tests__/OptimizedImage.test.tsx` | 1 | `@typescript-eslint/prefer-readonly`×1 |
| `src/components/ui/__tests__/calendar.dimensions.test.tsx` | 1 | `@typescript-eslint/prefer-includes`×1 |
| `src/components/ui/__tests__/calendar.redesign.test.tsx` | 1 | `@typescript-eslint/prefer-includes`×1 |
| `src/contexts/__tests__/SellerCartContext.deleteRestoreTelemetry.test.tsx` | 1 | `@typescript-eslint/require-await`×1 |
| `src/contexts/__tests__/SellerCartContext.restorePointer.test.tsx` | 1 | `@typescript-eslint/consistent-type-imports`×1 |
| `src/contexts/__tests__/SellerCartContext.restoreRpc.test.tsx` | 1 | `@typescript-eslint/require-await`×1 |
| `src/hooks/auth/useProfileRoles.ts` | 1 | `@typescript-eslint/prefer-promise-reject-errors`×1 |
| `src/hooks/collections/useCollections.ts` | 1 | `react-hooks/exhaustive-deps`×1 |
| `src/hooks/common/__tests__/useListUrlState.fuzz.test.tsx` | 1 | `no-duplicate-imports`×1 |
| `src/hooks/common/__tests__/useListUrlState.test.tsx` | 1 | `no-duplicate-imports`×1 |
| `src/hooks/quotes/quoteHelpers.ts` | 1 | `@typescript-eslint/prefer-optional-chain`×1 |
| `src/hooks/quotes/quoteTypes.ts` | 1 | `@typescript-eslint/sort-type-constituents`×1 |
| `src/hooks/ui/useWorkspaceNotifications.tsx` | 1 | `react-hooks/exhaustive-deps`×1 |
| `src/lib/__tests__/quote-status-transitions.matrix.test.ts` | 1 | `no-whitespace-before-property`×1 |
| `src/lib/carts/status-transition-guard.ts` | 1 | `@typescript-eslint/sort-type-constituents`×1 |
| `src/lib/quotes/__tests__/collapsedItemsStorage.test.ts` | 1 | `no-restricted-syntax`×1 |
| `src/lib/quotes/expiration.ts` | 1 | `@typescript-eslint/sort-type-constituents`×1 |
| `src/lib/sentry.ts` | 1 | `@typescript-eslint/sort-type-constituents`×1 |
| `src/lib/telemetry/__tests__/navigationMetrics.test.ts` | 1 | `@typescript-eslint/return-await`×1 |
| `src/pages/__visual/QuoteViewOrderHarness.tsx` | 1 | `logical-assignment-operators`×1 |
| `src/pages/admin/DiscountRequestDetailPage.tsx` | 1 | `@typescript-eslint/sort-type-constituents`×1 |
| `src/pages/auth/Auth.tsx` | 1 | `no-promise-executor-return`×1 |
| `src/pages/dev/ConfirmDialogHarness.tsx` | 1 | `@typescript-eslint/sort-type-constituents`×1 |
| `src/pages/magazine/MagazineListPage.tsx` | 1 | `@typescript-eslint/sort-type-constituents`×1 |
| `src/pages/magazine/__tests__/pagination.property.test.ts` | 1 | `no-duplicate-imports`×1 |
| `src/pages/magazine/__tests__/pagination.test.ts` | 1 | `no-duplicate-imports`×1 |
| `src/pages/magazine/__tests__/stepValidation.matrix.test.ts` | 1 | `no-duplicate-imports`×1 |
| `src/pages/magazine/__tests__/stepValidation.test.ts` | 1 | `no-duplicate-imports`×1 |
| `src/pages/magazine/components/EditorHero.tsx` | 1 | `@typescript-eslint/sort-type-constituents`×1 |
| `src/pages/magazine/components/KeyboardHelpOverlay.tsx` | 1 | `prefer-arrow-callback`×1 |
| `src/pages/magazine/components/MagazineCardThumbnail.tsx` | 1 | `prefer-arrow-callback`×1 |
| `src/pages/magazine/components/MagazineErrorBoundary.tsx` | 1 | `react/state-in-constructor`×1 |
| `src/pages/magazine/components/MagazinePageRenderer.tsx` | 1 | `@typescript-eslint/sort-type-constituents`×1 |
| `src/pages/magazine/components/__tests__/EditorHero.test.tsx` | 1 | `@typescript-eslint/no-unused-vars`×1 |
| `src/pages/magazine/components/steps/ContentStep.tsx` | 1 | `@typescript-eslint/sort-type-constituents`×1 |
| `src/pages/magazine/components/steps/LayoutStep.tsx` | 1 | `no-duplicate-imports`×1 |
| `src/pages/magazine/components/templates/shared.ts` | 1 | `prefer-template`×1 |
| `src/pages/magazine/utils/stepValidation.ts` | 1 | `@typescript-eslint/sort-type-constituents`×1 |
| `src/pages/products/seller-carts/__tests__/CartStatusSelect.contract.test.tsx` | 1 | `import/first`×1 |
| `src/pages/products/seller-carts/__tests__/CartStatusSelect.fuzz.test.tsx` | 1 | `import/first`×1 |
| `src/pages/products/seller-carts/__tests__/CartStatusSelect.timeout.test.tsx` | 1 | `import/first`×1 |
| `src/pages/products/seller-carts/bulkRestoreSummary.ts` | 1 | `@typescript-eslint/sort-type-constituents`×1 |
| `src/pages/quotes/QuoteViewPage.tsx` | 1 | `no-duplicate-imports`×1 |
| `src/pages/quotes/QuotesListPage.tsx` | 1 | `@typescript-eslint/no-unused-vars`×1 |
| `src/pages/quotes/__tests__/QuoteConditions.delivery-freight-left-align.test.tsx` | 1 | `@typescript-eslint/non-nullable-type-assertion-style`×1 |
| `src/pages/quotes/__tests__/QuoteConditions.stable-testids.test.tsx` | 1 | `@typescript-eslint/non-nullable-type-assertion-style`×1 |
| `src/pages/quotes/__tests__/QuoteViewPage.preview-breath.test.tsx` | 1 | `no-restricted-syntax`×1 |
| `src/pages/quotes/__tests__/quote-builder-freight-block-hierarchy.rtl.test.tsx` | 1 | `@typescript-eslint/sort-type-constituents`×1 |
| `src/pages/quotes/__tests__/quote-builder-freight-block.rtl.test.tsx` | 1 | `@typescript-eslint/sort-type-constituents`×1 |
| `src/pages/quotes/__tests__/useQuotesListPage.duplicateUndo.test.tsx` | 1 | `@typescript-eslint/consistent-type-imports`×1 |
| `src/pages/quotes/__tests__/useQuotesListPage.singleDelete.test.tsx` | 1 | `@typescript-eslint/consistent-type-imports`×1 |
| `src/pages/quotes/__tests__/useQuotesListPage.urlState.test.tsx` | 1 | `no-duplicate-imports`×1 |
| `src/pages/quotes/components/DeliveryModeToggle.tsx` | 1 | `@typescript-eslint/sort-type-constituents`×1 |
| `src/pages/quotes/components/__tests__/DeliveryModeToggle.test.tsx` | 1 | `@typescript-eslint/require-await`×1 |
| `src/services/__tests__/quoteServiceVariantSkuHydration.test.ts` | 1 | `@typescript-eslint/sort-type-constituents`×1 |
| `src/services/magazineService.ts` | 1 | `no-duplicate-imports`×1 |
| `src/utils/__tests__/quote-number.exhaustive.test.ts` | 1 | `@typescript-eslint/sort-type-constituents`×1 |
| `src/utils/__tests__/quote-number.null-cases.test.ts` | 1 | `@typescript-eslint/sort-type-constituents`×1 |
| `src/utils/__tests__/undoToast.stress.test.tsx` | 1 | `no-lonely-if`×1 |
| `src/utils/cnpj-schema.test.ts` | 1 | `@typescript-eslint/non-nullable-type-assertion-style`×1 |
| `src/utils/imageProxy.ts` | 1 | `prefer-template`×1 |

</details>

---

## 🔎 Detalhamento das 10 regras mais volumosas


### ⚙️ `@typescript-eslint/require-await` — 94 erros em 27 arquivos
**Classe:** semiauto · **Descrição:** Função `async` sem `await`

| Arquivo | Erros |
|---|---:|
| `src/pages/magazine/__tests__/useMagazineEditor.staleRef.test.ts` | 23 |
| `src/pages/magazine/hooks/__tests__/useMagazineReaderState.test.ts` | 13 |
| `src/pages/magazine/__tests__/publishAwait.regression.test.ts` | 7 |
| `src/pages/quotes/__tests__/useQuotesListPage.expiring.test.ts` | 6 |
| `src/components/quotes/__tests__/PdfGenerationDialog.print.test.tsx` | 4 |
| `src/components/products/customization/__tests__/ConfigurationPanelV6.confirmed-title.test.tsx` | 3 |
| `src/components/products/customization/__tests__/ConfigurationPanelV6.header-snapshot.test.tsx` | 3 |
| `src/components/products/customization/__tests__/ConfigurationPanelV6.size-line-layout.test.tsx` | 3 |
| `src/hooks/customization/__tests__/useCustomizationCollapsePrefs.test.ts` | 3 |
| `src/pages/quotes/__tests__/useQuotesListPage.bulkDelete.test.tsx` | 3 |
| `src/pages/quotes/__tests__/useQuotesListPage.fuzz.test.ts` | 3 |
| `src/pages/quotes/__tests__/useQuotesListPage.test.ts` | 3 |
| `src/components/quotes/__tests__/PdfGenerationDialog.exhaustive.test.tsx` | 2 |
| `src/contexts/__tests__/SellerCartContext.restoreTelemetry.test.tsx` | 2 |
| `src/hooks/products/__tests__/useSellerCarts.updateItemQuantity.rollback.test.tsx` | 2 |
| `src/hooks/quotes/__tests__/discountApprovalFlow.test.ts` | 2 |
| `src/pages/magazine/hooks/__tests__/useMagazineGoldImport.test.ts` | 2 |
| `src/components/quotes/__tests__/PdfGenerationDialog.a11y.test.tsx` | 1 |
| `src/components/quotes/__tests__/PdfGenerationDialog.footerButton.test.tsx` | 1 |
| `src/components/quotes/__tests__/PdfGenerationDialog.headerWarning.test.tsx` | 1 |
| `src/components/quotes/__tests__/QuoteStatusTimeline.states.test.tsx` | 1 |
| `src/contexts/__tests__/SellerCartContext.deleteRestoreTelemetry.test.tsx` | 1 |
| `src/contexts/__tests__/SellerCartContext.okNoMetrics.test.tsx` | 1 |
| `src/contexts/__tests__/SellerCartContext.restoreRpc.test.tsx` | 1 |
| `src/hooks/auth/__tests__/login-flow.test.ts` | 1 |
| `src/pages/quotes/components/__tests__/DeliveryModeToggle.test.tsx` | 1 |
| `src/services/__tests__/magazineEdgeContract.test.ts` | 1 |

### ✅ `@typescript-eslint/sort-type-constituents` — 92 erros em 61 arquivos
**Classe:** autofix · **Descrição:** Ordena membros de union/intersection types

| Arquivo | Erros |
|---|---:|
| `src/pages/magazine/components/templates/chrome.tsx` | 8 |
| `src/types/magazine.ts` | 5 |
| `src/hooks/admin/useV4Callbacks.ts` | 3 |
| `src/lib/quotes/discount-validation-messages.ts` | 3 |
| `src/lib/telemetry/navigationMetrics.ts` | 3 |
| `src/utils/undoToast.tsx` | 3 |
| `src/components/admin/DiscountApprovalAuditTrail.tsx` | 2 |
| `src/components/quotes/PdfPrintHelpDialog.tsx` | 2 |
| `src/hooks/products/useProductCustomizationOptions.ts` | 2 |
| `src/lib/carts/shipping-deadline.ts` | 2 |
| `src/lib/quotes/exportDiscountAuditPdf.ts` | 2 |
| `src/lib/telemetry/quoteStatusTelemetry.ts` | 2 |
| `src/pages/magazine/components/PreviewSidebar.tsx` | 2 |
| `src/pages/magazine/components/steps/DesignStep.tsx` | 2 |
| `src/pages/magazine/components/templates/TemplateRegistry.ts` | 2 |
| `src/pages/products/seller-carts/__tests__/CartStatusSelect.emptyCart.test.tsx` | 2 |
| `src/pages/products/seller-carts/cartViewModePrefs.ts` | 2 |
| `src/utils/cnpj-errors.ts` | 2 |
| `src/components/admin/DiscountApprovalFilterBar.tsx` | 1 |
| `src/components/cart/PopoverQtyInput.tsx` | 1 |
| `src/components/common/ConfirmDialog.tsx` | 1 |
| `src/components/dashboard/MyDiscountRequestsWidget.tsx` | 1 |
| `src/components/quotes/PdfGenerationDialog.tsx` | 1 |
| `src/components/quotes/__tests__/PdfGenerationDialog.exhaustive.test.tsx` | 1 |
| `src/components/shared/CompanyListAvatar.tsx` | 1 |
| `src/components/ui/__tests__/ConfirmDialog.keyboard.test.tsx` | 1 |
| `src/components/ui/date-picker-field.tsx` | 1 |
| `src/contexts/SellerCartContext.tsx` | 1 |
| `src/hooks/common/usePrefetchOnHover.ts` | 1 |
| `src/hooks/products/__tests__/useDebouncedCartItemActions.test.tsx` | 1 |
| `src/hooks/products/__tests__/useSellerCarts.updateItemQuantity.rollback.test.tsx` | 1 |
| `src/hooks/quotes/quoteTypes.ts` | 1 |
| `src/lib/carts/status-transition-guard.ts` | 1 |
| `src/lib/quotes/expiration.ts` | 1 |
| `src/lib/sentry.ts` | 1 |
| `src/lib/supabase/rls-validator.ts` | 1 |
| `src/pages/admin/DiscountRequestDetailPage.tsx` | 1 |
| `src/pages/dev/ConfirmDialogHarness.tsx` | 1 |
| `src/pages/magazine/MagazineListPage.tsx` | 1 |
| `src/pages/magazine/PublicMagazineView.tsx` | 1 |
| `src/pages/magazine/components/EditorHero.tsx` | 1 |
| `src/pages/magazine/components/MagazinePageRenderer.tsx` | 1 |
| `src/pages/magazine/components/steps/ContentStep.tsx` | 1 |
| `src/pages/magazine/hooks/__tests__/useMagazineGoldImport.test.ts` | 1 |
| `src/pages/magazine/hooks/useMagazineReaderState.ts` | 1 |
| `src/pages/magazine/utils/contrast.ts` | 1 |
| `src/pages/magazine/utils/stepValidation.ts` | 1 |
| `src/pages/products/CartsListPage.tsx` | 1 |
| `src/pages/products/__tests__/CartHeaderEdgeCases.test.ts` | 1 |
| `src/pages/products/__tests__/CartHeaderExhaustiveFuzz.test.ts` | 1 |
| `src/pages/products/seller-carts/__tests__/CartStatusSelect.test.tsx` | 1 |
| `src/pages/products/seller-carts/bulkRestoreSummary.ts` | 1 |
| `src/pages/products/seller-carts/mapRestoreCartError.ts` | 1 |
| `src/pages/quotes/__tests__/quote-builder-freight-block-fuzz.test.tsx` | 1 |
| `src/pages/quotes/__tests__/quote-builder-freight-block-hierarchy.rtl.test.tsx` | 1 |
| `src/pages/quotes/__tests__/quote-builder-freight-block.rtl.test.tsx` | 1 |
| `src/pages/quotes/components/DeliveryModeToggle.tsx` | 1 |
| `src/services/__tests__/quoteServiceVariantSkuHydration.test.ts` | 1 |
| `src/utils/__tests__/cnpj-fuzz-helpers.ts` | 1 |
| `src/utils/__tests__/quote-number.exhaustive.test.ts` | 1 |
| `src/utils/__tests__/quote-number.null-cases.test.ts` | 1 |

### ⚙️ `@typescript-eslint/no-unused-vars` — 42 erros em 24 arquivos
**Classe:** semiauto · **Descrição:** Variáveis declaradas mas não usadas

| Arquivo | Erros |
|---|---:|
| `src/pages/products/seller-carts/CartHeaderActions.tsx` | 7 |
| `src/pages/quotes/QuoteBuilderPage.tsx` | 5 |
| `src/components/quotes/QuoteItemsList.tsx` | 4 |
| `src/lib/supabase/rls-validator.ts` | 3 |
| `src/components/quotes/QuotesConfigurableList.tsx` | 2 |
| `src/hooks/auth/__tests__/login-flow.test.ts` | 2 |
| `src/pages/products/SellerCartsPage.tsx` | 2 |
| `src/components/admin/products/ProductVariantsSection.tsx` | 1 |
| `src/components/admin/products/kit-components/ProductKitComponentsSection.tsx` | 1 |
| `src/components/cart/CartHeaderButton.tsx` | 1 |
| `src/components/cart/__tests__/PopoverQtyInput.fastcheck.test.ts` | 1 |
| `src/components/common/BulkActionsBar.tsx` | 1 |
| `src/components/products/customization/LocationPanel.tsx` | 1 |
| `src/components/quotes/QuoteItemDetailSheet.tsx` | 1 |
| `src/components/quotes/QuoteItemsTable.tsx` | 1 |
| `src/components/quotes/__tests__/QuoteBuilderSummaryAlignment.fuzz.test.ts` | 1 |
| `src/lib/supabase/rest-client.ts` | 1 |
| `src/pages/magazine/MagazineEditorPage.tsx` | 1 |
| `src/pages/magazine/components/__tests__/EditorHero.test.tsx` | 1 |
| `src/pages/magazine/components/steps/ProductsStep.tsx` | 1 |
| `src/pages/products/CartsListPage.tsx` | 1 |
| `src/pages/products/seller-carts/__tests__/CartHeader.invariants.fuzz.test.ts` | 1 |
| `src/pages/quotes/QuotesListPage.tsx` | 1 |
| `src/pages/quotes/__tests__/useQuotesListPage.test.ts` | 1 |

### 🔧 `no-restricted-syntax` — 35 erros em 16 arquivos
**Classe:** manual · **Descrição:** Sintaxe proibida por regras de projeto (E2E, etc.)

| Arquivo | Erros |
|---|---:|
| `src/components/common/__tests__/IntelligenceBadges.adversarial.test.tsx` | 6 |
| `src/components/products/__tests__/ColorSwatchInlineSelect.exhaustive.test.tsx` | 5 |
| `src/components/quotes/__tests__/PdfGenerationDialog.exhaustive.test.tsx` | 3 |
| `src/components/cart/__tests__/SortableCartItemVariant.test.tsx` | 2 |
| `src/components/pdf/__tests__/PropostaComercialTailwind.watermark.regression.test.tsx` | 2 |
| `src/components/products/__tests__/ColorSwatchTwoLineOverflow.test.tsx` | 2 |
| `src/components/products/__tests__/swatchSizing.test.ts` | 2 |
| `src/components/quotes/__tests__/QuoteBuilderStepper.test.tsx` | 2 |
| `src/lib/quotes/__tests__/exportDiscountAuditPdf.test.ts` | 2 |
| `src/pages/quotes/__tests__/conditions-collapse-persistence.test.ts` | 2 |
| `src/utils/__tests__/cnpj-errors.matrix.test.ts` | 2 |
| `src/components/audit/__tests__/AuditHistory.a11y.test.tsx` | 1 |
| `src/components/quotes/__tests__/QuotesConfigurableList.selection.test.tsx` | 1 |
| `src/lib/quotes/__tests__/collapsedItemsStorage.test.ts` | 1 |
| `src/pages/quotes/__tests__/QuoteViewPage.preview-breath.test.tsx` | 1 |
| `src/services/__tests__/quoteReorderAutosaveRace.test.ts` | 1 |

### ✅ `prefer-template` — 25 erros em 17 arquivos
**Classe:** autofix · **Descrição:** Substitui concatenação por template literals

| Arquivo | Erros |
|---|---:|
| `src/pages/products/__tests__/CartHeaderExhaustiveFuzz.test.ts` | 3 |
| `src/utils/__tests__/cnpj-fuzz-helpers.ts` | 3 |
| `src/components/products/__tests__/ColorSwatchOverflowChip.test.tsx` | 2 |
| `src/components/products/__tests__/ColorSwatchTwoLineOverflow.test.tsx` | 2 |
| `src/lib/product-bounds-detector.ts` | 2 |
| `src/pages/products/__tests__/CartNotesLeakGuards.test.tsx` | 2 |
| `src/components/cart/__tests__/PopoverQtyInput.exhaustive.test.tsx` | 1 |
| `src/components/pdf/__tests__/pdfHardcodedColors.test.ts` | 1 |
| `src/components/products/__tests__/ColorSwatchUnboundedWrap.test.tsx` | 1 |
| `src/components/quotes/PdfPrintHelpDialog.tsx` | 1 |
| `src/components/quotes/__tests__/PdfGenerationDialog.headerWarning.test.tsx` | 1 |
| `src/contexts/SellerCartContext.tsx` | 1 |
| `src/pages/magazine/components/MagazineMiniMap.tsx` | 1 |
| `src/pages/magazine/components/templates/shared.ts` | 1 |
| `src/pages/products/__tests__/CartHeaderEdgeCases.test.ts` | 1 |
| `src/pages/products/__tests__/CartNotesInternalOnly.test.ts` | 1 |
| `src/utils/imageProxy.ts` | 1 |

### ⚙️ `eqeqeq` — 24 erros em 12 arquivos
**Classe:** semiauto · **Descrição:** Prefere `===` sobre `==`

| Arquivo | Erros |
|---|---:|
| `src/hooks/products/useSellerCarts.ts` | 4 |
| `src/hooks/products/useProductMatch.ts` | 3 |
| `src/pages/magazine/components/MagazineMiniMap.tsx` | 3 |
| `src/components/dashboard/MyDiscountRequestsWidget.tsx` | 2 |
| `src/components/quotes/QuotesStatusChips.tsx` | 2 |
| `src/pages/magazine/PublicMagazineView.tsx` | 2 |
| `src/pages/magazine/hooks/usePageZoom.ts` | 2 |
| `src/pages/magazine/hooks/usePresentationMode.ts` | 2 |
| `src/hooks/products/useDebouncedCartItemActions.ts` | 1 |
| `src/lib/quotes/__tests__/collapsedItemsStorage.fuzz.test.ts` | 1 |
| `src/lib/telemetry/navigationMetrics.ts` | 1 |
| `src/utils/cnpj-errors.ts` | 1 |

### ⚙️ `no-eq-null` — 24 erros em 12 arquivos
**Classe:** semiauto · **Descrição:** Proíbe `== null` (idiomático!)

| Arquivo | Erros |
|---|---:|
| `src/hooks/products/useSellerCarts.ts` | 4 |
| `src/hooks/products/useProductMatch.ts` | 3 |
| `src/pages/magazine/components/MagazineMiniMap.tsx` | 3 |
| `src/components/dashboard/MyDiscountRequestsWidget.tsx` | 2 |
| `src/components/quotes/QuotesStatusChips.tsx` | 2 |
| `src/pages/magazine/PublicMagazineView.tsx` | 2 |
| `src/pages/magazine/hooks/usePageZoom.ts` | 2 |
| `src/pages/magazine/hooks/usePresentationMode.ts` | 2 |
| `src/hooks/products/useDebouncedCartItemActions.ts` | 1 |
| `src/lib/quotes/__tests__/collapsedItemsStorage.fuzz.test.ts` | 1 |
| `src/lib/telemetry/navigationMetrics.ts` | 1 |
| `src/utils/cnpj-errors.ts` | 1 |

### 🔧 `@typescript-eslint/no-shadow` — 22 erros em 11 arquivos
**Classe:** manual · **Descrição:** Idem para TS

| Arquivo | Erros |
|---|---:|
| `src/components/quotes/__tests__/QuoteBuilderSummaryCollapseAll.fuzz.test.ts` | 7 |
| `src/pages/products/seller-carts/__tests__/CartHeader.invariants.fuzz.test.ts` | 4 |
| `src/pages/magazine/__tests__/useMagazineEditor.staleRef.test.ts` | 2 |
| `src/pages/products/seller-carts/__tests__/CartHeader.contract-snapshot.test.ts` | 2 |
| `src/components/admin/telemetry/QuoteBuilderHandoffCard.tsx` | 1 |
| `src/components/pdf/proposal/__tests__/ProposalProductTable.adversarial.test.tsx` | 1 |
| `src/hooks/products/__tests__/useSellerCarts.updateItemQuantity.rollback.test.tsx` | 1 |
| `src/hooks/quotes/useDiscountApproval.ts` | 1 |
| `src/pages/magazine/PublicMagazineView.tsx` | 1 |
| `src/pages/magazine/useMagazineEditor.ts` | 1 |
| `src/services/__tests__/quoteReorderAutosaveRace.test.ts` | 1 |

### 🔧 `no-shadow` — 22 erros em 11 arquivos
**Classe:** manual · **Descrição:** Variável com mesmo nome de outra do escopo externo

| Arquivo | Erros |
|---|---:|
| `src/components/quotes/__tests__/QuoteBuilderSummaryCollapseAll.fuzz.test.ts` | 7 |
| `src/pages/products/seller-carts/__tests__/CartHeader.invariants.fuzz.test.ts` | 4 |
| `src/pages/magazine/__tests__/useMagazineEditor.staleRef.test.ts` | 2 |
| `src/pages/products/seller-carts/__tests__/CartHeader.contract-snapshot.test.ts` | 2 |
| `src/components/admin/telemetry/QuoteBuilderHandoffCard.tsx` | 1 |
| `src/components/pdf/proposal/__tests__/ProposalProductTable.adversarial.test.tsx` | 1 |
| `src/hooks/products/__tests__/useSellerCarts.updateItemQuantity.rollback.test.tsx` | 1 |
| `src/hooks/quotes/useDiscountApproval.ts` | 1 |
| `src/pages/magazine/PublicMagazineView.tsx` | 1 |
| `src/pages/magazine/useMagazineEditor.ts` | 1 |
| `src/services/__tests__/quoteReorderAutosaveRace.test.ts` | 1 |

### 🔧 `no-promise-executor-return` — 22 erros em 9 arquivos
**Classe:** manual · **Descrição:** Executor de Promise não deve retornar valor

| Arquivo | Erros |
|---|---:|
| `src/pages/magazine/hooks/__tests__/useMagazineReaderState.test.ts` | 10 |
| `src/hooks/auth/__tests__/login-flow.test.ts` | 3 |
| `src/pages/magazine/hooks/__tests__/useMagazineGoldImport.test.ts` | 3 |
| `src/components/quotes/__tests__/QuoteBuilderSummaryColumn.saveDraft.test.tsx` | 1 |
| `src/hooks/products/useSellerCarts.ts` | 1 |
| `src/pages/auth/Auth.tsx` | 1 |
| `src/pages/magazine/__tests__/publishAwait.regression.test.ts` | 1 |
| `src/services/__tests__/quoteNumberConcurrency.test.ts` | 1 |
| `src/services/__tests__/quoteReorderAutosaveRace.test.ts` | 1 |

---

## 🗺️ Roadmap sugerido (ondas)


| Onda | Escopo | Erros previstos | Método |
|---|---|---:|---|
| 1 | Todas as regras `autofix` | ~285 | `xargs npx eslint --fix` em massa |
| 2 | `no-duplicate-imports` + `@typescript-eslint/consistent-type-imports` (partes sem autofix) | ~35 | Script AST que funde imports |
| 3 | `eqeqeq` + `no-eq-null` (idiomáticos) | 48 | Anotação `eslint-disable-next-line` para `== null`/`!= null` legítimos |
| 4 | `@typescript-eslint/require-await` | 94 | Anotar mocks/testes; remover `async` onde a assinatura permitir |
| 5 | `no-unused-vars` restante | ~24 | Prefixar `_` em params requeridos, remover locais |
| 6 | `no-shadow` × 2 | 44 | Renomear identificadores internos |
| 7 | `no-restricted-syntax` | 35 | `eslint-disable` justificado em E2E onde `page.goto` é necessário |
| 8 | `no-promise-executor-return` | 22 | Envolver `resolve()` em bloco `{}` |
| 9 | `require-array-sort-compare` | 10 | Adicionar comparador `(a,b) => a-b` ou `.localeCompare()` |
| 10 | `react-hooks/exhaustive-deps` | 8 | Adicionar deps ou disable com justificativa por hook |
| 11 | Cauda longa (~40 erros em 20+ regras) | ~40 | Caso-a-caso |

---

## 📈 Progresso já realizado

Ondas 1–4 executadas em sessão anterior:

| Marco | Erros | Redução |
|---|---:|---:|
| Snapshot inicial | 605 | — |
| Pós-Onda 1 (autofix) | 350 | −255 |
| Pós-Onda 1b (merge dup-imports) | 332 | −18 |
| Pós-Onda 2 (eqeqeq/no-eq-null) | 313 | −19 |
| Pós-Onda 3 (require-await) | **196** | −117 |

**Total reduzido: 409 erros (−67,6%).**

Remanescente: **196 erros / 91 arquivos** — inventário em `.eslint-baseline.json` atual.
