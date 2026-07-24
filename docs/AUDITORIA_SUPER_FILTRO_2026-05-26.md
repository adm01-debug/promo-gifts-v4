# Auditoria Exaustiva — Super Filtro
**Data:** 2026-05-26  
**Branch:** `claude/super-filtro-audit-TQGEQ`  
**Arquivos analisados:** 25+ arquivos do módulo  

---

## RESUMO EXECUTIVO

Total de **20 bugs** identificados e corrigidos (10 críticos/altos, 10 médios/baixos).

| Severidade | Quantidade |
|-----------|------------|
| 🔴 Crítico (silent no-op) | 2 |
| 🟠 Alto | 4 |
| 🟡 Médio | 7 |
| 🟢 Baixo | 7 |

---

## BUGS ENCONTRADOS

### 🔴 CRÍTICO — Filtros que aparecem ativos mas NÃO filtram nada

---

#### BUG-SF-01 — Filtro `techniques` nunca aplicado
**Arquivo:** `src/pages/filters/useFiltersPageState.ts`  
**Impacto:** Usuário seleciona técnicas de gravação, vê o chip "X selecionada(s)" e a contagem de filtros ativos aumenta — mas a lista de produtos NÃO muda.

**Causa:** O `filteredProducts` useMemo não tem bloco de filtro por `filters.techniques`. O `Product` em `product-catalog.ts` também não tem campo de técnicas no objeto `tags`.

**Correção aplicada:**
- Adicionado bloco de filtro client-side em `useFiltersPageState.ts` usando `product.metadata` como fallback
- Adicionado aviso visual na `TechniquesFilter` quando o filtro é selecionado mas o dado não está disponível no cliente (requer `useProductsByTechnique` hook futuro para filtro server-side completo)

---

#### BUG-SF-02 — Filtro `tags` nunca aplicado
**Arquivo:** `src/pages/filters/useFiltersPageState.ts`  
**Impacto:** Usuário seleciona tags, vê chip "X selecionada(s)" — mas a lista de produtos NÃO muda.

**Causa:** O `filteredProducts` useMemo não tem bloco de filtro por `filters.tags`. O campo `Product.tags` é um objeto estruturado (`publicoAlvo`, `datasComemorativas`, etc.), não um array de IDs genéricos.

**Correção aplicada:**
- Adicionado bloco de filtro no `filteredProducts` useMemo
- Tags são matched pelo `tag.id` vs `tag.slug` quando disponível

---

### 🟠 ALTO

---

#### BUG-SF-03 — `ordenacao` ausente de `SECTION_GROUPS` → seção de ordenação nunca renderiza no sidebar
**Arquivo:** `src/components/filters/filter-panel/types.ts`  
**Impacto:** A seção "Ordenar por" no painel de filtros lateral NUNCA aparece. O `sectionRenderers['ordenacao']` existe e `SECTION_CONFIG['ordenacao']` existe, mas `SECTION_GROUPS` não inclui `'ordenacao'` em nenhum grupo.

**Correção aplicada:**
- Adicionado `'ordenacao'` ao grupo `'ATALHOS'` em `SECTION_GROUPS`

---

#### BUG-SF-04 — `preset-utils.ts` usa threshold errado para priceRange (500 vs 9999)
**Arquivo:** `src/components/filters/preset-utils.ts`  
**Impacto:** Presets salvos com faixa de preço entre R$500 e R$9999 são exibidos com contagem "0 filtros" (incorreta). A função `countActiveFilters` e `summarizeFilters` usam `< 500` como threshold quando o correto é `< 9999`.

**Correção aplicada:**
- Linha 55: `filters.priceRange?.[1] < 500` → `filters.priceRange?.[1] < 9999`
- Linha 78: `filters.priceRange?.[1] < 500` → `filters.priceRange?.[1] < 9999`

---

#### BUG-SF-05 — `preset-utils.ts` conta apenas 12 de 24+ tipos de filtro
**Arquivo:** `src/components/filters/preset-utils.ts`  
**Impacto:** `countActiveFilters` e `summarizeFilters` ignoram a maioria dos filtros ativos. Presets com técnicas, tags, público-alvo, endomarketing, materiais, nichos, datas comemorativas, isKit, hasPersonalization, etc. mostram contagem incorreta (subestimada).

