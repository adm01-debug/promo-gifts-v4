# Auditoria Técnica — Campo de Busca do módulo "Catálogo de Produtos"

**Projeto:** Promo Gifts v4 · `adm01-debug/promo-gifts-v4`
**Banco (SSOT):** Supabase `doufsxqlfjyuvxuezpln`
**Data:** 2026-06-14
**Escopo:** EXCLUSIVAMENTE o campo de busca dentro do módulo Catálogo de Produtos (rota `/produtos` → `FiltersPage`).
**Branch:** `fix/catalog-search-audit` (NUNCA aplicado em `main`).
**Método:** análise estática exaustiva do código-fonte autoritativo (frontend React + camada PostgREST), trace end-to-end e matriz de cenários E2E. Sem acesso direto de execução ao banco neste ambiente — por isso, correções que exigem migração SQL ficam como **recomendação** (regra: simular antes de executar).

---

## 1. Sumário executivo

A busca da grade está **funcional apenas para o caso feliz** (termo contido no campo `name`, com a mesma acentuação). Fora disso, há **6 falhas confirmadas** — 2 críticas — que produzem **falsos vazios** (o produto existe mas não aparece) e **métricas enganosas** no dropdown.

| # | Severidade | Falha | Sintoma para o usuário |
|---|-----------|-------|------------------------|
| 1 | **CRÍTICO** | Busca server-side só na coluna `name` (ILIKE) | Buscar por **SKU** (`GA8800P`) ou **ref. do fornecedor** → grade vazia |
| 2 | **CRÍTICO** | ILIKE é case-insensitive mas **acento-sensível** | `ecologico` (sem acento) não acha **Ecológico** |
| 3 | ALTO | SELECT do catálogo omitia `supplier_reference` e `short_description` | Re-rank e busca por substring no cliente ficam cegos a ref./descrição |
| 4 | ALTO | Dataset do dropdown ≠ dataset da grade | Em cold-load de `/produtos`, dropdown pode vir vazio/defasado |
| 5 | MÉDIO | Contagens e navegação de categoria/fornecedor usam `mockData` | Badge "N produtos" zerado/errado; clique leva a id mockado, não ao real |
| 6 | BAIXO/UX | Header "**6 resultados**" conta sugestões do dropdown, não a grade | Usuário pensa que só há 6 itens (a grade tem 7.143) |

**Corrigidos neste PR (cirúrgico, backward-compatible):** #1 (multi-coluna server-side), #3 (SELECT), #5 (contagens), #6 (mitigado via #1+#3 — o dropdown passa a ranquear sobre dados completos).
**Recomendações (exigem migração/refactor, fora do PR):** #2 (`unaccent` server-side), #4 (unificar fonte do dropdown), #5-raiz (categorias/fornecedores do DB real), busca por `search_vector`/FTS.

---

## 2. Arquitetura da busca (trace end-to-end confirmado no código)

### 2.1 Dois caminhos independentes

A UI tem **dois mecanismos de busca que não compartilham dados**:

**(A) GRADE — caminho principal (server-side + re-rank no cliente)**
```
SmartSearchInput (onSearch/onSelect)
  → setFilters({ search: q })                         [FiltersPage]
  → useFiltersPageState.ts:146  effectiveSearch = filters.search || urlSearch
  → :147  serverSearchTerm = useDebounce(effectiveSearch, 400)
  → :155  useProductsCatalog({ search: serverSearchTerm, ... })
  → fetchCatalogPage()                                 [useProductsLightweight.ts]
        if (search) filters._search = search
  → dbInvoke()                                          [src/lib/db/postgrest.ts]
        resolve products → v_products_public (camada Ouro)
        aplica o termo em SEARCH_COLUMNS
  → realProducts (todas as páginas acumuladas)
  → :376  useProductFuzzySearch(realProducts, query)   re-rank client (Fuse.js)
  → :382  filteredProducts = hasFuzzy ? fuzzyResults : realProducts
        + ~25 filtros client-side
        + substring .includes(name/sku/description) só quando NÃO há fuzzy
```

