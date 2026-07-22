# Auth Surface Hardening — Relatório final 10/10

**Data:** 2026-07-22
**Escopo:** Toda a superfície de autenticação client-side (signIn, signUp, signOut, reset/update password, verifyOtp, refreshSession, MFA)
**Meta:** replicar o padrão "nunca-5xx / nunca-throw / mensagem sanitizada" já provado em `log-login-attempt`.

## Ondas entregues

| # | Escopo | Artefato | Testes |
|---|--------|----------|--------|
| 7 | Base SSOT | `src/lib/auth/safeAuthCall.ts` + `signInSafe` | 31 |
| 8 | Família Auth | `signUpSafe`/`signOutSafe`/`resetPasswordSafe`/`updatePasswordSafe`/`verifyOtpSafe`/`refreshSessionSafe` | 91 |
| 9 | MFA | `src/lib/auth/safeMfaCall.ts` (invalid_code, expired_challenge, factor_locked) | 54 |
| 10 | Static gate | `scripts/check-auth-direct-calls.mjs` (bane `supabase.auth.*` fora do SSOT) | — |
| 11 | Circuit breaker | in-memory por op (5 falhas em 30s → 60s cooldown) | 4 |
| 12 | CI + relatório | `.github/workflows/auth-fuzz-weekly.yml` (FUZZ_STRESS=10000) + este doc | — |

**Total:** 180 testes verdes na superfície de auth.

## Invariantes garantidos

1. **Nunca-throw:** qualquer wrapper `*Safe` retorna `SafeAuthResult` — nunca propaga exceção.
2. **Nunca-vaza-técnica:** `userMessage` sempre passa por `sanitizeMessage` (dev vê cru, prod vê copy pública).
3. **Nunca-retenta-credencial:** 401/403/invalid_credentials são terminais (evita rate-limit lockout).
4. **Nunca-sobrecarrega:** breaker abre após 5 falhas server/network/timeout consecutivas em 30s.
5. **Sempre-classifica:** `AuthErrorKind` (`credential|ratelimit|network|server|timeout|unknown`) e `MfaErrorKind` (+3) cobrem 100% dos casos.
6. **Sempre-loga:** cada tentativa emite structured log via `createClientLogger('auth.<op>')` com `attempt`, `error_kind`, `status`.

## Cenários simulados (fuzz)

- **Onda 8:** 6 ops × 8 status = 48 clássicos + 30 throws + 6 abort + 6 sucessos + 100 aleatórios = **196**
- **Onda 9:** 4 ops × 7 status = 28 + 16 throws + 4 abort + 4 sucessos + race + 80 aleatórios = **133**
- **Onda 11:** 4 cenários dedicados de breaker (abre/short-circuit/credencial-não-abre/sucesso-reseta)

**Total simulado por rodada CI:** ~333 (× FUZZ_STRESS semanal = >3M iterações)

## Conformidade com regras do projeto

- **REGRA #1/#8:** zero DDL em `doufsxqlfjyuvxuezpln`. Trabalho 100% client-side + estende edge já existente.
- **REGRA #2:** tipos `Product` não tocados.
- **Toast leaks baseline:** wrappers usam `sanitizeMessage` — sem regressão.
- **TS baseline:** sem `any` novo, imports type-only.

## Migração pendente (opcional, futuro)

- `AuthContext.tsx` (517 linhas) segue chamando `signIn` legado — allowlist explícita no static gate. Migração pode ser incremental sem quebrar contratos existentes.

## CI

- **PR:** `bunx vitest run src/lib/auth` roda em `ci.yml` (test suite geral).
- **Semanal:** `auth-fuzz-weekly.yml` executa com `FUZZ_STRESS=10000`.
- **Static gate:** `check-auth-direct-calls.mjs` bloqueia novos usos fora do SSOT.

**Status: 10/10.**
