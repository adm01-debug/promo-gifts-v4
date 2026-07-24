# Auditoria de Hooks — Round 3 — Maio 2026

> **Branch:** `fix/hooks-audit-round3-2026-05`
> **Escopo:** 378 arquivos de hooks em 21 diretórios de `src/hooks/`
> **Data:** 26/05/2026
> **Auditores:** Claude Sonnet 4.6 (análise automática) + TIPROMO (revisão)

---

## Metodologia

Leitura exaustiva de todos os hooks do projeto, verificando padrões de:

1. **Stale closures** — callbacks capturando state/props desatualizados
2. **Memory leaks** — timers, subscriptions e listeners não limpos no unmount
3. **Race conditions** — setState após unmount em promises assíncronas
4. **Redundância** — `useMemo` duplicados com mesmas deps
5. **Deps incorretas** — deps que causam re-runs desnecessários
6. **Computações fora de useMemo** — estruturas recalculadas em todo render

---

## Bugs Encontrados e Corrigidos

### BUG-08 🔴 P1 — `useKitAutoSave.ts`

**Sintoma:** Auto-save silenciosamente cancelado após recalculos de preço.

**Causa raiz:** `saveToDb` estava nas deps do snapshot `useEffect`. Qualquer mudança em `kitState` (incluindo `totalPrice` recalculado em background) recriava `saveToDb`, triggering o effect. O snapshot era igual → o effect retornava cedo — **mas o cleanup (clearTimeout) da iteração anterior ainda executava**, cancelando o timer pendente sem criar um novo.

**Fix:** Padrão `saveToDbRef` — ref atualizada a cada render, timeout lê do ref. `saveToDb` removido das deps do snapshot effect.

**Commit:** `e1a71ac6`

**Impacto:** Kit Builder pode perder trabalho do usuário sem aviso se o preço for recalculado durante os 5s de debounce.

---

### BUG-09 🟡 P2 — `useEntitySelectionMode.ts`

**Sintoma:** Computação desnecessária duplicada em seleções de novidades/reposições.

**Causa raiz:** `bulkCartProducts` e `selectedProducts` eram dois `useMemo` com código e deps identicamente iguais — loop de filter+map executado 2× por render com seleção ativa.

**Fix:** Remover `bulkCartProducts` como `useMemo` separado. Expô-lo como alias de `selectedProducts`.

**Commit:** `92836670`

---

### BUG-10 🔴 P1 — `useWorkspaceNotifications.tsx`

**Sintoma:** Polling de notificações nunca dispara 30s após uma notificação ser lida.

**Causa raiz:** `notifications.length` nas deps de `fetchNotifications`. Cada `markAsRead` → `setNotifications` → `notifications.length` muda → `fetchNotifications` recriado → polling `useEffect` re-executa → `clearInterval` + novo `setInterval` → timer de 30s resetado.

**Fix:** Substituir `notifications.length` por `notificationsLengthRef.current` (atualizado a cada render). Remover `notifications.length` das deps de `fetchNotifications`.

**Commit:** `be644b5b`

---

### BUG-11 🟠 P2 — `useGravacaoPriceV2.ts` (`useCustomizationPriceReactiveLegacy`)

**Sintoma:** Warning React "Can't perform a React state update on an unmounted component".

**Causa raiz:** Hook deprecated (`@deprecated`) mas ainda em uso em código legado. A promise `.then/.catch/.finally` não verifica se o componente ainda está montado antes de chamar `setPrice`, `setError`, `setLoading`.

**Fix:** Flag `let isMounted = true` + `return () => { isMounted = false }` no useEffect. Cada setState verificado com `if (isMounted)`.

**Commit:** `c1cff22c`

---

### BUG-12 🟠 P2 — `useTechniquePricing.ts`

**Sintoma:** Warning React + possível exibição de dados de técnica anterior sobreescrevendo a nova seleção.

**Causa raiz:** `fetchPriceOptions` definido dentro de `useEffect` sem mecanismo de cancelamento. Se `techniqueCode` mudar rapidamente (usuário navegando entre técnicas), a promise da chamada anterior resolve e chama `setPriceOptions`/`setError`/`setIsLoading` no componente que já estava em cleanup.

**Fix:** Flag `isMounted` com cleanup.

**Commit:** `2e9ddd0c`

---

### BUG-13 🟡 P3 — `useKitStockValidation.ts`

**Sintoma:** Performance — CPU spike em kits grandes ao re-render por scroll/hover.

**Causa raiz:** `stockByProduct` (Map) e `alerts` (Array) declarados como variáveis fora de `useMemo`. Em cada render, o loop O(n) que agrega estoque e verifica alertas executa novamente, mesmo que `stockData`, `box`, `items` e `kitQuantity` não tenham mudado.

**Fix:** Ambos encapsulados em um único `useMemo` com deps `[stockData, box, items, kitQuantity]`.

**Commit:** `b32767b5`

---

### BUG-14 🟡 P2 — `usePositionHistory.ts`

**Sintoma:** Primeiro passo de undo perdido em drag rápido de logo.

**Causa raiz:** `pushState` capturava `historyIndex` via closure e o usava no callback de `setHistory`. Se chamado duas vezes antes do re-render (ex: mouseMove gerando duas atualizações batched), a segunda chamada usava o mesmo `historyIndex` stale — `prev.slice(0, historyIndex+1)` cortava no mesmo ponto da primeira, efetivamente descartando o primeiro push.

