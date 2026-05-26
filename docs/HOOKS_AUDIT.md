# Auditoria Exaustiva de Hooks — promo-gifts-v4

> Gerado em: 2026-05-26 | Autor: TIPROMO (Claude BPM Agent)
> Escopo: todos os hooks em `src/hooks/**`
> Rodadas: Round 1 (PR #476) + Round 2 (PR #481) + Round 3 (este PR)

---

## Sumário Executivo

| Severidade | Round 1 | Round 2 | Round 3 | Total | Status |
|------------|---------|---------|---------|-------|--------|
| Critico | 4 | — | — | 4 | todos corrigidos |
| Alto | 4 | 1 | 1 | 6 | todos corrigidos |
| Medio | 6 | 4 | 1 | 11 | todos corrigidos |
| Sem bug | ~110 | — | ~100 auditados | ~210 auditados | — |

---

## Estrutura de Hooks (120+ arquivos)

```
src/hooks/
├── __tests__/          — testes de regressao + integracao
├── admin/              — hooks administrativos
├── auth/               — autenticacao, 2FA, RBAC, MFA
├── bi/                 — business intelligence (auditado Round 3 — sem bugs)
├── collections/        — colecoes de produtos
├── common/             — utilitarios compartilhados (debounce, search, urlState)
├── comparison/         — comparacao de produtos
├── crm/                — integracao CRM/Bitrix
├── dev/                — ferramentas de desenvolvimento
├── favorites/          — favoritos
├── gravacao/           — simulacao de gravacao (auditado Round 2)
├── intelligence/       — IA e dados externos (auditado Round 3 — BUG-VOICE-01)
├── kit-builder/        — construtor de kits
├── mockup/             — mockup de produtos
├── products/           — catalogo (dominio principal — ~45 hooks, auditados Round 1-3)
├── quotes/             — cotacoes (auditado Round 3 — sem bugs criticos)
├── simulation/         — simulacao de precos
├── simulator/          — simulador de gravacao
├── stock/              — estoque (auditado Round 2)
├── tecnicas/           — tecnicas de gravacao
├── ui/                 — toasts, modais, temas
├── voice/              — busca por voz
└── useKillSwitchBanner.ts — banner de manutencao
```

---

## Bugs Corrigidos — Round 1 (PR #476)

### BUG-CS-01 — CORRIGIDO
`useCatalogState.ts` — `isFavorite` usada como boolean em `statBadges`
Funcao sempre truthy; gate correto e `hasActiveFilters`.

### BUG-CS-02 — CORRIGIDO
`useCatalogState.ts` — `resetFilters` chamava `setSortBy('name')` em vez de `'relevance'`

### BUG-CF-01 — CORRIGIDO
`useCatalogFiltering.ts` — 7 filtros contados mas nunca aplicados no pipeline
`featured`, `isKit`, `publicoAlvo`, `datasComemorativas`, `endomarketing`, `ramosAtividade`, `segmentosAtividade`

### BUG-CF-02 — CORRIGIDO
`useCatalogFiltering.ts` — supplier filter usava `p.brand` / `p.supplier_reference` (campos errados)
Corrigido para `p.supplier?.name` / `p.supplier?.id`

### BUG-CF-03 — CORRIGIDO
`useCatalogFiltering.ts` — `inStock` ignorava estoque de variantes
Agora verifica `p.colors?.some(c => c.stock > 0)`

### BUG-CS-03 — CORRIGIDO
`useCatalogState.ts` — auto-prefetch sem guard causava `fetchNextPage` duplicados
Adicionado `prefetchScheduledRef`

### BUG-CS-04 — CORRIGIDO
Threshold `priceRange` inconsistente: `< 500` vs `< 1000`
Unificado para `< 9999` (PRICE_RANGE_MAX)

### BUG-CS-05 — CORRIGIDO
`useCatalogState.ts` — `isTransitioning` manual + `React.startTransition` (incorreto)
Migrado para `useTransition()` hook nativo React 18

### BUG-CS-06 — CORRIGIDO
`useCatalogState.ts` — flash de empty state durante debounce
`setDisplayCount` agora depende de `debouncedServerSearch`, nao `searchQuery` bruto

### BUG-STAT-01 — CORRIGIDO
`useCatalogState.ts` — `hasNextPage` nas deps de `statBadges` causava recalculo desnecessario

---

## Bugs Corrigidos — Round 2 (PR #481)

### BUG-AF-01 — CORRIGIDO
`useAdvancedFilters.ts` — `useEffect` com deps vazias + stale closure nas `fetchAll`
Adicionado `fetchRefsRef` para capturar refs estaveis sem causar re-fetch infinito

### BUG-LOADING-01 — CORRIGIDO
`useAdvancedFilters.ts` — `isLoading` inicializava `true` antes de qualquer fetch
`useState(true)` -> `useState(false)`; sem flash de skeleton desnecessario

### BUG-STOCK-01 — CORRIGIDO
`stockFetcher.ts` — `buildFutureEntries` check `if (q && d)` ignorava `q=0`
Corrigido para `if (q != null && q > 0 && d)`

### BUG-STOCK-02 — CORRIGIDO
`stockFetcher.ts` — `min_quantity || 10` colapsa zero para 10
`||` -> `??` em todas as 3 ocorrencias

### BUG-STOCK-03 — CORRIGIDO
`stockFetcher.ts` — loop de paginacao nao encerrava em pagina parcial sem count
Adicionado `if (totalCount === null && records.length < pageSize) break`

### BUG-GRAVACAO-01 — CORRIGIDO
`useTecnicasGravacao.ts` — mensagem de erro usava `count` que pode ser null
`${variantesResult.count}` -> `${variantesResult.count ?? 'algumas'}`

### BUG-GRAVACAO-02 — CORRIGIDO
`useTecnicasGravacao.ts` — `toggleStatus` expunha `mutate` (fire-and-forget)
Inconsistencia com `create`/`update`/`delete` que expunham `mutateAsync`
Corrigido para `toggleStatusMutation.mutateAsync`

---

## Bugs Corrigidos — Round 3 (este PR)

### BUG-KBD-01 — CORRIGIDO (Alto)
**Arquivo:** `src/hooks/products/useCatalogState.ts`

`handleFavoriteProduct` estava nas deps do keyboard `useEffect`.
Como depende de `[favQuickAdd, toggleFavorite, toast]`, era recriada frequentemente,
causando re-registro do listener (removeEventListener + addEventListener) a cada
interacao com favoritos ou toast — micro-freeze no catalogo.

**Fix:** `handleFavoriteProductRef` captura a versao mais recente sem adicionar
deps instáveis ao keyboard `useEffect`.

### BUG-VOICE-01 — CORRIGIDO (Medio)
**Arquivo:** `src/hooks/intelligence/useSpeechRecognition.ts`

`onResult` e `onError` (callbacks passados pelo caller) estavam nas deps do `useEffect`
que cria a instancia `SpeechRecognition`. Callers que nao memoizam esses callbacks
causavam `recognitionInstance.abort()` + recriacao a cada render — destruindo sessoes
ativas e vazando listeners de audio.

**Fix:** `onResultRef` e `onErrorRef` capturam os callbacks; deps do `useEffect`
reduzidas para `[isSupported, language]`, que sao estaveis por design.

---

## Auditoria Round 3 — Grupos Auditados

### bi/ (14 arquivos) — SEM BUGS CRITICOS
Hooks de analise de clientes (churn, health score, sazonalidade) usam `useQuery` com
`staleTime` adequado e queries condicionais via `enabled: !!clientId`. Sem problemas
de deps ou memory leaks identificados.

### intelligence/ (25 arquivos) — 1 BUG (VOICE-01)
`useSpeechRecognition.ts`: deps instáveis causavam recriacao de instancia.
Demais hooks (useCommercialIntelligence, useMagicUpState, useVoiceAgent) possuem
complex state mas sem memory leaks ou stale closures identificados.

### quotes/ (15 arquivos) — SEM BUGS CRITICOS
`useAutoSaveQuote` ja tinha fixes internos (onRestoreRef, clearAutoSave memoizado).
`useDiscountApproval.fetchPendingRequests` busca todos os status (intencional — visao admin).
Sem regressoes ou deps instáveis identificados.

---

## Testes de Regressao (T28) — CONCLUIDO

**Arquivo:** `src/hooks/__tests__/hooks-audit-regression.unit.test.ts`
**Total de asserções:** 24
**Cobertura:** STOCK-01/02/03, CS-02/04, AUTO-01/02, KBD-01, VOICE-01

---

## Plano de 30 Tarefas — Status Final Round 3

| # | Grupo | Tarefa | Status |
|---|-------|--------|--------|
| T01-T06 | Analise + Docs | Setup inicial e catalogamento | Concluido |
| T07-T08 | Docs | GitHub Issues + CHANGELOG | Backlog |
| T09-T13 | Fix C/A | BUG-CF/CS Round 1 | Concluido (PR #476) |
| T14-T19 | Fix A/M | BUG-CS/AF/STAT Round 1-2 | Concluido (PR #476 + #481) |
| T20 | Fix M | BUG-KBD-01 keyboard deps | **Concluido (este PR)** |
| T21-T24 | Fix M/Hooks | STOCK + GRAVACAO Round 2 | Concluido (PR #481) |
| T25 | Hooks | Auditoria bi + intelligence | **Concluido (este PR)** |
| T26 | Hooks | Auditoria voice (VOICE-01) | **Concluido (este PR)** |
| T27 | Hooks | Auditoria quotes (sem bugs) | **Concluido (este PR)** |
| T28 | Testes | Testes de regressao (24 assercoes) | **Concluido (este PR)** |
| T29 | TS | Remover as unknown as / as never | Backlog |
| T30 | PR | PR Round 3 | **Este PR** |

---

## Resumo Completo de Commits

| Commit | Arquivos | Bugs |
|--------|----------|------|
| `085bae58` (PR #476) | `docs/HOOKS_AUDIT.md` | T06 |
| `8ebbdeac` (PR #476) | `useCatalogFiltering.ts` | CF-01, CF-02, CF-03, CS-04 |
| `8e914c32` (PR #481) | `stockFetcher.ts` | STOCK-01, STOCK-02, STOCK-03 |
| `fa702127` (PR #481) | `useTecnicasGravacao.ts` | GRAVACAO-01, GRAVACAO-02 |
| `e9bf948d` (este PR) | `useCatalogState.ts` | KBD-01 |
| `29e93ec3` (este PR) | `useSpeechRecognition.ts` | VOICE-01 |
| `a630ce12` (este PR) | `hooks-audit-regression.unit.test.ts` | T28 (24 assercoes) |
| CS-01..06, AF-01, LOADING-01, STAT-01 | Incorporados pelo Lovable no main | — |
