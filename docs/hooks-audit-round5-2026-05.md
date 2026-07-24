# Hooks Audit — Round 5 (2026-05-27)

## Resumo Executivo

Round 5 da auditoria exaustiva de hooks do sistema `promo-gifts-v4`. Foram analisados **270+ hooks** em `src/hooks/`, `src/components/` e `src/stores/`. Esta rodada identificou e corrigiu **7 novos bugs** (BUG-20 a BUG-26), com foco especial em guards de unmount, AbortController para fetches externos, e isolamento de estado de módulo.

**Branch:** `claude/hooks-audit-bugs-t3VC5`  
**Data:** 2026-05-27  
**Auditores:** Claude Code (automatizado)

---

## Bugs Corrigidos nesta Rodada

### BUG-20 — `useSpeechRecognition.ts` (P1 — Crítico)

**Arquivo:** `src/hooks/intelligence/useSpeechRecognition.ts`  
**Severidade:** P1 — Funcionalidade quebrada em uso real

**Causa Raiz:**  
`onResult` e `onError` estavam nas dependências do `useEffect` que cria a instância `SpeechRecognition` (linha 92 original: `}, [isSupported, language, onResult, onError]`). Quando o componente pai passa callbacks inline (não memoizados com `useCallback`), cada re-render do pai gera novas referências de função → o `useEffect` dispara → a instância `SpeechRecognition` existente é destruída (`.abort()`) e uma nova é criada. O usuário perde o áudio capturado no meio da fala.

**Impacto:**  
- Sessões de reconhecimento de voz interrompidas silenciosamente
- Usuário precisa apertar o botão de microfone novamente após qualquer re-render do pai
- Difícil de debugar — parece falha de hardware

**Fix Aplicado:**
```typescript
// Antes (bug):
}, [isSupported, language, onResult, onError]);

// Depois (correto):
const onResultRef = useRef(onResult);
const onErrorRef = useRef(onError);
onResultRef.current = onResult; // atualizado sincronamente a cada render
onErrorRef.current = onError;

// handlers usam refs:
onResultRef.current?.(finalTranscript.trim()); // não onResult?.(...)
onErrorRef.current?.(message);                 // não onError?.(...)

}, [isSupported, language]); // onResult/onError removidos das deps
```

**Teste de Regressão:** `tests/hooks/useSpeechRecognition-callback-stability.test.ts`

---

### BUG-21 — `useGeoBlocking.ts` fetchData sem isMounted (P2)

**Arquivo:** `src/hooks/admin/useGeoBlocking.ts`  
**Severidade:** P2 — Memory leak / warning em desenvolvimento

**Causa Raiz:**  
`fetchData` (useCallback sem deps) executa um `Promise.all` de duas queries Supabase sem verificar se o componente ainda está montado. O BUG-17 (Round 3) corrigiu apenas `fetchCurrentCountry` com AbortController, mas `fetchData` ficou sem guard. Se o usuário navegar para fora da página `/admin/seguranca` enquanto as queries estão em vôo, `setCountries`, `setSettings` e `setIsLoading(false)` são chamados em componente desmontado.

**Fix Aplicado:**
```typescript
const mountedRef = useRef(true);

// No fetchData:
if (!mountedRef.current) return; // guard pré-await
// ... Promise.all ...
if (!mountedRef.current) return; // guard pós-await
setCountries(...);
// ...
if (mountedRef.current) setIsLoading(false); // no finally

// No useEffect:
useEffect(() => {
  mountedRef.current = true;
  // ...
  return () => { mountedRef.current = false; controller.abort(); };
}, [fetchCurrentCountry, fetchData]);
```

**Teste de Regressão:** `tests/hooks/useGeoBlocking-fetchdata-unmount.test.ts`

---

### BUG-22 — `useAllowedIPs.ts` fetchCurrentIP sem AbortController (P2)

**Arquivo:** `src/hooks/admin/useAllowedIPs.ts`  
**Severidade:** P2 — Memory leak / setState após unmount

**Causa Raiz:**  
`fetchCurrentIP` realizava um fetch HTTP externo a `https://api.ipify.org?format=json` sem passar `AbortSignal` nem checar `isMounted`. Round-trip típico: 200-600ms — tempo mais que suficiente para o usuário navegar para outra página. `fetchAllowedIPs` também não tinha guard de `isMounted`.

