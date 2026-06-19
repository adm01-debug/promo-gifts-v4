# Auditoria Exaustiva — Super Filtro (2026-06-18)

**Branch:** `claude/super-filtro-audit-7t8cx1`
**Escopo:** Módulo "Super Filtro" (`/produtos` · `/filtros`) — ponta a ponta:
camada de dados (Supabase Gold `doufsxqlfjyuvxuezpln` → `v_products_public`),
hooks de filtragem, painel de filtros, página e integração de voz.
**Metodologia:** leitura de cada hook/seção/componente do módulo + validação
contra os dados **reais** de produção (7.154 produtos ativos) via SQL.

---

## Resumo Executivo

| # | Severidade | Achado | Status |
|---|-----------|--------|--------|
| SF-A | 🔴 ALTO | 3 toggles de "Opções Rápidas" inertes (Destaques, Com Personalização, Com Embalagem Nativa) — sempre 0 resultados | **corrigido** |
| SF-B | 🟠 MÉDIO | `onSale` nunca era mapeado do banco (toggle "Promoções" permanentemente falso) | **corrigido** |
| SF-C | 🟡 BAIXO | Voz: comando com preço mín. **e** máx. perdia o máximo; termos duplicavam ao acumular | **corrigido** |
| SF-D | ⚪ INFO | Filtro "Técnicas de Gravação" inerte — sem dado produto↔técnica no banco | documentado |
| SF-E | ⚪ INFO | Filtro "Tamanhos" vazio — catálogo leve não carrega variações | documentado |
| SF-F | ⚪ INFO | Sentinela de preço `9999` é risco latente (preço máx. real = R$5.175) | documentado |

A base de bugs anteriores (BUG-01…22, BUG-SF-01…19, FIX-01…28, GAP-1/19) foi
revisada e permanece corrigida — todos os testes de regressão passam (820 testes).

---

## SF-A — Toggles de Opções Rápidas inertes (🔴 ALTO)

### Sintoma
Selecionar **Destaques**, **Com Personalização** ou **Com Embalagem Nativa** no
painel retornava sempre "Nenhum produto encontrado", apesar de existirem milhares
de produtos qualificados:

| Toggle | Coluna no banco | Produtos qualificados (ativos) |
|--------|-----------------|-------------------------------|
| Destaques | `is_featured` (ou `is_bestseller`) | **2.147** |
| Com Personalização | `allows_personalization` | **4.985** |
| Com Embalagem Nativa | `has_commercial_packaging` | **1.747** |

### Causa-raiz
O catálogo do Super Filtro carrega via `useProductsCatalog → fetchCatalogPage →
mapLightweightToProduct` (`src/hooks/products/useProductsLightweight.ts`). O
mapeamento **hardcodava** `featured: false`, `onSale: false` e **omitia**
`hasPersonalization` e `hasCommercialPackaging`. Além disso, o `SELECT` leve
(`PRODUCT_SELECT_LIGHTWEIGHT`, nos dois arquivos da camada) não buscava essas
colunas. Os filtros em `useFiltersPageState` (`p.featured === true` etc.)
operavam, portanto, sobre valores sempre falsos/`undefined`.

> O mapeamento "pesado" `src/utils/product-mapper.ts` já fazia o correto
> (`featured: Boolean(p.is_featured || p.is_bestseller)`, `onSale: Boolean(p.is_on_sale)`,
> `hasPersonalization: p.allows_personalization`, `hasCommercialPackaging: p.has_commercial_packaging`).
> A divergência entre os dois mapeadores era a falha.

### Correção
- `src/lib/external-db/products-lightweight.ts` — colunas adicionadas ao
  `PRODUCT_SELECT_LIGHTWEIGHT` e ao tipo `LightweightProduct`.
- `src/hooks/products/useProductsLightweight.ts` — colunas adicionadas ao
  `PRODUCT_SELECT_LIGHTWEIGHT` do catálogo e `mapLightweightToProduct` passou a
  espelhar o `product-mapper.ts`.
- Verificado que `v_products_public` expõe as 5 colunas (`is_featured`,
  `is_bestseller`, `is_on_sale`, `allows_personalization`,
  `has_commercial_packaging`) — `SELECT` validado contra produção.
- **Bônus:** o mesmo mapeamento alimenta o catálogo (Index/`useCatalogFiltering`),
  então o filtro "Com Embalagem Nativa" lá também passa a funcionar.

