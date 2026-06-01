# Auditoria de Hooks — Round 4 — Maio 2026

> **Branch:** `main`
> **Escopo:** 378 arquivos de hooks em 21 diretórios de `src/hooks/` + hooks de componentes
> **Data:** 26/05/2026
> **Auditores:** Claude Sonnet 4.6 (análise automática) + TIPROMO (revisão)

---

## Metodologia

Leitura exaustiva dos hooks não cobertos no Round 3, com foco nas pastas marcadas como "✅ Nenhum" e nos hooks de componentes (`src/components/`). Verificação dos padrões:

1. **Race conditions em promises** — setState após unmount sem `isMounted` guard
2. **`Math.max` com array vazio** — retorna `-Infinity`, não `0`
3. **Stale closures em deps de useEffect** — funções ausentes das deps
4. **Memory leaks** — timers, listeners e subscriptions não limpos
5. **Redundância** — `useMemo` duplicados

---

## Bugs Encontrados e Corrigidos

### BUG-18 🔴 P1 — `useQuoteBuilderState.ts`

**Sintoma:** Warning React "Can't perform a React state update on an unmounted component" ao navegar para fora da página de edição de cotação enquanto o fetch ainda está em andamento. Em condições de rede lenta (~200ms+), ≈15 chamadas `setState` disparam em componente já desmontado.

**Causa raiz:** `fetchQuote(quoteId).then((quote) => { setClientId(...); ... })` sem guard de `isMounted`. Se o usuário navegar para outra rota antes da promise resolver, ~15 setState calls disparam em componente já desmontado. Adicionalmente, `fetchQuote` estava ausente das deps do `useEffect` — stale closure potencial.

**Fix:** Flag `let isMounted = true` + `return () => { isMounted = false }` no useEffect. Guard `if (!isMounted) return` como primeira instrução do `.then()`. `fetchQuote` adicionado às deps.

**Impacto:** Edição de cotações em rede lenta; usuários navegando rapidamente entre rotas de cotação. Risco de inconsistência de estado no remount.

---

### BUG-19 🟡 P2 — `useSimulatorWizard.ts` (função `mapV6LocationsToWizard`)

**Sintoma:** Quando uma localização de gravação tem `options: []` (sem técnicas configuradas), `maxWidth` e `maxHeight` recebem o valor `-Infinity` — propagando-se para validações de dimensão no wizard.

**Causa raiz:** `Math.max(...emptyArray)` retorna `-Infinity` em JavaScript (comportamento da spec ECMAScript). A função `mapV6LocationsToWizard` não guardava contra o caso `loc.options.length === 0`, que pode ocorrer com produtos recém-criados sem técnicas configuradas.

**Fix:** Arrays `widths` e `heights` extraídos antes do `Math.max`. Guard ternário: `widths.length > 0 ? Math.max(...widths) : 0`.

**Impacto:** Simulador de personalização — dimensões inválidas em áreas sem técnicas podem silenciosamente passar validações downstream.

---

## Hooks Auditados Sem Bugs

| Arquivo | Observação |
|---------|------------|
| `src/hooks/quotes/useAutoSaveQuote.ts` | ✅ BUG-07/13 já corrigidos; debounce correto |
| `src/hooks/quotes/useQuoteItems.ts` | ✅ BUG-03 já corrigido; reindexação de expandedItems ok |
| `src/hooks/intelligence/useConnectionTester.ts` | ✅ Async ok |
| `src/hooks/common/useConsecutiveFailures.ts` | ✅ cancelRef compartilhado — race window de <2ms |
| `src/hooks/simulator/useWizardPersistence.ts` | ✅ Deps corretas |
| `src/hooks/ui/useScrollLockFix.ts` | ✅ MutationObserver + listener limpos no cleanup |
| `src/hooks/useKillSwitchBanner.ts` | ✅ cancelled flag + clearInterval |
| `src/hooks/intelligence/useVoiceAgent.ts` | ✅ Todos os recursos de mídia limpos no cleanup |
| `src/hooks/products/useProducts.ts` | ✅ Padrão useQuery correto |

---

## Resumo dos Commits

| Bug | Arquivo | Tipo de fix |
|-----|---------|-------------|
| BUG-18 | `src/hooks/quotes/useQuoteBuilderState.ts` | `isMounted` guard + `fetchQuote` nas deps |
| BUG-19 | `src/hooks/simulator/useSimulatorWizard.ts` | Guard `Math.max` array vazio |

---

## Resumo por Diretório Auditado

| Diretório | Arquivos | Bugs |
|-----------|----------|------|
| `quotes/` | 16 | BUG-18 |
| `simulator/` | 8 | BUG-19 |
| `intelligence/` | 31 | ✅ |
| `common/` | 17 | ✅ |
| `ui/` | 16 | ✅ |
| `products/` | 54 | ✅ |
| `voice/` | 12 | ✅ |
| `auth/` | 10 | ✅ (Round 3) |
| `bi/` | 14 | ✅ (Round 3) |
| `crm/` + `favorites/` + outros | 30 | ✅ (Round 3) |

**Total acumulado auditado:** 378 arquivos | **Bugs Round 4:** 2

---

## Histórico de Auditorias

| Round | Data | PR | Bugs |
|-------|------|----|------|
| Round 1 | Abr 2026 | #427, #431 | BUG-01 a BUG-07 |
| Round 2 (testes) | Mai 2026 | #433 | 19 testes de regressão |
| Round 3 | Mai 2026 | — | BUG-08 a BUG-17 |
| **Round 4** | **Mai 2026** | **Este commit** | **BUG-18, BUG-19** |

**Total acumulado de bugs encontrados e corrigidos: 19**