**Fix Aplicado:**
```typescript
// fetchCurrentIP aceita signal:
const fetchCurrentIP = useCallback(async (signal?: AbortSignal) => {
  try {
    const response = await fetch('https://api.ipify.org?format=json', { signal });
    const data = await response.json() as { ip: string };
    if (mountedRef.current) setCurrentIP(data.ip);
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') return; // silencia
    console.error('Error fetching current IP:', error);
  }
}, []); // mountedRef estável

// useEffect com cleanup:
useEffect(() => {
  mountedRef.current = true;
  const controller = new AbortController();
  fetchCurrentIP(controller.signal);
  fetchAllowedIPs();
  return () => {
    mountedRef.current = false;
    controller.abort();
  };
}, [fetchCurrentIP, fetchAllowedIPs]);
```

**Teste de Regressão:** `tests/hooks/useAllowedIPs-abort.test.ts`

---

### BUG-23 — `useAccessSecurity.ts` fetchAll sem isMounted (P2)

**Arquivo:** `src/hooks/auth/useAccessSecurity.ts`  
**Severidade:** P2 — setState após unmount (4 queries simultâneas)

**Causa Raiz:**  
`fetchAll` executava 4 queries em `Promise.all` (settings, IPs, cidades, logs) sem nenhum guard de `isMounted`. O bloco `finally { setIsLoading(false) }` era particularmente problemático — disparava incondicionalmente mesmo após unmount, em todos os 4 caminhos de execução (sucesso, erro de cada query, timeout).

**Fix Aplicado:**
```typescript
const mountedRef = useRef(true);
useEffect(() => {
  mountedRef.current = true;
  return () => { mountedRef.current = false; };
}, []);

const fetchAll = useCallback(async () => {
  if (!mountedRef.current) return; // guard pré-await
  setIsLoading(true);
  try {
    const [...] = await Promise.all([...]);
    if (!mountedRef.current) return; // guard pós-await
    // setters...
  } catch (error) {
    if (!mountedRef.current) return;
    console.error(...);
  } finally {
    if (mountedRef.current) setIsLoading(false); // condicional
  }
}, []);
```

**Teste de Regressão:** `tests/hooks/useAccessSecurity-unmount.test.ts`

---

### BUG-24 — `useSearchAsYouType` onSearch nas deps (P3)

**Arquivo:** `src/hooks/common/useDebounce.ts` (função `useSearchAsYouType`)  
**Severidade:** P3 — Re-execuções desnecessárias, possível loop

**Causa Raiz:**  
`onSearch` estava listado nas dependências do `useEffect` que monitora `debouncedQuery`. Callers que passam `onSearch` como callback inline (padrão extremamente comum) recebem nova referência a cada render do componente pai. Resultado: `useEffect` re-executa a cada render, potencialmente disparando buscas extras ou setando `isSearching` em ciclos.

**Fix Aplicado:**
```typescript
// Adicionar ref:
const onSearchRef = useRef(onSearch);
onSearchRef.current = onSearch; // atualizado sincronamente

// useEffect usa ref:
useEffect(() => {
  if (debouncedQuery.length >= minLength) {
    setIsSearching(true);
    onSearchRef.current(debouncedQuery); // ref, não closure
    setIsSearching(false);
  } else if (debouncedQuery.length === 0) {
    onSearchRef.current('');
  }
}, [debouncedQuery, minLength]); // onSearch REMOVIDO

// clear também usa ref:
const clear = useCallback(() => {
  setQuery('');
  onSearchRef.current('');
}, []); // onSearch removido das deps de clear
```

**Teste de Regressão:** Adicionado a `tests/hooks/useDebounce-extended.test.ts`

---

### BUG-25 — `useGlobalShortcuts.ts` lastGAt em escopo de módulo (P3)

**Arquivo:** `src/hooks/ui/useGlobalShortcuts.ts`  
**Severidade:** P3 — Estado compartilhado entre instâncias e entre testes

