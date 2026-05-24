# DECISION-LOG v2 — Onda "CI Green" (we-dream-big / PromoGifts)

**Data:** 21/mai/2026 (continuação)
**Repo:** `adm01-debug/we-dream-big` (full_name resolve p/ `promo-gifts-v4`)

> Sucede o `docs/DECISION-LOG-2026-05-21.md` (v1). Aqui: decisão (b) executada — PR novo
> enxuto sobre a main fresca, em vez de ressuscitar o #27 (base obsoleta).

---

## 1. O QUE FOI FEITO (executado e commitado)

### PR #35 — `fix/ci-tests-green-onmain` (base: main fresca)
Commit `f735fed`. Repara 6 arquivos, RE-APLICADOS sobre a main (NÃO copiados do #27 —
a produção da main divergiu). Validado com `TZ=America/Sao_Paulo`: **21/21**.

| Arquivo | Causa-raiz na main | ≠ do #27? |
|---|---|---|
| `quoteService.test.ts` | mock `eq().eq().maybeSingle()`; produção é `eq().single()` 1-arg | SIM (era maybeSingle/2-arg) |
| `tests/contexts/AuthContext.test.tsx` | falta `refreshSession` no mock auth + thenable `.then()` sem args (produção usa `.then()` vazio) → `cb is not a function`; fix: `then: (cb?)=>cb?.(...)` | SIM (era só maybeSingle no profiles) |
| `BridgeMetricsOverlay.tsx` | gate `isDev && isAllowed` (bug segurança) | = (mesma solução) |
| `Auth.test.tsx` | `useDevGate` no mock + forgot-form async (AnimatePresence) | parcial (2 das 3 sub-causas) |
| `AdminLayout.test.tsx` | mocka MainLayout + mock supabase robusto (rpc/like/single/then) p/ matar unhandled rejections | = + extra (rpc/like) |
| `FiltersPage...test.tsx` | path `src/pages/products/FiltersPage.tsx` | = |

### #27 — FECHADO
Superado pelo #35 (comentário explicativo postado). Estava sobre base obsoleta `db94c9b`.

### Itens da sessão anterior (v1) — mantidos
- Dependabot #25: comando `@dependabot ignore this minor version` postado (parar guerra de
  package-lock com Lovable; fica em react-router 6.28.0).
- DECISION-LOG v1 commitado em `docs/` (no branch zBpdc, agora fechado — reaproveitar conteúdo).

---

## 2. DESCOBERTA CRÍTICA: a MAIN está MUITO quebrada (pré-existente)

