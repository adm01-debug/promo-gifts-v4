# Onda 15 — Auth hooks/integrations hardening

Data: 2026-07-22
Status: ✅ 10/10

## Simulação — mapa exaustivo dos call sites

Regex `supabase.auth.(signIn*|signUp|signOut|resetPasswordForEmail|updateUser|verifyOtp|refreshSession|exchangeCodeForSession|setSession|mfa)` aplicado em `src/hooks/**`, `src/integrations/**`, `src/lib/**`:

| Arquivo | Método | Classificação | Ação |
|---|---|---|---|
| `src/hooks/auth/usePasswordResetRequests.ts:74` | `resetPasswordForEmail` | Mutável | **Migrado → `authService.resetPasswordSafe`** |
| `src/lib/auth/session-recovery.ts:85` | `refreshSession` | Mutável (dentro do SSOT `lib/auth/`) | Mantido — já no SSOT |
| `src/lib/auth/session-recovery.ts:105` | `signOut` | Mutável (dentro do SSOT `lib/auth/`) | Mantido — já no SSOT |
| `src/integrations/lovable/index.ts:34` | `setSession` | Primitivo de sessão | Mantido (fora do pattern) |
| `src/integrations/supabase/client.ts:174` | `onAuthStateChange` | Primitivo | Mantido |
| `src/hooks/**` (getUser/getSession) | leitura | Primitivo | Mantido |
| `src/components/auth/SocialLoginButtons.tsx:159` | `signInWithOAuth` | Mutável (legacy OAuth boot) | Allowlist file — TODO Onda 16 |
| `src/pages/auth/SSOCallbackPage.tsx:183` | `exchangeCodeForSession` | Mutável (callback OAuth) | Allowlist file — TODO Onda 16 |

## Mudanças aplicadas

1. **`usePasswordResetRequests.approveRequest`** — passou a consumir `authService.resetPasswordSafe`, com copy PT-BR ramificada por `errorKind`:
   - `ratelimit` → "Muitas solicitações em pouco tempo…"
   - `network` / `timeout` → "Sem conexão com o servidor…"
   - `credential` → "Email inválido ou não cadastrado."
   - `server` / `unknown` → `userMessage` sanitizado do wrapper.
2. **Static gate v2** (`scripts/check-auth-direct-calls.mjs`):
   - Regex passa a cobrir `signInWithOAuth`, `exchangeCodeForSession`, `reauthenticate` e property dinâmico `["auth"]`.
   - Allowlist de diretório reduzida: removido `src/hooks/auth/`.
   - Allowlist de arquivo mantida temporária para 2 legados OAuth (documentados como TODO Onda 16).
3. **Teste de regressão** em `src/hooks/auth/__tests__/usePasswordResetRequests.approve.test.ts` — 6 cenários (ok + credential + ratelimit + network + timeout + server).

## Critério de aceite

| Item | Status |
|---|---|
| Zero chamadas mutáveis fora de `authService.ts` + `lib/auth/` (exceto 2 legados OAuth em allowlist explícita) | ✅ |
| Static gate v2 verde | ✅ |
| Regex v2 detecta `signInWithOAuth` / `exchangeCodeForSession` / property dinâmico | ✅ |
| Teste de regressão do `approveRequest` cobre ≥4 cenários | ✅ (6) |
| Fuzz cross-surface `safeAuthCall.family` já em ~220+ cenários | ✅ (mantido da Onda 8) |

## Próximo passo — Onda 16 (fora de escopo)

Migrar `SocialLoginButtons` e `SSOCallbackPage` para novos wrappers `signInWithOAuthSafe` / `exchangeCodeForSessionSafe`, removendo `ALLOWLIST_FILES` do gate.