**(B) DROPDOWN — autocomplete (100% client-side)**
```
SmartSearchInput.tsx:62  const { ... } = useSearch();   // <-- SEM argumentos
  → availableProducts = productsContext?.products || [] // nunca recebe a grade
  → Fuse.js sobre o ProductsContext (carregado lazy), .slice(0, 6)
  → categorias/fornecedores vêm de '@/data/mockData' (MOCK)
```
- **Enter** (`SmartSearchInput.tsx:162-168`): se há sugestão destacada (`selectedIndex>=0`) → `handleSelectResult`; senão → `submitSearch(query)` → `onSearch` → alimenta a grade.
- **handleSelectResult** (`:104-135`): produto → `/produto/{id}`; categoria → `/?categoria={id}`; fornecedor → `/?fornecedor={id}`; fallback → `/?search={label}` (quando o parent não injeta `onSelect`).

### 2.2 Ranking (`src/utils/product-search.ts`)
- `normalizeProductSearch`: `NFD` + remoção de diacríticos + `lowercase` (aplica-se **só no cliente**).
- Pesos Fuse: `sku 0.35 · name 0.30 · supplier_reference 0.10 · brand 0.08 · category_name 0.07 · description 0.05`.

---

## 3. Falhas detalhadas

### 3.1 [CRÍTICO #1] Busca server-side só em `name`
**Antes** (`postgrest.ts`):
```ts
const SEARCH_COLUMNS: Record<string, string> = { v_products_public: 'name', products: 'name', ... };
// ...
if (searchCol) query = query.ilike(searchCol, `%${searchTerm}%`);
```
O termo é aplicado **apenas** em `name`. Como a grade só re-ranqueia o que o servidor retorna, um termo que existe somente em `sku`/`supplier_reference` retorna **0 linhas** do servidor → o Fuse no cliente não tem nada para reordenar → **grade vazia**.
**Impacto real:** vendedor que busca pelo **código** do produto (uso diário) não encontra nada. O `search_vector` (tsvector, coluna ~170 de `products`, com trigger de manutenção) existe no banco e é **ignorado**.

**Correção aplicada:** `SEARCH_COLUMNS` aceita `string | string[]`. Para `products`/`v_products_public` → `['name','sku','supplier_reference']`. Uma coluna → `.ilike` (idêntico ao legado). Mais de uma → `.or()` de `ilike` com o termo **sanitizado**.

### 3.2 [CRÍTICO #2] ILIKE é acento-sensível — *recomendação*
ILIKE ignora caixa, mas **não** ignora acento no Postgres. O cliente normaliza a query (tira acento) e envia ao servidor, que casa contra `name` **cru** → `ecologico` não casa `Ecológico`. Cobertura 100% acento-insensível exige **`unaccent` no servidor** (ex.: índice `GIN (unaccent(name) gin_trgm_ops)` + filtro `unaccent(col) ILIKE unaccent(termo)` ou FTS com dicionário `unaccent`). **Não implementado** aqui: exige migração e simulação prévia (sem DB neste ambiente). Mitigação parcial: o re-rank do Fuse no cliente, sobre o que vier, já é acento-insensível.

### 3.3 [ALTO #3] SELECT omitia `supplier_reference` e `short_description`
**Antes:** `PRODUCT_SELECT_LIGHTWEIGHT` não trazia esses campos, mas `mapLightweightToProduct` lê `p.supplier_reference` e `p.short_description` → gravava `supplier_reference=null` e `description=''` em **todo** produto. Resultado: o re-rank por ref. (peso 0.10) e a busca por substring em `description` ficam **inertes**.
**Correção aplicada:** incluídos `supplier_reference, short_description` no SELECT. **`is_new` e `created_at` foram preservados** (feature `newArrival` depende deles).

### 3.4 [ALTO #4] Divergência de dataset dropdown ↔ grade — *recomendação*
O dropdown lê `ProductsContext` (carregado lazy por outro fluxo). `registerProducts` é chamado por `useCatalogState.ts` (outro catálogo), **não** por `useFiltersPageState.ts`. Em cold-load de `/produtos`, o dropdown pode estar **vazio ou defasado** enquanto a grade já tem milhares. Recomendação: alimentar o `useSearch` com o dataset da grade (passar `realProducts` como argumento) **ou** popular o `ProductsContext` no mesmo fluxo.