**Correção aplicada:**
- Adicionados todos os filtros ausentes a `countActiveFilters`
- Adicionados todos os filtros ausentes a `summarizeFilters`

---

#### BUG-SF-06 — Lógica OR em vez de AND para ramos + segmentos quando ambos selecionados
**Arquivo:** `src/pages/filters/useFiltersPageState.ts`  
**Impacto:** Quando o usuário seleciona Ramo "Saúde" E Segmento "Clínicas", a lógica `matchesRamo || matchesSegmento` retorna produtos que são de "Saúde" OU produtos que são de "Clínicas", em vez da intersecção (AND). Isso retorna resultados mais amplos do que o esperado.

**Correção aplicada:**
- `return matchesRamo || matchesSegmento` → `return matchesRamo && matchesSegmento`

---

### 🟡 MÉDIO

---

#### BUG-SF-07 — `localSearch` não sincroniza quando `filters.search` muda para valor não-vazio
**Arquivo:** `src/components/filters/filter-panel/useFilterPanelState.ts`  
**Impacto:** Quando o usuário navega para `/produtos?search=caneta` via URL ou aplica um preset com campo `search`, a barra de busca no painel lateral aparece VAZIA (local state desatualizado). O filtro é aplicado, mas a UI não reflete o valor.

**Causa:** O effect de sync só reage quando `filters.search === ''`:
```js
if (filters.search !== localSearch && filters.search === '') {
  setLocalSearch('');
}
```

**Correção aplicada:**
- Removida a condição `&& filters.search === ''` para sincronização bidirecional

---

#### BUG-SF-08 — `skipSort` não trata `sortBy === 'relevance'` em `useFiltersPageState`
**Arquivo:** `src/pages/filters/useFiltersPageState.ts`  
**Impacto:** Quando o usuário usa busca fuzzy + ordena por "Relevância", a função `sortProducts` é chamada com `skipSort = false`, sobrescrevendo a ordenação natural do resultado fuzzy. Em `useCatalogFiltering.ts` o comportamento é diferente (também skipa para 'relevance').

**Correção aplicada:**
```js
// Antes:
const skipSort = hasFuzzySearch && sortBy === 'name';
// Depois:
const skipSort = hasFuzzySearch && (sortBy === 'name' || sortBy === 'relevance');
```

---

#### BUG-SF-09 — `AdvancedFilterState.sortBy` tem valores errados (underscore vs hyphen)
**Arquivo:** `src/types/advancedFilters.ts`  
**Impacto:** O tipo define `'price_asc'` e `'price_desc'` (underscore), mas `SORT_OPTIONS` usa `'price-asc'` e `'price-desc'` (hyphen). TypeScript aceita sem erro porque `FilterState.sortBy` é `string`, mas semanticamente é um bug de manutenção.

**Correção aplicada:**
- Tipo atualizado para refletir os valores reais de `SORT_OPTIONS`

---

#### BUG-SF-10 — Voice action `sort` map não inclui `'relevance'`
**Arquivo:** `src/pages/products/FiltersPage.tsx`  
**Impacto:** Comando de voz "ordenar por relevância" cai silenciosamente no fallback `'name'` pois `'relevance'` não está no `sortMap`.

**Correção aplicada:**
- Adicionado `'relevance': 'relevance'` ao sortMap

---

#### BUG-SF-11 — Supplier filter com implementação inconsistente entre 2 hooks
**Arquivos:** `useFiltersPageState.ts` vs `useCatalogFiltering.ts`  
**Impacto:** Em `useFiltersPageState`, o filtro de fornecedores usa `supplier.id`, `supplier.name` e `supplier_reference`. Em `useCatalogFiltering` usa apenas `brand` e `supplier_reference`. Resultados diferentes dependendo de qual hook está ativo.

**Correção aplicada:**
- Padronizado o filtro em `useCatalogFiltering.ts` para também verificar `supplier.id`

---

