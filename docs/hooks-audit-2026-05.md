# Auditoria de Hooks — Promo Gifts v4 — Maio 2026

> Executada por: Claude AI (Anthropic) | Data: 26/05/2026
> Escopo: 486 arquivos de hooks em `src/hooks/`, `src/components/**/use*.ts`, `src/pages/**/use*.ts`, `src/stores/`

---

## Sumário Executivo

| ID | Severidade | Arquivo | Descrição | Status |
|---|---|---|---|---|
| BUG-01 | 🔴 P0 | `useStepUpAuth.ts` | Stale closure: `challengeId` sempre `null` em `verifyPassword/Otp/cancel` | ✅ Corrigido |
| BUG-02 | 🔴 P0 | `useQuoteBuilderState.ts` | `contactId` preenchido com `client_id` (empresa) no modo edição | ✅ Corrigido |
| BUG-03 | 🟠 P1 | `useQuoteItems.ts` | `removeItem` não reindexava `expandedItems`, causando expansões erradas | ✅ Corrigido |
| BUG-04 | 🟠 P1 | `useRBAC.tsx` | Query `role_permissions` desnecessária para usuário `dev` | ✅ Corrigido |
| BUG-05 | 🟡 P2 | `useQuoteBuilderState.ts` | Dependência fantasma `productSearch` em `filteredProducts` | ✅ Corrigido |
| BUG-06 | 🟡 P2 | `useLoginAttempts.ts` | `staleTime` ausente causa refetch agressivo na tabela de auditoria | ✅ Corrigido |
| BUG-07 | 🟡 P2 | `useAutoSaveQuote.ts` | `onRestore` inline causava re-runs desnecessários do useEffect | ✅ Corrigido |

---

## Detalhamento

### BUG-01 — Stale Closure: `state.challengeId` em `useStepUpAuth`

**Arquivo:** `src/hooks/auth/useStepUpAuth.ts`
**Impacto:** Autenticação MFA (Step-Up) falhava silenciosamente — `challenge_id: null` enviado ao servidor

**Causa raiz:**
React's `useCallback` captura o valor de `state` no momento da criação. Quando `requestChallenge` atualiza `state.challengeId` via `setState`, os callbacks `verifyPassword`, `verifyOtp` e `cancel` já foram criados com `challengeId = null` na closure. Mesmo que a dep `[state.challengeId]` estivesse listada, o callback só seria recriado no **próximo render**, mas a UI pode chamar `verifyPassword` **antes** do próximo render, enviando `null`.

**Fix aplicado:**
Criado `challengeIdRef = useRef<string | null>(null)` que é atualizado **sincronamente** logo após o `setState` em `requestChallenge`. Os callbacks leem `challengeIdRef.current` em vez de `state.challengeId`. Dependências dos callbacks reduzidas a `[]`.

---

### BUG-02 — `contactId` preenchido com `client_id` no modo edição

**Arquivo:** `src/hooks/quotes/useQuoteBuilderState.ts`
**Impacto:** No modo edição de cotação, `contactId` ficava com o ID da empresa em vez do ID do contato. A validação do step `'client'` passava incorretamente.

**Causa raiz:**
```ts
// linha errada:
setContactId(quote.client_id || '');
// deveria ser:
setContactId((quote as any).contact_id || '');
```

**Fix aplicado:** Usa `quote.contact_id` com fallback para string vazia.

---

### BUG-03 — `removeItem` não reindexava `expandedItems`

**Arquivo:** `src/hooks/quotes/useQuoteItems.ts`
**Impacto:** Ao remover item na posição N, itens em posições >N mantinham índices errados no `expandedItems`. Resultado visual: painel de personalização aparecia expandido para o item errado.

**Fix aplicado:**
```ts
setExpandedItems((prev) => {
  const next = new Set<number>();
  prev.forEach((i) => {
    if (i < index) next.add(i);
    else if (i > index) next.add(i - 1); // reindexar
    // i === index: descartar
  });
  return next;
});
```

---

### BUG-04 — Query `role_permissions` desnecessária para `dev`

**Arquivo:** `src/hooks/auth/useRBAC.tsx`
**Impacto:** Consulta ao banco sempre que um `dev` faz login, mesmo que o resultado seja descartado. Gera `permissionsLoading: true` transitório.

**Fix aplicado:** `enabled: !!user && roleName !== 'dev'`. `isLoading` ajustado para não incluir `permissionsLoading` quando `roleName === 'dev'`.

---

### BUG-05 — Dependência fantasma em `filteredProducts`

**Arquivo:** `src/hooks/quotes/useQuoteBuilderState.ts`
**Impacto:** Re-computações desnecessárias a cada keystroke na busca de produto.

**Fix:** Removido `productSearch` das deps do `useMemo`.

---

### BUG-06 — `staleTime` ausente em `useLoginAttempts`

**Arquivo:** `src/hooks/auth/useLoginAttempts.ts`
**Impacto:** Cada foco/blur no browser disparava refetch da tabela `login_attempts`.

**Fix:** Adicionado `staleTime: 30_000` em ambas as queries.

---

### BUG-07 — `onRestore` instável nas deps do `useEffect` de restore

**Arquivo:** `src/hooks/quotes/useAutoSaveQuote.ts`
**Impacto:** Função inline causava re-agendamento do efeito a cada render.

**Fix:** `onRestore` capturada em `onRestoreRef = useRef` e removida das deps do efeito.

---

## Metodologia

1. Listagem automática de todos os 486 arquivos de hooks via API GitHub
2. Leitura e análise dos hooks de maior risco:
   - Auth / RBAC / Step-Up (segurança)
   - Quote Builder (lógica de negócio central)
   - AutoSave (persistência)
   - Login Attempts (auditoria)
3. Verificação cruzada de:
   - Stale closures em `useCallback`/`useEffect`
   - Dependências incorretas
   - Side effects sem cleanup
   - Estados derivados sem sync
4. Criação de PR com correções atômicas por arquivo

---

## Recomendações Futuras

- Adicionar casos de teste específicos para BUG-01 (fluxo de MFA com `challengeId` assíncrono)
- Adicionar teste para BUG-03 (remoção de item no meio da lista com items expandidos)
- Configurar ESLint rule `react-hooks/exhaustive-deps` como `error` em vez de `warn` para prevenir futuros BUG-05/07
