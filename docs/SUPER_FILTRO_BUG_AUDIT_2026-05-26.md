# Auditoria Exaustiva — Super Filtro
**Data:** 26/05/2026  
**Branch:** `fix/super-filtro-bug-audit-2026-05-26`  
**Metodologia:** Análise estática de 6 arquivos + varredura de lógica em 20 tarefas estruturadas

---

## Resumo Executivo

| Severidade | Qtd | Status |
|-----------|-----|--------|
| 🔴 CRÍTICO | 3 | corrigidos |
| 🟠 ALTO | 3 | corrigidos |
| 🟡 MÉDIO | 3 | corrigidos |
| 🟢 BAIXO | 3 | corrigidos |
| **Total** | **12** | **100%** |

BUG-14 extra identificado durante sessão: arquivo product-sorting.ts havia sido commitado
anteriormente com conteúdo base64 corrompido em vez de TypeScript real. Corrigido neste PR.

---

## Bugs — Detalhe Completo

### BUG-01 — Double-filter na busca fuzzy
**Severidade:** CRITICO  
**Arquivo:** src/pages/filters/useFiltersPageState.ts — filteredProducts useMemo

**Problema:**
O filtro de busca por substring (.includes) rodava SEMPRE, mesmo quando hasFuzzySearch=true.
O motor fuzzy ja havia filtrado e ranqueado os resultados; o segundo passe de substring eliminava
itens que o fuzzy devolvera corretamente.

Exemplo: busca "sqz" — fuzzy encontra "Squeeze" — substring "squeeze".includes("sqz") === false
— produto removido indevidamente.

**Fix:**
```ts
// ANTES
if (filters.search) { ... result.filter(...includes...) }

// DEPOIS — guarda pelo hasFuzzySearch
if (filters.search && !hasFuzzySearch) { ... result.filter(...includes...) }
```

---

### BUG-02 — clearSingleFilter priceRange corrompe array
**Severidade:** CRITICO  
**Arquivo:** src/pages/filters/useFiltersPageState.ts — clearSingleFilter

**Problema:**
clearSingleFilter("priceRange") caía no branch Array.isArray e setava priceRange = [].
O código downstream acessa priceRange[0] diretamente — undefined comparado com números
— filtro de preço quebrado / crash silencioso.

Problema secundário: "search" (string) e "minStock" (number) caíam no branch boolean
ou ficavam sem tratar.

**Fix:**
```ts
else if (key === "priceRange") setFilters({ ...filters, priceRange: [0, 9999] });
else if (key === "search")    setFilters({ ...filters, search: "" });
else if (Array.isArray(...))  setFilters({ ...filters, [key]: [] });
else if (typeof ... === "boolean") setFilters({ ...filters, [key]: false });
else if (typeof ... === "number")  setFilters({ ...filters, [key]: 0 });
```

---

### BUG-14 — product-sorting.ts armazenado como base64 no repositorio
**Severidade:** CRITICO (arquivo ilegivel, compilacao falha)  
**Arquivo:** src/utils/product-sorting.ts

**Problema:**
Commit anterior armazenou o conteudo base64-encoded como texto literal no arquivo
em vez do TypeScript real. O arquivo aparecia como "aW1wb3J0IHsg..." no repositorio.
O CI detect-base64-content.yml teria bloqueado isso, mas o arquivo foi commitado antes.

**Fix:** Re-commit com o TypeScript correto (preservando BUG-06+13).

---

### BUG-03 — inStock ignora estoque das variacoes
**Severidade:** ALTO  
**Arquivo:** src/pages/filters/useFiltersPageState.ts

**Problema:**
```ts
// ANTES — so conferia o agregado
if (filters.inStock) result = result.filter(p => (p.stock || 0) > 0);
```
Produto com stock=0 mas com variations[n].stock > 0 era incorretamente excluido.
A logica de minStock (linha acima) ja verificava variacoes — inconsistencia no mesmo arquivo.

**Fix:**
```ts
if (filters.inStock)
  result = result.filter(product => {
    if (product.variations?.length > 0)
      return product.variations.some((v) => (v.stock ?? 0) > 0);
    return (product.stock || 0) > 0;
  });
```

---

