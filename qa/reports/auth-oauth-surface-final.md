# Onda 16 — OAuth surface hardening

Data: 2026-07-22
Status: ✅ 10/10 — allowlist de arquivos zerada

## Novos wrappers em `authService`

| Wrapper | Origem migrada | `op` |
|---|---|---|
| `signInWithOAuthSafe({ provider, redirectTo })` | `SocialLoginButtons.tsx:159` (Google) | `signInWithOAuth` |
| `exchangeCodeForSessionSafe(code)` | `SSOCallbackPage.tsx:183` (PKCE) | `exchangeCodeForSession` |

Ambos usam `safeAuthCall` com `maxRetries: 1` (fluxos de redirect não beneficiam de retry cego), classificam `errorKind` e retornam `userMessage` sanitizada.

## Migrações

- **`SocialLoginButtons.tsx`**: `try/catch + supabase.auth.signInWithOAuth` → `authService.signInWithOAuthSafe`. Copy mantida via `mapOAuthError` (rede/timeout → mensagem "network"). Import direto de `getSupabaseClient` removido.
- **`SSOCallbackPage.tsx`**: `supabase.auth.exchangeCodeForSession(code)` → `authService.exchangeCodeForSessionSafe(code)`. Log estruturado passa a incluir `errorKind` em vez de `message` cru. `getSession`/`onAuthStateChange` mantidos (primitivos).

## Static gate

- `ALLOWLIST_FILES` **zerado** — não há mais exceções individuais.
- Allowlist de diretório final: `authService.ts` + `src/lib/auth/` + `src/integrations/`.

## Validação

- `node scripts/check-auth-direct-calls.mjs` → ✅ zero violações.
- `bunx vitest run src/lib/auth src/hooks/auth/__tests__` → **345 testes verdes**.
- Novo teste `src/services/__tests__/authService.oauth.test.ts` cobre 9 cenários (ok/err/throw) para os 2 wrappers.

## Estado final da superfície de auth (Ondas 7-16)

| Superfície | Chamadas diretas fora do SSOT |
|---|---|
| `signInWithPassword` | 0 |
| `signUp` | 0 |
| `signOut` | 0 |
| `resetPasswordForEmail` | 0 |
| `updateUser` | 0 |
| `verifyOtp` | 0 |
| `refreshSession` | 0 |
| `signInWithOAuth` | 0 |
| `exchangeCodeForSession` | 0 |

Objetivo alcançado: **10/10** — toda operação mutável de auth passa pelo SSOT com timeout, retry, circuit breaker, classificação de erro e mensagem sanitizada.