**Causa Raiz:**  
```typescript
// Linha ~30 do original — singleton de módulo:
let lastGAt = 0;
```
Esta variável era compartilhada entre **todas as instâncias** do hook na mesma sessão de browser e entre execuções de testes (o módulo é cached pelo bundler). Um "G" pressionado em uma instância poderia ativar o chord "G→K" em outra instância montada simultaneamente. Em testes, o estado não era resetado entre suites, causando falsos positivos/negativos intermitentes (flaky tests).

**Fix Aplicado:**
```typescript
// Dentro de useGlobalShortcuts():
const lastGAtRef = useRef(0); // isolado por instância

// No handler:
if (e.key === 'g' || e.key === 'G') {
  lastGAtRef.current = Date.now();
  return;
}
if ((e.key === 'k' || e.key === 'K') && Date.now() - lastGAtRef.current < 800) {
  e.preventDefault();
  lastGAtRef.current = 0;
  navigate('/meus-kits');
  return;
}
```

**Teste de Regressão:** `tests/hooks/useGlobalShortcuts-lastgat-isolation.test.ts`

---

### BUG-26 — `useConnectionsOverview.ts` load sem isMounted (P2)

**Arquivo:** `src/hooks/intelligence/useConnectionsOverview.ts`  
**Severidade:** P2 — setState após unmount no polling

**Causa Raiz:**  
`load` (useCallback sem deps) chamava `setRows`, `setLoading` e `setRefreshing` após uma query Supabase sem verificar `mountedRef`. Com polling a cada 30s, havia chance elevada de o componente ser desmontado entre fetches. Descoberto durante análise do Task 17 do plano.

**Fix Aplicado:**
```typescript
const mountedRef = useRef(true);

const load = useCallback(async (silent = false) => {
  if (!silent) setRefreshing(true);
  const { data, error } = await supabase.from('external_connections').select(...);
  if (!mountedRef.current) return; // guard pós-await
  if (!error && data) { setRows(mapped); }
  setLoading(false);
  setRefreshing(false);
}, []);

useEffect(() => {
  mountedRef.current = true;
  load(true);
  if (pollMs <= 0) return () => { mountedRef.current = false; };
  const id = setInterval(() => load(true), pollMs);
  return () => {
    mountedRef.current = false;
    clearInterval(id);
  };
}, [load, pollMs]);
```

---

## Análise de Hooks Adicionais (sem bugs)

### `src/components/admin/connections/` (10 hooks auditados)

| Hook | Status | Padrão |
|------|--------|--------|
| `useFocusContext.ts` | ✅ Clean | localStorage TTL (30min), nenhum fetch |
| `useZoneCollapse.ts` | ✅ Clean | localStorage persistence, sem async |
| `useSeverityChangeNotifier.ts` | ✅ Clean | stateRef mutation, toast deduplication |
| `useSecretField.ts` | ✅ Clean | normTimerRef + abortRef, AbortController correto |
| `useIncidentSeverityCounts.ts` | ✅ Clean | puro useMemo sobre dados do useRecentIncidents |
| `useIncidentTimeline72h.ts` | ✅ Clean | useQuery (react-query gerencia lifecycle) |
| `useRecentIncidents.ts` | ✅ Clean | useQuery com staleTime/refetchInterval |
| `useZoneVisibility.ts` | ✅ Clean | localStorage, useCallback correto, sem async |
| `useIncidentDetails.ts` | ✅ Clean | useQuery com enabled guard |
| `usePulseBarStatus.ts` | ✅ Clean | useQuery com refetchInterval |

### `src/hooks/bi/` (14 hooks auditados)

Todos os hooks de BI usam `useQuery` do `@tanstack/react-query`, que gerencia o ciclo de vida (cleanup, cancellação) internamente. Nenhum bug encontrado.

Exceção: `useSeasonalPeakNotifications.ts` usa `useEffect` com async IIFE para inserir notificação no Supabase. Padrão de "fire-and-forget" com deduplicação por localStorage — aceitável pois não atualiza estado do componente após o insert; sem bug.

---

## Padrões Utilizados nos Fixes

