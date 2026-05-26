# Auditoria Super Filtro — 26/05/2026

Auditoria exaustiva do módulo **Super Filtro** (`FiltersPage` + `useFiltersPageState` + `FilterPanel` e subcomponentes).

Bugs anteriores (BUG-01 a BUG-14, PR #471) permanecem resolvidos.

---

## BUG-15 — `featured`, `isNew`, `hasPersonalization` não filtram

**Arquivo:** `src/pages/filters/useFiltersPageState.ts`  
**Severidade:** Crítico  
**Tipo:** Lógica de filtro ausente

### Descrição

Os três filtros eram contabilizados em `activeFiltersCount`, exibidos como chips removíveis no cabeçalho e serializados na URL, mas o `filteredProducts` useMemo **nunca avaliava** as condições correspondentes.

- `filters.featured` → sem bloco `if` no useMemo
- `filters.isNew` → sem bloco `if` no useMemo; adicionalmente, o campo no tipo `Product` chama-se `newArrival` (não `isNew`)
- `filters.hasPersonalization` → sem bloco `if` no useMemo; campo **ausente** de `product-catalog.ts`, logo sempre `undefined === true` retornaria falso

### Impacto observável

O usuário ativa "Destaques" + "Novidades" + "Com Personalização", vê os chips ativos e o contador incrementado, mas o grid de produtos não muda.

### Fix aplicado

```typescript
// BUG-15a
if (filters.featured)
  result = result.filter((product) => product.featured === true);

// BUG-15b — campo Product é newArrival, não isNew
if (filters.isNew)
  result = result.filter((product) => product.newArrival === true);

// BUG-15c — hasPersonalization adicionado ao tipo Product
if (filters.hasPersonalization)
  result = result.filter((p) => p.hasPersonalization === true);
```

E em `src/types/product-catalog.ts`:
```typescript
hasPersonalization?: boolean | null;
```

---

## BUG-16 — `gender` não filtra no Super Filtro

**Arquivo:** `src/pages/filters/useFiltersPageState.ts`  
**Severidade:** Crítico  
**Tipo:** Lógica de filtro ausente

### Descrição

`filters.gender` era contabilizado, exibido como chip e serializável na URL, mas sem bloco de filtro correspondente no `filteredProducts` useMemo do Super Filtro.

Nota: `useCatalogFiltering.ts` (Catálogo) implementava corretamente via `genderFilterSet`. O Super Filtro nunca recebeu o port desta lógica.

### Fix aplicado

```typescript
if ((filters.gender || []).length > 0) {
  const genderSet = new Set((filters.gender || []).map((g) => g.toLowerCase().trim()));
  result = result.filter((product) =>
    genderSet.has((product.gender || '').toLowerCase().trim()),
  );
}
```

---

## BUG-17 — `sizes` não filtra no Super Filtro

**Arquivo:** `src/pages/filters/useFiltersPageState.ts`  
**Severidade:** Crítico  
**Tipo:** Lógica de filtro ausente

### Descrição

Filtro de tamanhos (`SizeFilter`) completamente funcional no painel lateral, mas sem lógica correspondente no pipeline de filtragem. O campo correto é `ProductVariation.size_code`.

### Fix aplicado

```typescript
if ((filters.sizes || []).length > 0) {
  const sizeSet = new Set(filters.sizes);
  result = result.filter(
    (product) =>
      product.variations?.some(
        (v) => v.size_code != null && sizeSet.has(v.size_code),
      ) ?? false,
  );
}
```

---

## BUG-18 — `techniques` e `tags` exibidos como ativos mas sem filtro

**Arquivo:** `src/pages/filters/useFiltersPageState.ts`  
**Severidade:** Médio  
**Tipo:** Filtro dependente de dados de associação (server-side)

### Descrição

Ambos os filtros dependem de tabelas de associação produto↔técnica e produto↔tag que não estão no payload lightweight de produtos. Filtrar client-side requer os IDs associados por produto.

### Ação tomada

TODO adicionado em comentário; chips e contagem mantidos. Resolução requer endpoint dedicado.

---

## BUG-19 — Stale closure no debouncedSearch effect

**Arquivo:** `src/components/filters/filter-panel/useFilterPanelState.ts`  
**Severidade:** Crítico  
**Tipo:** React — closure stale / dep array incorreto

### Descrição

```typescript
// BUG: deps ausentes
useEffect(() => {
  if (debouncedSearch !== filters.search) {
    onFilterChange({ ...filters, search: debouncedSearch }); // filters pode ser stale!
  }
}, [debouncedSearch]); // ← filters e onFilterChange ausentes
```

Cenário de falha:
1. Usuário digita "caneta" → debounce inicia (500ms)
2. Antes do timer expirar: usuário ativa "Em Estoque" → `filters.inStock = true`
3. Timer expira: effect usa `filters` antigo (inStock=false) → sobrescreve a mudança recente

### Fix aplicado

Padrão ref-estável (sem criar dep instável):

```typescript
const filtersRef = useRef<FilterState>(filters);
useEffect(() => { filtersRef.current = filters; });

const onFilterChangeRef = useRef<FilterPanelProps['onFilterChange']>(onFilterChange);
useEffect(() => { onFilterChangeRef.current = onFilterChange; });

useEffect(() => {
  if (debouncedSearch !== filtersRef.current.search) {
    onFilterChangeRef.current({ ...filtersRef.current, search: debouncedSearch });
  }
}, [debouncedSearch]); // refs são estáveis — sem dep instável
```

---

## BUG-20 — Fuzzy search usa URL param stale

**Arquivo:** `src/pages/filters/useFiltersPageState.ts`  
**Severidade:** Médio  
**Tipo:** Sincronização estado → URL

### Descrição

```typescript
// ANTES (bug):
const searchQuery = searchParams.get('search') || '';
const { results, hasSearch } = useProductFuzzySearch(realProducts, searchQuery);
```

Quando o usuário digita via `SmartSearchInput`:
1. `filters.search` = "foo" (imediato)
2. URL effect enfileirado → ainda não executou
3. `searchParams.get('search')` ainda = `''`
4. `hasFuzzySearch = false` → filtro substring roda erroneamente

### Fix aplicado

```typescript
// DEPOIS (fix):
const fuzzySearchQuery = filters.search || searchParams.get('search') || '';
const { results, hasSearch } = useProductFuzzySearch(realProducts, fuzzySearchQuery);
```

---

## BUG-21 — `useCatalogFiltering` priceRange usa `< 500`

**Arquivo:** `src/hooks/products/useCatalogFiltering.ts`  
**Severidade:** Crítico  
**Tipo:** Threshold errado

### Descrição

```typescript
// ANTES (bug): filtro não ativa para preços entre R$500 e R$9999
if (filters.priceRange[0] > 0 || filters.priceRange[1] < 500) {
```

Um usuário que define faixa "até R$800" recebe todos os produtos porque `800 < 500 === false`.

### Fix aplicado

```typescript
if (filters.priceRange[0] > 0 || filters.priceRange[1] < 9999) {
```

---

## BUG-22 — `useCatalogState.activeFiltersCount` usa `< 500`

**Arquivo:** `src/hooks/products/useCatalogState.ts`  
**Severidade:** Médio  
**Tipo:** Threshold errado

Mesma causa raiz do BUG-21. O badge de filtros ativos no Catálogo não contabilizava a faixa de preço entre R$500 e R$9999.

**Fix:** `< 500` → `< 9999`

---

## BUG-VOZ — `sortMap` incompleto no voice agent

**Arquivo:** `src/pages/products/FiltersPage.tsx`  
**Severidade:** Baixo  
**Tipo:** Mapeamento incompleto

`'best-seller-supplier'` e `'best-seller-promo'` ausentes do `sortMap` no handler de ações do voice agent.

---

## Resumo

| Bug | Severidade | Arquivo | Status |
|-----|-----------|---------|--------|
| BUG-15 | Crítico | useFiltersPageState + product-catalog | ✅ Corrigido |
| BUG-16 | Crítico | useFiltersPageState | ✅ Corrigido |
| BUG-17 | Crítico | useFiltersPageState | ✅ Corrigido |
| BUG-18 | Médio | useFiltersPageState | 📋 TODO (server-side) |
| BUG-19 | Crítico | useFilterPanelState | ✅ Corrigido |
| BUG-20 | Médio | useFiltersPageState | ✅ Corrigido |
| BUG-21 | Crítico | useCatalogFiltering | ✅ Corrigido |
| BUG-22 | Médio | useCatalogState | ✅ Corrigido |
| BUG-VOZ | Baixo | FiltersPage | ✅ Corrigido |
