# Etapa 13 — Refactor compare folder + descoberta dos dois tipos `Product`

**Data**: 2026-05-23
**Branch**: `refactor/tsc-baseline-etapa-13-compare-table-view`
**Escopo do plano**: Etapa 13 do plano 20 etapas (PR #124) — refatorar `CompareTableView.tsx` (26 erros TSC).
**Escopo executado**: 13 arquivos (compare folder inteira + página) — extensão justificada pela descoberta arquitetural abaixo.

---

## TL;DR

A "dívida" do `.tsc-baseline.json` no top-5 não é dívida de código — é **dois tipos `Product` distintos** convivendo no repo, com componentes importando do tipo errado. O fix é mecânico (trocar imports + remover escape hatches `Record<string, unknown>`), não estrutural.

Resultado: **−64 erros TSC** com 13 arquivos modificados, zero regressão, zero impacto runtime.

---

## A descoberta

O repo tem **dois arquivos de tipos `Product`**:

| Arquivo | Propósito | Estilo |
|---|---|---|
| `src/types/product.ts` | DB-oriented (modelo do Postgres) | snake_case (`is_kit`, `min_quantity`, `stock_status`, `category_name`), maioria `null`-able, sem objetos aninhados |
| `src/types/product-catalog.ts` | Runtime/UI (modelo após `mapPromobrindToProduct`) | camelCase (`isKit`, `minQuantity`, `stockStatus`), objetos aninhados (`category: {id, name}`, `supplier: {id, name}`, `tags: {publicoAlvo, datasComemorativas, ...}`), não-nullable |

O *runtime data* que flui pela aplicação é `product-catalog.Product` (origem: `useProducts()` que internamente chama `mapPromobrindToProduct(rawDB) -> product-catalog.Product`). `ProductsContext`, `useProducts` e `useSupplierComparison` já usam `product-catalog.Product`.

Mas **toda a pasta `src/components/compare/`** (7 arquivos) + `src/pages/products/ComparePage.tsx` importavam `Product` de `src/types/product.ts` (DB type). Por estrutural typing, o app rodava normal — mas o TSC reclamava de tudo.

### Sintoma típico

```ts
// Antes (em CompareTableView.tsx):
import type { Product } from "@/types/product";
// ...
p.isKit          // ❌ TS2551: Property 'isKit' does not exist on type 'Product'. Did you mean 'is_kit'?
p.minQuantity    // ❌ TS2551: Property 'minQuantity' does not exist...
p.category?.name // ❌ TS2339: Property 'category' does not exist on type 'Product'.
p.images[0]      // ❌ TS18047: 'entry.product.images' is possibly 'null'.
```

```ts
// Depois:
import type { Product } from "@/types/product-catalog";
// ...
p.isKit          // ✅ ok (boolean)
p.minQuantity    // ✅ ok (number)
p.category?.name // ✅ ok (string)
p.images[0]      // ✅ ok (string[] non-nullable)
```

Não foi necessário renomear nenhum acesso de `camelCase` → `snake_case` (como a doc original sugeria). O código já estava correto para o runtime — só o import estava errado.

### O escape hatch `Record<string, unknown>`

Vários componentes "fugiam" do problema declarando props como `Record<string, unknown>[]`, o que aceita qualquer coisa em tempo de compilação mas zera o type-safety interno:

```ts
// Antes (em StockRiskBadge.tsx):
interface Props {
  product: Record<string, unknown>;  // ❌ aceita qualquer coisa
}
// Internamente acessa product.minQuantity, product.stockStatus
// → TS não acusa, mas se algum dia o caller passar algo diferente, bug em produção.
```

```ts
// Depois:
import type { Product } from "@/types/product-catalog";
interface Props {
  product: Product;  // ✅ contratual
}
```

5 componentes do compare folder usavam esse escape: `StockRiskBadge`, `OtherSuppliersRow`, `ComparisonScoreCard`, `ExportComparisonButton`, `SimilarProductsRail`. Todos eliminados nesta PR.

### Campos que não existiam em nenhum tipo

Dois campos eram acessados sem existir em nenhum dos dois `Product`:

- `p.category?.icon` — não existe em `product-catalog.Product` (`category: {id, name}` apenas).
- `p.supplier?.verified` — idem (`supplier: {id, name}`).

Em runtime, ambos retornavam `undefined` (renderizavam vazio). UI behavior preservada removendo-os do JSX.

---

## Mudanças por arquivo

| Arquivo | Tipo de mudança | TSC erros (antes → depois) |
|---|---|---:|
| `src/components/compare/CompareTableView.tsx` | import switch + drop 2 campos JSX inexistentes + cleanup import órfão `ShieldCheck` | 26 → 0 |
| `src/components/compare/StockRiskBadge.tsx` | `Record<string, unknown>` → `Product` | 0 → 0 (preserva) |
| `src/components/compare/OtherSuppliersRow.tsx` | `Record<string, unknown>` → `Product`, remove `as any` | 0 → 0 (preserva) |
| `src/components/compare/ComparisonScoreCard.tsx` | `Record<string, unknown>` → `Product` | 2 → 0 |
| `src/components/compare/ExportComparisonButton.tsx` | `Record<string, unknown>` → `Product` | 2 → 0 |
| `src/components/compare/SimilarProductsRail.tsx` | `Record<string, unknown>` → `Product` | 5 → 4¹ |
| `src/components/compare/ComparisonPresentationLauncher.tsx` | import switch | 9 → 5² |
| `src/components/compare/ComparisonMobileView.tsx` | import switch | 5 → 0 |
| `src/components/compare/ComparisonDuelView.tsx` | import switch | 8 → 3³ |
| `src/components/compare/ComparisonRadarChart.tsx` | import switch | 2 → 0 |
| `src/components/compare/AIComparisonAdvisor.tsx` | import switch | 5 → 1⁴ |
| `src/components/compare/FloatingCompareBar.tsx` | import switch | 3 → 0 |
| `src/pages/products/ComparePage.tsx` | import switch | 10 → 0 |
| **Total** | **13 arquivos** | **77 → 13 (−64)** |

¹ SimilarProductsRail: 4 erros residuais são pré-existentes — inferência do TanStack Query em `useProducts()` retorna `never[] | NoInfer_2<TQueryFnData>`. Solução seria anotar explicitamente o destructure (`const { data: pool = [] }: { data?: Product[] }`). Fora de escopo de Etapa 13.

² PresentationLauncher: 5 residuais — 1× `ProductScore.items` que não existe (bug separado), 4× implicit any em callback `.reduce()`. Bugs reais não relacionados a tipos `Product`.

³ DuelView: 3 residuais — `p.leadTimeDays` não existe em nenhum dos dois tipos `Product`. Bug separado: precisa usar `leadTimeProxy(stockStatus)` como `CompareTableView` faz, ou estender o tipo.

⁴ AIAdvisor: 1 residual — `'message' does not exist on type '{}'` em resposta de query mal tipada. Bug separado.

---

## Validação

```bash
# TSC gate
$ npm run typecheck
TS baseline gate — atual: 1189 erros · baseline: 1189 erros
✅ Nenhuma regressão de TypeScript detectada.

# ESLint gate
$ npm run lint:baseline
# (1 drift pré-existente em src/pages/auth/AuthBranding.visual.test.tsx — não relacionado a esta PR)

# Build end-to-end
$ npm run build
✓ built in 1m 36s
```

Baseline `.tsc-baseline.json` regenerado: **1333 → 1189 erros** (320 → 289 arquivos).

---

## Impacto no plano de 20 etapas

A Etapa 13 do plano original (PR #124) está formalmente fechada com mais escopo do que estimado (13 arquivos vs 1). Implicações para etapas 10-12 (`AddressTab.tsx`, `BasicDataTab.tsx`, `AdminProductFormPage.tsx`):

- **Verificar primeiro** se os erros TSC são do mesmo padrão (import de `@/types/product` quando o componente espera o runtime `@/types/product-catalog`, ou vice-versa).
- Se for o mesmo padrão, a correção é mecânica (~5 min/arquivo).
- Se NÃO for o mesmo padrão, é refactor real — aí sim os ~3-4h/etapa estimados se justificam.

A **Etapa 9** (`price-response.adapter.ts`) é arquiteturalmente diferente — é um adapter que mistura formatos, não um componente UI. Trate separadamente.

---

## Próximos passos sugeridos (fora desta PR)

1. **Etapa 13.5 (sugerida)**: Unificar os dois tipos `Product`. Hoje a coexistência é uma armadilha que tropeça em todo refactor. Possível abordagem: deletar `src/types/product.ts`, redirecionar os 30+ consumers para `product-catalog`, gerar `src/types/product-db.ts` a partir do Supabase typegen para uso restrito ao mapper.
2. **Limpar os 4 residuais do TanStack Query** em `SimilarProductsRail.tsx` (e padrão semelhante em outros hooks): tipar destructures de `useQuery`.
3. **Estender `Product` com `category.icon` + `supplier.verified`** (se UI quiser esses campos no futuro) ou aceitar formalmente que não existem.

---

## Arquivos com escape hatch `Record<string, unknown>` removidos

Padrão que continua válido para futura caça: ainda existem outros componentes no repo com props tipadas como `Record<string, unknown>[]` — quase sempre são candidatos a substituição por um tipo real.

```bash
$ grep -rln "Record<string, unknown>\[\]" src/ | grep -v test
# (lista para futura limpeza arquitetural)
```