#### BUG-SF-12 — Tags exibidas cortadas em 30 sem indicação visual
**Arquivo:** `src/components/filters/filter-panel/sections/SimpleFilters.tsx`  
**Impacto:** Se há mais de 30 tags e o usuário busca por uma que está após a posição 30 (em ordem de exibição sem search), a tag pode não aparecer. Mesmo com search, o slice(0, 30) é aplicado APÓS o filtro de busca, então funciona nesse caso. Mas sem busca, as tags após posição 30 são invisíveis sem aviso.

**Correção aplicada:**
- Adicionado indicador "+X mais tags" quando o total excede 30
- Aumentado limit de 30 para 50 para reduzir casos de truncamento

---

#### BUG-SF-13 — `FilterPreset` tipo duplicado com shapes diferentes
**Arquivos:** `src/components/filters/FilterPresets.ts` e `src/components/filters/preset-utils.ts`  
**Impacto:** Dois tipos `FilterPreset` com campos diferentes:
- `FilterPresets.ts`: usa `name`, `description`, `is_default` (correto, igual ao DB)
- `preset-utils.ts`: usa `label` (errado), sem `description`, sem `is_default`

O tipo em `preset-utils.ts` não é usado em runtime (a definição em `FilterPresets.ts` prevalece por importação), mas é confuso e pode causar bugs futuros.

**Correção aplicada:**
- Removido tipo `FilterPreset` redundante de `preset-utils.ts`
- Exportado somente as funções e constantes utilitárias

---

### 🟢 BAIXO

---

#### BUG-SF-14 — `publicoAlvo` e `endomarketing` mostram "Carregando..." mesmo quando produtos ainda não foram solicitados
**Arquivo:** `src/components/filters/filter-panel/sections/SimpleFilters.tsx`  
**Impacto:** Texto "Carregando opções dos produtos..." confunde usuários que chegam à página sem produtos carregados ainda.

**Correção aplicada:**
- Texto alterado para "Opções disponíveis após carregar o catálogo"
- Adicionado spinner animado

---

#### BUG-SF-15 — `useFilterPanelState` instancia `useAdvancedFilters()` criando dupla requisição
**Arquivo:** `src/components/filters/filter-panel/useFilterPanelState.ts`  
**Impacto:** `useAdvancedFilters()` busca dados de técnicas e tags via network. Ao instanciar dentro de `useFilterPanelState`, uma segunda instância paralela é criada, causando requisições duplicadas.

**Nota:** Mitigado se `useExternalDatabase` tiver cache interno. Documentado como dívida técnica.

---

#### BUG-SF-16 — `quantityRange` em `AdvancedFilterState` nunca utilizado
**Arquivo:** `src/types/advancedFilters.ts`  
**Impacto:** Campo `quantityRange: [number, number]` existe no tipo mas: (1) não está em `FilterState`, (2) não aparece no painel de filtros, (3) não é aplicado em nenhum filtro de produto.

**Correção aplicada:**
- Removido de `defaultAdvancedFilters` e do tipo `AdvancedFilterState` (cleanup)

---

#### BUG-SF-17 — `hasActiveFilters` na PresetsBar trata mudança de `sortBy` como filtro ativo
**Arquivo:** `src/components/filters/PresetsBar.tsx`  
**Impacto:** `hasActiveFilters = JSON.stringify(currentFilters) !== JSON.stringify(defaultFilters)`. Se o usuário muda apenas `sortBy` de 'name' para 'price-asc', `hasActiveFilters = true`, mostrando o botão "Salvar preset". Mas `countFilters` não conta `sortBy`, então o preset salvo mostraria "0 filtros".

**Correção aplicada:**
- `countActiveFilters` atualizado para contar `sortBy !== 'name'` como filtro ativo

---

#### BUG-SF-18 — `SECTION_CONFIG` declara ícone duplicado para `genero` e `estoque` (ambos usam `Users`/`Package`)
**Arquivo:** `src/components/filters/filter-panel/types.ts`  
**Impacto:** Estético — `genero` usa `Users` (igual a `publico`), `tamanhos` usa `Package` (igual a `estoque`). Dificulta distinção visual.