### 1. Callback Instável → Ref (BUG-20, BUG-24)
```typescript
const onXxxRef = useRef(onXxx);
onXxxRef.current = onXxx; // atualização síncrona, sem useEffect

// No useEffect / handlers:
onXxxRef.current?.(value);

// Deps do useEffect:
}, [/* onXxx REMOVIDO */]);
```
**Quando usar:** sempre que um callback passado como prop ou argumento for listado nas deps de um useEffect que cria recursos caros (SpeechRecognition, WebSocket, subscription) ou que tenha side effects frequentes.

### 2. mountedRef para useCallback compartilhado (BUG-21, BUG-22, BUG-23, BUG-26)
```typescript
const mountedRef = useRef(true);
useEffect(() => {
  mountedRef.current = true;
  return () => { mountedRef.current = false; };
}, []);

const fetchData = useCallback(async () => {
  if (!mountedRef.current) return;     // guard pré-await
  try {
    const result = await asyncOp();
    if (!mountedRef.current) return;   // guard pós-await
    setSomething(result);
  } finally {
    if (mountedRef.current) setLoading(false);
  }
}, []); // mountedRef é estável — sem precisar nas deps
```
**Quando usar:** qualquer `useCallback` que execute operações async e depois atualiza state. Preferível ao `isMounted` local dentro do effect pois funciona com callbacks chamados de múltiplos efeitos.

### 3. AbortController para Fetch Externo (BUG-22)
```typescript
const fetchXxx = useCallback(async (signal?: AbortSignal) => {
  try {
    const r = await fetch(URL, { signal });
    const d = await r.json();
    if (mountedRef.current) setXxx(d);
  } catch (e) {
    if (e instanceof Error && e.name === 'AbortError') return; // silenciar
    console.error(e);
  }
}, []);

useEffect(() => {
  mountedRef.current = true;
  const ctrl = new AbortController();
  fetchXxx(ctrl.signal);
  return () => { mountedRef.current = false; ctrl.abort(); };
}, [fetchXxx]);
```
**Quando usar:** qualquer `fetch()` HTTP externo (ipify.org, ipapi.co, etc.) dentro de um hook.

### 4. Timing State → useRef por Instância (BUG-25)
```typescript
// ❌ ERRADO: singleton de módulo
let lastActionAt = 0;

// ✅ CORRETO: isolado por instância
const lastActionAtRef = useRef(0);
// Usar: lastActionAtRef.current = Date.now()
```
**Quando usar:** qualquer variável de timing/debounce/throttle que precise ser isolada por instância do hook e resetada entre testes.

---

## Testes Criados

| Arquivo | Bug | Cenários |
|---------|-----|----------|
| `useSpeechRecognition-callback-stability.test.ts` | BUG-20 | 4 — não recria instância ao mudar onResult/onError, usa callback mais recente, recria ao mudar language |
| `useGeoBlocking-fetchdata-unmount.test.ts` | BUG-21 | 2 — sem erro no unmount antes do fetch, estado correto após mount normal |
| `useAllowedIPs-abort.test.ts` | BUG-22 | 3 — aborta fetch ao desmontar, silencia AbortError, define IP em fetch normal |
| `useAccessSecurity-unmount.test.ts` | BUG-23 | 3 — sem erro no unmount rápido, carregamento normal, finally condicional |
| `useDebounce-extended.test.ts` (adição) | BUG-24 | 3 — não re-executa ao mudar ref, usa callback mais recente, clear usa ref |
| `useGlobalShortcuts-lastgat-isolation.test.ts` | BUG-25 | 4 — isolamento entre instâncias, chord G→K funciona, G→K não dispara após 800ms, reset após ativação |

---

## Histórico Acumulado de Auditorias

| Round | Data | Bugs | Foco |
|-------|------|------|------|
| Round 1 | Abr 2026 | BUG-01 a BUG-07 | Stale closures, timer cleanup, useCallback |
| Round 2 | Mai 2026 | 19 testes de regressão | Cobertura de testes para R1 |
| Round 3 | Mai 2026 | BUG-08 a BUG-17 | isMounted, AbortController, polling |
| Round 4 | Mai 2026 | BUG-18, BUG-19 | isMounted em quotes, Math.max guard |
| **Round 5** | **Mai 2026** | **BUG-20 a BUG-26** | **Callbacks em deps, mountedRef, AbortController externo, singleton** |
| **TOTAL** | | **26** | |