**Fix:** Migrado para `useReducer` com reducer `historyReducer` que atualiza `history` e `historyIndex` atomicamente em um único dispatch. Sem stale closure possível.

**Commit:** `28068286`

---

### BUG-15 🟡 P3 — `useRecentlyViewed.ts`

**Sintoma:** Memory leak minor — timeout não limpo após unmount do componente.

**Causa raiz:** O `setTimeout` de 1s em `addToRecentlyViewed` que reseta o `lastAddedRef` não armazenava o id retornado. Se o componente desmontasse dentro desse segundo, o timeout continuava pendente.

**Fix:** `dedupeTimerRef` armazena o id do timeout. `useEffect` cleanup o limpa no unmount. Timeout anterior limpo antes de criar o próximo.

**Commit:** `869c2ab9`

---

### BUG-16 🟡 P3 — `useKitUndoRedo.ts`

**Sintoma:** Timeout de 100ms em undo/redo não limpo no unmount; instável em sistemas lentos.

**Causa raiz:** `setTimeout(() => { isRestoringRef.current = false; }, 100)` em `undo()` e `redo()` não armazenava o id retornado. Timeout não limpo no unmount. Chamadas rápidas de undo/redo podiam stackar múltiplos timers. `reset()` também não cancelava o timer em flight.

**Fix:** `restoreTimerRef` gerencia centralmente o timer. Timeout anterior limpo antes de criar o próximo. `useEffect` cleanup no unmount. `reset()` também limpa o timer.

**Commit:** `840027f2`

---

### BUG-17 🟠 P2 — `useGeoBlocking.ts`

**Sintoma:** Warning React "Can't perform a React state update on an unmounted component" ao navegar rapidamente pela área admin.

**Causa raiz:** `fetchCurrentCountry` faz `fetch('https://ipapi.co/json/')` sem `AbortController`. Se o admin navegar para outra página antes da resposta retornar (~200-500ms de latência), `setCurrentCountry` é chamado em componente já desmontado.

**Fix:** `fetchCurrentCountry` agora aceita `signal?: AbortSignal`. O `useEffect` cria um `AbortController`, passa o sinal para o fetch, e chama `controller.abort()` no cleanup. `AbortError` é silenciado.

**Commit:** `0ec1f22f`

---

## Resumo dos Commits

| Commit | Bug | Arquivo |
|---|---|---|
| `e1a71ac6` | BUG-08 | `src/hooks/kit-builder/useKitAutoSave.ts` |
| `92836670` | BUG-09 | `src/hooks/common/useEntitySelectionMode.ts` |
| `be644b5b` | BUG-10 | `src/hooks/ui/useWorkspaceNotifications.tsx` |
| `c1cff22c` | BUG-11 | `src/hooks/simulation/useGravacaoPriceV2.ts` |
| `2e9ddd0c` | BUG-12 | `src/hooks/simulation/useTechniquePricing.ts` |
| `b32767b5` | BUG-13 | `src/hooks/kit-builder/useKitStockValidation.ts` |
| `28068286` | BUG-14 | `src/hooks/simulation/usePositionHistory.ts` |
| `869c2ab9` | BUG-15 | `src/hooks/products/useRecentlyViewed.ts` |
| `840027f2` | BUG-16 | `src/hooks/kit-builder/useKitUndoRedo.ts` |
| `0ec1f22f` | BUG-17 | `src/hooks/admin/useGeoBlocking.ts` |

---

## Resumo por Diretório Auditado

| Diretório | Arquivos | Bugs |
|---|---|---|
| `kit-builder/` | 19 | BUG-08, BUG-13, BUG-16 |
| `common/` | 17 | BUG-09 |
| `ui/` | 16 | BUG-10 |
| `simulation/` | 18 | BUG-11, BUG-12, BUG-14 |
| `products/` | 54 | BUG-15 |
| `admin/` | 14 | BUG-17 |
| `auth/` | 10 | ✅ Nenhum |
| `quotes/` | 16 | ✅ Nenhum |
| `intelligence/` | 31 | ✅ Nenhum |
| `bi/` | 14 | ✅ Nenhum |
| `crm/` | 7 | ✅ Nenhum |
| `favorites/` | 8 | ✅ Nenhum |
| `comparison/` | 6 | ✅ Nenhum |
| `simulator/` | 8 | ✅ Nenhum |
| `voice/` | 12 | ✅ Nenhum |
| `tecnicas/` | 7 | ✅ Nenhum |
| `mockup/` | 5 | ✅ Nenhum |
| `gravacao/` | 6 | ✅ Nenhum |
| `collections/` | 3 | ✅ Nenhum |
| `dev/` | 2 | ✅ Nenhum |
| `stock/` | 2 | ✅ Nenhum |

**Total auditado:** 378 arquivos | **Bugs encontrados e corrigidos:** 10

---

## Histórico de Auditorias

| Round | Data | PR | Bugs |
|---|---|---|---|
| Round 1 | Abr 2026 | #427, #431 | BUG-01 a BUG-07 |
| Round 2 (testes) | Mai 2026 | #433 | 19 testes de regressão para Round 1 |
| **Round 3** | **Mai 2026** | **Este PR** | **BUG-08 a BUG-17** |