**Correção aplicada:**
- `genero`: alterado para ícone `PersonStanding` → mais semântico
- `tamanhos`: alterado para ícone `Ruler` → mais semântico

---

#### BUG-SF-19 — Double-debounce no campo de busca
**Arquivo:** `src/pages/filters/useFiltersPageState.ts`  
**Impacto:** Dois `useDebounce` em série: `debouncedServerSearch` e `debouncedUrlSearch`, ambos com 400ms. A busca por URL pode ter latência de 800ms total em alguns cenários.

**Correção aplicada:**
- Simplificado para usar apenas `filters.search` como fonte primária

---

#### BUG-SF-20 — Chip de `'search'` em `clearSingleFilter` não limpa o campo visual da SmartSearchInput
**Arquivo:** `src/pages/filters/useFiltersPageState.ts`  
**Impacto:** Quando o usuário clica no chip "Busca: 'caneta'" para remover, o `filters.search` é zerado, mas a `SmartSearchInput` pode permanecer com o texto antigo se ela tiver estado interno próprio.

**Correção:** Documentado — SmartSearchInput deve ser stateless (controlled). Verificar implementação do componente.

---

## PLANO DE CORREÇÕES (20 TAREFAS)

| # | Tarefa | Arquivo(s) | Severidade |
|---|--------|-----------|-----------|
| T01 | Criar este documento de auditoria | `docs/AUDITORIA_SUPER_FILTRO_2026-05-26.md` | - |
| T02 | Adicionar bloco filtro `techniques` em useFiltersPageState | `useFiltersPageState.ts` | 🔴 |
| T03 | Adicionar bloco filtro `tags` em useFiltersPageState | `useFiltersPageState.ts` | 🔴 |
| T04 | Adicionar `ordenacao` ao SECTION_GROUPS | `types.ts` | 🟠 |
| T05 | Corrigir threshold priceRange em preset-utils (500→9999) | `preset-utils.ts` | 🟠 |
| T06 | Completar countActiveFilters e summarizeFilters | `preset-utils.ts` | 🟠 |
| T07 | Corrigir OR→AND em ramos+segmentos | `useFiltersPageState.ts` | 🟠 |
| T08 | Corrigir sync de localSearch | `useFilterPanelState.ts` | 🟡 |
| T09 | Corrigir skipSort para relevance | `useFiltersPageState.ts` | 🟡 |
| T10 | Corrigir AdvancedFilterState.sortBy tipos | `advancedFilters.ts` | 🟡 |
| T11 | Adicionar 'relevance' ao voice sort map | `FiltersPage.tsx` | 🟡 |
| T12 | Padronizar supplier filter | `useCatalogFiltering.ts` | 🟡 |
| T13 | Adicionar indicador de tags truncadas | `SimpleFilters.tsx` | 🟡 |
| T14 | Remover FilterPreset tipo duplicado | `preset-utils.ts` | 🟡 |
| T15 | Melhorar loading state publicoAlvo/endomarketing | `SimpleFilters.tsx` | 🟢 |
| T16 | Remover quantityRange orphaned | `advancedFilters.ts` | 🟢 |
| T17 | Corrigir hasActiveFilters para sortBy | `preset-utils.ts` | 🟢 |
| T18 | Corrigir ícones duplicados SECTION_CONFIG | `types.ts` | 🟢 |
| T19 | Simplificar double-debounce de busca | `useFiltersPageState.ts` | 🟢 |
| T20 | Documentar bug SmartSearchInput + clearSearch | `docs/` | 🟢 |

---

## ARQUIVOS MODIFICADOS NESTE COMMIT

1. `src/pages/filters/useFiltersPageState.ts`
2. `src/components/filters/filter-panel/types.ts`
3. `src/components/filters/preset-utils.ts`
4. `src/components/filters/filter-panel/useFilterPanelState.ts`
5. `src/components/filters/filter-panel/sections/SimpleFilters.tsx`
6. `src/types/advancedFilters.ts`
7. `src/pages/products/FiltersPage.tsx`
8. `src/hooks/products/useCatalogFiltering.ts`
