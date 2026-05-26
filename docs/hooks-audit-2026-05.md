# Hooks Audit -- promo-gifts-v4 (2026-05)

Auditoria exaustiva de todos os 270 hooks do sistema. Tres rodadas de analise.
Status: BUG-01 a BUG-14 **corrigidos**.

---

## Resumo Executivo

| ID | Sev | Arquivo | Descricao | Status |
|---|---|---|---|---|
| BUG-01 | P0 | `useStepUpAuth.ts` | Stale closure: `challengeId` sempre `null` | Corrigido |
| BUG-02 | P0 | `useQuoteBuilderState.ts` | `contactId` preenchido com `client_id` | Corrigido |
| BUG-03 | P1 | `useQuoteItems.ts` | `removeItem` nao reindexava `expandedItems` | Corrigido |
| BUG-04 | P1 | `useRBAC.tsx` | Query `role_permissions` desnecessaria para `dev` | Corrigido |
| BUG-05 | P2 | `useQuoteBuilderState.ts` | Dep fantasma `productSearch` em `filteredProducts` | Corrigido |
| BUG-06 | P2 | `useLoginAttempts.ts` | `staleTime` ausente | Corrigido |
| BUG-07 | P2 | `useAutoSaveQuote.ts` | `onRestore` inline nas deps | Corrigido |
| BUG-08 | P1 | `useWorkspaceNotifications.tsx` | `notifications.length` em deps resetava polling | Corrigido |
| BUG-09 | P2 | `useDebounce.ts` | `useThrottle` implementava debounce | Corrigido |
| BUG-10 | P0 | `use2FA.ts` | `totp_secret` exposto no cliente via SELECT | Corrigido |
| BUG-11 | P1 | `useKitAutoSave.ts` | `onKitIdCreated` inline cancelava timer de 5s | Corrigido |
| BUG-12 | P2 | `useTechniquePricing.ts` | `external-db-bridge` para tabela local | Corrigido |
| BUG-13 | P3 | `useAutoSaveQuote.ts` | `clearAutoSave` nao memoizado | Corrigido |
| BUG-14 | P1 | `usePrintAreas.ts` | Todas as funcoes usavam bridge para tabelas locais | Corrigido |

---

## BUG-08 -- useWorkspaceNotifications.tsx: Polling nunca disparava

`fetchNotifications` tinha `[user, notifications.length]` nas deps. Cada fetch
atualiza `notifications` -> `fetchNotifications` recriado -> useEffect de polling
cancela e recria o `setInterval` -> timer de 30s sempre resetado.

**Fix:** `notificationsLengthRef = useRef()` sincronizado via useEffect,
lido dentro do callback. Deps de `fetchNotifications` reduzidas para `[user]`.

---

## BUG-09 -- useDebounce.ts: useThrottle = debounce

`return () => clearTimeout(handler)` no cleanup cancelava o timer a cada
mudanca -> nenhuma emissao ate parar de digitar = debounce.

**Fix:** Leading-edge imediato + trailing update via refs.
Timer de unlock **sem** clearTimeout no cleanup.

---

## BUG-10 -- use2FA.ts: totp_secret no cliente (CRITICO P0)

`disable2FA` fazia `.select('totp_secret')` e verificava TOTP client-side.
Secret em plaintext na rede -> exposto a XSS.

**Fix:** Delega para Edge Function `verify-2fa-token` (action: `disable`).
**PRE-REQUISITO:** Deploy da Edge Function `verify-2fa-token` com action `disable`.

---

## BUG-11 -- useKitAutoSave.ts: Timer de 5s cancelado por re-renders

`onKitIdCreated` (inline do pai) nas deps de `saveToDb` -> recriado a cada
render -> cleanup do snapshot effect cancelava o timer de 5s -> auto-save
nunca executava.

**Fix:** Refs para props instaveis (`kitState`, `kitQuantity`, `onKitIdCreated`).
Deps estaveis em `saveToDb`. Cleanup de unmount em effect dedicado.

---

## BUG-12 -- useTechniquePricing.ts: Bridge para tabela local

Apos Caminho B (PRs #230-232): `customization_price_tables` e LOCAL.
Ainda usava `external-db-bridge`.

**Fix:** `supabase.from('customization_price_tables').select(...)` direto.

---

## BUG-13 -- useAutoSaveQuote.ts: clearAutoSave nao memoizado

**Fix:** `useCallback([key])`.

---

## BUG-14 -- usePrintAreas.ts: Todas as queries via bridge (locais)

Cinco funcoes usavam `external-db-bridge` para tabelas locais
(`print_area_techniques`, `tabela_preco_gravacao_oficial`, `tecnica_gravacao`,
`v_technique_stats`).

**Fix:** Todas substituidas por `supabase.from(...)` nativo.

---

## Padroes Estabelecidos

### Props instaveis -> Refs

```typescript
const onXxxRef = useRef(onXxx);
onXxxRef.current = onXxx; // sem useEffect -- atualiza antes dos effects
const cb = useCallback(async () => {
  onXxxRef.current?.(v); // ref, nunca closure
}, [/* deps estaveis */]);
```

### Polling sem deps de estado

```typescript
const dataRef = useRef(0);
useEffect(() => { dataRef.current = data.length; }, [data]);
const fetch = useCallback(async () => {
  const hasData = dataRef.current > 0; // ref, nao closure
}, [user]);
```

### Throttle correto

O cleanup NAO cancela o trailing timer -- se cancelar, vira debounce.

### Tabelas locais (Caminho B)

`customization_price_tables`, `print_area_techniques`,
`tabela_preco_gravacao_oficial`, `tecnica_gravacao`, `v_technique_stats`
-> sempre `supabase.from()`.

### Secrets

Nunca buscar `totp_secret` ou dados sensiveis no cliente.
Verificacao sempre server-side (Edge Function).

---

## Proximos Passos

- [ ] Deploy Edge Function `verify-2fa-token` (action `disable`) -- obrigatorio para BUG-10
- [ ] Promover `react-hooks/exhaustive-deps` de `warn` para `error` no ESLint
- [ ] Auditar demais consumers de `external-db-bridge` para tabelas locais
- [ ] Testes de CI: verificar que `setInterval` nao e recriado apos fetches