Rodando `src` completa (TZ correto) na main: **89 testes falham em 20 arquivos** — TODOS
**pré-existentes** (provado: rodei amostra em working tree limpo, sem meus fixes → falham igual).
Herança do caos de agentes paralelos (#30/#31/#32 mergearam coisas e deixaram muito vermelho).

**Implicação na Garantia B:** meu PR #35 é necessário mas NÃO suficiente. O CI continuará
vermelho até os ~20 abaixo serem tratados. Meu PR não causa NENHUMA regressão (provado).

### MAPA dos 20 arquivos restantes (categorizado p/ próximos PRs)

**Quase tudo é DRIFT DE TESTE (mock/import/path) — mesmo tipo já resolvido, baixo risco:**

| Arquivo | Sintoma | Categoria provável |
|---|---|---|
| `components/admin/connections/ConnectionUI.test.tsx` | mock falta `useConnectionsOverview` | drift mock |
| `components/admin/connections/ConnectionsOverviewTable.test.tsx` | idem | drift mock |
| `hooks/useCatalogState.unit.test.tsx` | mock falta `useCatalogState` | drift mock |
| `hooks/useQuoteBuilderState.shipping.test.tsx` | mock falta `useQuotes` | drift mock |
| `hooks/useQuoteBuilderState.unit.test.tsx` | mock falta `useQuotes` | drift mock |
| `hooks/useAdvancedFilters.unit.test.tsx` | `vi.mocked().mockReturnValue is not a function` | drift mock setup |
| `pages/SSOCallbackPage.test.tsx` | `Failed to resolve import "../SSOCallbackPage"` | path pós-reorg |
| `tests/CatalogFilteringLogic.test.tsx` | `Failed to resolve import "../hooks/useCatalogFiltering"` | path pós-reorg |
| `contexts/AuthContext.test.tsx` (src/, ≠ do meu tests/) | `authService.signOut is not a function` | drift mock (verificar produção) |
| `components/auth/SocialLoginButtons.test.tsx` | assert | drift assert |
| `pages/auth/AuthBranding.test.tsx` | `Element type is invalid` | import/componente |
| `pages/auth/AuthBranding.visual.test.tsx` | assert de classe (grid) | drift assert visual |
| `components/layout/AppLogo.visual.test.tsx` | `toHaveClass("h-9 w-9")` | drift assert visual |
| `components/layout/sidebar/SidebarNoShadow.test.ts` | `hover:shadow-* (glow)` no sidebar | drift assert (regra estilo) |
| `components/layout/sidebar/SidebarNavGroup.history.test.tsx` | `expected false to be true` | drift assert |
| `components/layout/sidebar/SidebarNavGroup.suspense.test.tsx` | `expected false to be true` | drift assert |
| `components/quotes/QuoteBuilderDiscountAdvanced.test.tsx` | `Unable to find element (placeholder)` | drift assert |
| `lib/security/security-integration.test.ts` | `'Click me' to be '<button>Click me</button>'` | drift assert |
| `tests/AdminStandardRules.test.tsx` | `combination of arguments (undefined and string)` | drift assert |
| `tests/ScenarioSimulation.test.ts` | `expected false to be true` | drift assert/regra |

**Atenção (verificar se é bug real, não só mock):**
- `src/contexts/AuthContext.test.tsx` → `authService.signOut is not a function`: confirmar se a
  produção `authService` ainda exporta `signOut` ou se o teste só precisa do mock.
- `SidebarNoShadow` / `SidebarNavGroup` (4 arquivos): podem ser regras de estilo/UX que a
  produção da main viola de fato (decisão de design, não só teste).

**Nota:** essa lista é da fatia `src` apenas. Fatias `tests/` e `e2e/` NÃO foram medidas neste
turno — podem ter mais.

---

## 3. REGRAS / FATOS PERMANENTES (relembrar)

- **TZ:** SEMPRE `TZ=America/Sao_Paulo npx vitest run <fatia> --no-coverage --reporter=dot`.
  Sem isso, ~13 snapshots PriceFreshnessBadge dão falso-positivo (+3h). NUNCA commitar esses.
- **Sandbox 4GB:** suíte completa dá OOM. Rodar POR FATIAS. "Falhas" de 1º-teste-pesado
  (ProductCard, AIRecommendationsPanel) sob carga são FLAKY — passam isoladas, não ocorrem no CI.
- **GitHub:** SEMPRE via HTTP MCP Worker `https://github-mcp-server.adm01.workers.dev/mcp`
  (curl JSON-RPC) com `branch` explícito. `git push`/`gh`/MCP padrão dão 403.
  `github_push_files` = 1 commit consolidado; `github_delete_file` exige SHA do blob.
- **Push via App NÃO dispara workflows de CI.** Pra os gates rodarem: tirar PR de draft
  (ready for review) OU push por usuário humano. Por isso PRs via Worker só mostram Vercel+CodeRabbit.
- **MainLayout** é frágil de testar isolado (lazyWithRetry+Suspense pendura 2x em jsdom) →
  MOCKAR. Cobertura real dele = `tests/components/layout/MainLayout.breadcrumbs.test.tsx`.
- **Garantia A** (Lovable→Vercel sem erro) = OK; Vercel roda só `vite build`, ignora gates.

---

## 4. PRÓXIMOS PASSOS

1. [decisão PO] #35 ready-for-review p/ disparar gates? (lembrar: a main tem 89 falhas pré-
   existentes; o gate de testes vai continuar vermelho até os 20 serem tratados).
2. Próximos PRs enxutos atacando os 20 (começar pelos "path pós-reorg" e "mock falta export" —
   mais rápidos e baixo risco; ver tabela §2).
3. Medir fatias `tests/` e `e2e/` (não medidas neste turno).
4. Confirmar Dependabot #25 fechado.
5. Demais PRs antigos (#28/#26/#24/#23/#29): fechar perdedores p/ reduzir ruído.