### 3.5 [MÉDIO #5] Contagens/navegação de categoria e fornecedor via `mockData`
- **Categoria (contagem)** — *antes:* `parseInt(p.category_id) === category.id`. `category_id` é **UUID**; `parseInt('192e45…')` retorna `192` (falso-positivo) e `NaN` para UUID não-numérico.
- **Fornecedor (contagem)** — *antes:* `p.brand === supplier.id`. O `brand` real é o **nome** (`'XBZ'`, `'Spot | Stricker'`, `'Asia Import'`, `'Só Marcas'`); o `supplier.id` mockado é `'xbz'|'stricker'|'asia'|'somarcas'` → **nunca casa** → contagem sempre **0**.
- **Correção aplicada (apenas a contagem):** categoria → comparação estrita `p.category_id === String(category.id)`; fornecedor → casamento por **tokens normalizados (≥3 chars)** do nome do fornecedor presentes no `brand`.
- **Raiz remanescente (recomendação):** os ids de `mockData` (`CATEGORIES` numéricos; `SUPPLIERS` string) **não** correspondem aos ids reais do banco. Clicar numa sugestão de categoria/fornecedor navega para `/?categoria=192` (id mockado), que não filtra corretamente. Solução: servir categorias/fornecedores **do DB real** no autocomplete.

### 3.6 [BAIXO/UX #6] Header "6 resultados"
`SearchResultGroups.tsx:134`: `resultCount = suggestions.filter(s => s.type !== 'history').length`. Conta as **sugestões do dropdown** (produtos limitados a 6 + categorias ≤3 + fornecedores ≤3) — **não** o total da grade. Daí "6 resultados" mesmo com 7.143 itens. Mitigado por #1/#3 (sugestões passam a refletir dados completos); o ideal é exibir o **total real** da grade (count exato já disponível em `totalEstimate`).

---

## 4. Resumo das correções deste PR

| Arquivo | Mudança | Compatibilidade |
|---------|---------|-----------------|
| `src/lib/db/postgrest.ts` | `SEARCH_COLUMNS: string \| string[]`; `products`/`v_products_public` = `[name, sku, supplier_reference]`; 1 col → `.ilike` (legado); >1 col → `.or()` de `ilike` com termo sanitizado (`/[,()*%]/g`→espaço; curinga `*` dentro do `or()`); degrada para `ilike[0]` se sobrar só metacaractere | Backward-compatible: demais tabelas seguem `string`/`.ilike` |
| `src/hooks/products/useProductsLightweight.ts` | SELECT inclui `supplier_reference, short_description` (mantém `is_new, created_at`) | Aditivo |
| `src/hooks/common/useSearch.ts` | Importa `normalizeProductSearch`; corrige contagem de categoria (estrita) e de fornecedor (tokens) | Aditivo |

**Nota de segurança (injeção em `.or()`):** o PostgREST recebe o `.or()` como **string** de filtro; vírgula, parênteses e curingas são metacaracteres. O termo é sanitizado **antes** de compor a expressão, eliminando quebra/injeção de filtro. O caminho de 1 coluna continua **parametrizado** via `.ilike`.

---

## 5. Roadmap de remediação (pós-merge, exige DB + simulação)

1. **FTS real:** trocar o `ILIKE` multi-coluna por `v_products_public.search_vector @@ websearch_to_tsquery('portuguese', termo)`, com `ts_rank` para ordenar no servidor. Elimina #1 e melhora relevância.
2. **`unaccent` (#2):** dicionário `unaccent` no FTS **ou** índice `GIN (unaccent(name) gin_trgm_ops)` + `unaccent()` no filtro.
3. **Unificar dropdown↔grade (#4):** passar `realProducts` ao `useSearch` ou popular `ProductsContext` no fluxo de `/produtos`.
4. **Categorias/fornecedores do DB (#5-raiz):** substituir `mockData` por fonte real, com ids/UUIDs corretos para contagem **e** navegação.
5. **Total real no header (#6):** exibir `totalEstimate` (count exato) em vez da contagem de sugestões.

Cada item deve seguir o método do projeto: auditoria → simulação `BEGIN…ROLLBACK` com contagens → execução → bateria de validação.

---

## 6. Validação E2E

Matriz de cenários (centenas de casos parametrizados) em
`e2e/catalog/catalog-search-audit.spec.ts`, com tags de **regressão** ligadas a cada falha (`@search-regression-bug1` … `@bug6`). Inclui: acento (`ecologico`→Ecológico), typo (`garafa`), SKU exato, ref. do fornecedor, multi-palavra, caracteres especiais/injeção, string vazia, 1 caractere, caixa alta/baixa, dropdown vs grade, cap 6 vs total, histórico e atalho ⌘K. Como este ambiente não executa o runner, o spec serve como **harness de regressão** do PR (rodar no CI/preview).