### Teste de regressão
`src/hooks/products/__tests__/useProductsLightweight.mapper.test.ts` — 6 novos
casos travam o mapeamento dos flags e a presença das colunas no `SELECT`
(proteção contra reversão pelo bot Lovable — REGRA #7).

---

## SF-B — `onSale` não mapeado (🟠 MÉDIO)
Coberto pela mesma correção (SF-A). Hoje há **0** produtos com `is_on_sale = true`,
então o toggle "Promoções" retorna vazio — mas agora de forma **honesta**:
passará a funcionar assim que promoções forem ativadas, sem depender de novo deploy.

---

## SF-C — Filtro por voz: preço mín.+máx. e duplicação (🟡 BAIXO)
`src/pages/products/FiltersPage.tsx · handleVoiceAction`.
- Quando o comando trazia `minPrice` **e** `maxPrice`, a segunda atribuição lia
  `prev.priceRange` e descartava o valor recém-aplicado (ex.: "entre 10 e 50"
  perdia o 50). Agora ambos são aplicados de forma acumulativa.
- Cor/categoria/material acumulavam com duplicatas — agora deduplicados via `Set`.

---

## SF-D — "Técnicas de Gravação" inerte (⚪ INFO — limitação de dados)
A seção lista a tabela-mestre `personalization_techniques`, mas **não há vínculo
produto↔técnica**: a junção `product_group_location_techniques` tem **0 linhas** e
o produto leve não carrega `metadata.techniques`. O código já evita falso positivo
(não conta, não exibe chip, não filtra — `techniquesDataAvailable`), mas os
checkboxes podem ser marcados sem efeito.
**Recomendação:** popular o vínculo produto↔técnica (ou ocultar/desabilitar a
seção com aviso "em breve") — decisão de produto. Sem dado, filtragem server-side
é impossível hoje.

## SF-E — "Tamanhos" vazio (⚪ INFO — limitação de arquitetura)
`SizeFilter` deriva os tamanhos de `produtos[].variations[].size_code`. O catálogo
leve não carrega variações (decisão de performance: 7k+ produtos), então a seção
exibe o estado honesto "Nenhum tamanho disponível nos produtos carregados".
**Recomendação:** hook server-side `useProductsBySize` (análogo a
`useProductsByMaterial`) se o filtro por tamanho for prioridade.

## SF-F — Sentinela de preço `9999` (⚪ INFO — risco latente)
"Sem limite" usa `9999`. Com um mínimo definido, produtos acima de R$9.999
seriam excluídos. Hoje **inócuo** (preço máx. real = R$5.175), mas recomenda-se
elevar a sentinela (ex.: `Infinity`/`1_000_000`) de forma consistente em
`defaultFilters`, serialização de URL, painel e `useCatalogFiltering`.

---

## Validação (1ª rodada)
- `tsc -p tsconfig.app.json --noEmit` → **0 erros**
- `eslint` (arquivos alterados, `--max-warnings=0`) → **limpo**
- `vitest` (hooks/products, pages/filters, external-db, regressão Super Filtro)
  → **820 passados / 5 skipped / 0 falhas**
- Colunas novas validadas contra `v_products_public` em produção.

---

## 2ª RODADA — Execução das melhorias rumo a 10/10 (2026-06-18)

As limitações SF-D/SF-E/SF-F deixaram de ser "documentadas" e foram **resolvidas**.

### SF-F — Sentinela de preço `9999` → **RESOLVIDO**
`priceRange[1] >= 9999` passa a ser tratado como "sem limite superior" em
`applyProductFilters` e `useCatalogFiltering`. Produtos acima de R$9.999 deixam
de ser excluídos quando só o mínimo é definido. +5 testes de regressão.

### Refactor — `applyProductFilters` (pipeline puro) + **simulação exaustiva**
Toda a lógica de filtragem/ordenação foi extraída do `useMemo` para a função
pura `src/pages/filters/applyProductFilters.ts`, testável sem React. Nova suíte
`applyProductFilters.simulation.test.ts` roda **~500+ cenários combinatórios**
(matriz de 23 filtros atômicos em pares) provando invariantes: subconjunto do
catálogo, sem duplicatas, AND nunca aumenta contagem, idempotência, ordenação
preserva o conjunto, mais asserts exatos por filtro e por Set server-side.

### SF-E — Filtro de **Tamanhos funcional** (server-side) → **RESOLVIDO**
Novos hooks `useProductsBySize` (IDs por `size_code` em `product_variants`) e
`useAvailableSizes` (tamanhos distintos, `size_code > ''`). Integrados ao
pipeline com a mesma semântica dos demais filtros server-side. `SizeFilter`
popula os tamanhos reais do catálogo. Validado em produção: **G/GG/M/P/XGG**;
seleção `['M','P']` → **16 produtos**. +4 testes de hook.

### SF-D — Seção **Técnicas** ocultada (honestidade de UI) → **RESOLVIDO**
Sem vínculo produto↔técnica no banco (junção `product_group_location_techniques`
= 0 linhas; produto leve sem `metadata.techniques`), a seção era um controle
morto. Ocultada no painel; `SECTION_CONFIG`/renderer preservados para re-habilitar
em uma linha quando houver suporte server-side.

### Validação (2ª rodada)
- `tsc` 0 erros · `eslint` baseline limpo
- `vitest` suíte ampla → **3326 passados / 0 falhas** (inclui simulação + novos hooks)
- Consultas SF-E validadas contra produção (`product_variants` via bridge).