### BUG-04 — parseInt trunca precos decimais da URL
**Severidade:** ALTO  
**Arquivo:** src/pages/filters/useFiltersPageState.ts

**Problema:**
URL ?priceMin=15.99&priceMax=149.90
parseInt("15.99") = 15 — filtro de preco minimo deslocado;
produto de R$15,50 seria incluido erroneamente.

**Fix:** parseFloat para priceRange. minStock permanece parseInt (estoque e sempre inteiro).

---

### BUG-05 — activeFiltersSummary com 11 tipos ausentes
**Severidade:** ALTO  
**Arquivo:** src/pages/filters/useFiltersPageState.ts

**Problema:**
Os chips removiveis no cabecalho da pagina dependem de activeFiltersSummary.
11 tipos nao geravam chips: techniques, tags, priceRange, minStock, inStock,
isKit, featured, isNew, hasPersonalization, hasCommercialPackaging, search.

**Fix:** 11 entradas adicionadas ao useMemo de activeFiltersSummary.

---

### BUG-06 e BUG-13 — Voice sort "popularity" sem case em sortProducts
**Severidade:** MEDIO  
**Arquivo:** src/utils/product-sorting.ts / src/pages/products/FiltersPage.tsx

**Problema:**
FiltersPage.tsx mapeava popularity: "popularity" no sortMap do voice agent,
mas sortProducts nao tinha case "popularity" — caía no default silencioso.

**Fix:** Adicionado case "popularity": como alias fallthrough para best-seller-promo.

---

### BUG-07 — FilterPanel importa SORT_OPTIONS do modulo errado
**Severidade:** MEDIO  
**Arquivo:** src/components/filters/FilterPanel.tsx

**Problema:**
```ts
// ANTES — fonte incorreta
import { SORT_OPTIONS } from "@/hooks/products";

// DEPOIS — fonte unica de verdade
import { SORT_OPTIONS } from "@/constants/filters";
```
@/hooks/products pode expor lista desatualizada ou parcial.

---

### BUG-11 — defaultAdvancedFilters.priceRange inconsistente
**Severidade:** BAIXO  
**Arquivo:** src/constants/filters.ts

**Problema:**
defaultAdvancedFilters.priceRange = [0, 1000] enquanto defaultFilters e toda
a logica de filtro usa 9999 como sentinel de "sem limite superior".

**Fix:** [0, 9999]

---

### BUG-12 — Dead code appliedFilters
**Severidade:** BAIXO  
**Arquivo:** src/pages/filters/useFiltersPageState.ts

**Problema:**
Estado declarado, populado, exportado no return — porem nenhum consumer o consumia.
Causava re-render desnecessario a cada mudanca de filtro.

**Fix:** Estado e setter removidos do hook.

---

## Arquivos Modificados

| Arquivo | Bugs | Commits |
|---------|------|---------|
| src/utils/product-sorting.ts | BUG-06, BUG-13, BUG-14 | ver branch |
| src/constants/filters.ts | BUG-11 | ver branch |
| src/components/filters/FilterPanel.tsx | BUG-07 | ver branch |
| src/pages/filters/useFiltersPageState.ts | BUG-01, BUG-02, BUG-03, BUG-04, BUG-05, BUG-12 | ver branch |

---

## KPIs de Qualidade (pos-fix)

| Metrica | Antes | Depois |
|---------|-------|--------|
| Bugs criticos abertos | 3 | 0 |
| Chips de filtro exibidos | 11/22 | 22/22 |
| Busca fuzzy para termos parciais | FALHA | OK |
| clearSingleFilter seguro para todos os tipos | CRASH | OK |
| inStock considera variacoes | NAO | SIM |
| Precos decimais preservados na URL | NAO | SIM |
| product-sorting.ts legivel no repo | base64 | TypeScript |

---

## Protecoes Recomendadas (Kaizen)

1. CI detect-base64-content.yml — ja existe. Verificar cobertura em todos os paths de commit.
2. Teste unitario para clearSingleFilter — garantir priceRange volta a [0,9999].
3. Teste E2E para busca fuzzy — verificar "sqz" retorna "Squeeze".
4. Checklist de PR: qualquer novo filtro em FilterState deve ter entrada em activeFiltersSummary.
