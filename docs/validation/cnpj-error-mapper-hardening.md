# Hardening do SSOT `mapCnpjError` — Rodada de validação

**Data:** 2026-07-02 · **Escopo:** validação exaustiva do mapper de erros CNPJ (UI ↔ schema ↔ backend), sem tocar em esquema de banco (bloqueado pela regra #2 do `CLAUDE.md`).

## Resultado

| # | Suite | Asserções | Status |
|---|---|---|---|
| 1 | `scripts/validate-cnpj-error-mapper.mjs` (fuzz 2.000 + 8 canônicos) | 20.008 | ✅ |
| 2 | `src/utils/__tests__/cnpj-errors.matrix.test.ts` (contrato UI) | 3 tests / 12 asserts | ✅ |
| 3 | `src/utils/__tests__/cnpj-errors.test.ts` | 8 tests | ✅ |
| 4 | `src/utils/__tests__/cnpj-exhaustive.test.ts` | 9 tests / ~5.800 asserts | ✅ |
| 5 | `src/utils/cnpj-schema.test.ts` | 19 tests | ✅ |

**Total:** 39/39 testes + ~25.820 asserções verdes.

## Gap encontrado e corrigido nesta rodada 🔴

**Severidade:** média · **Arquivo:** `src/utils/cnpj-errors.ts`

O mapper explodia quando o input tinha getters que lançavam (padrão comum em wrappers de erro Sentry-like e proxies de RPC). Um mapper de erro **nunca** pode ele mesmo explodir — isso mata o `catch` do consumidor e vaza stack para o toast.

**Fix aplicado:** helper `safeRead(key)` com `try/catch` por leitura + fallback para string vazia. Cobertura garantida pela matriz UI (`cnpj-errors.matrix.test.ts:41-53`).

## Matriz G1–G8 auditada

| Gate | Descrição | Verificado por | Status |
|---|---|---|---|
| G1 | Mapper nunca lança | Fuzzer #11 (getters throw) + matriz UI | ✅ |
| G2 | `code` sempre ∈ SSOT | Fuzzer | ✅ |
| G3 | `message` sempre ∈ `CNPJ_ERROR_MESSAGES` | Fuzzer + matriz | ✅ |
| G4 | Nunca vaza `stack`/`constraint`/SQL/coluna | Fuzzer LEAK_PATTERNS + matriz | ✅ |
| G5 | Regex UI casa com copy do SSOT | `cnpj-errors.matrix.test.ts` | ✅ |
| G6 | Toda chave alcançável por ≥ 1 input real | `cnpj-errors.matrix.test.ts` | ✅ |
| G7 | Postgres 23505/23514 mapeados corretamente | Fuzzer + testes canônicos | ✅ |
| G8 | Idempotência pipeline `normalize(mask(x))` | `cnpj-exhaustive.test.ts` B2/B4 | ✅ |

## Auditoria de call-sites

```
src/components/admin/suppliers-manager/useSuppliersManager.ts:523  → mapCnpjError(err) ✅
src/components/admin/products/new-supplier/useNewSupplierForm.ts:541 → mapCnpjError(err) ✅
src/components/admin/products/new-supplier/useNewSupplierForm.ts:440 → err.message cru ⚠️
```

### Gap residual 🟡

**Arquivo:** `src/components/admin/products/new-supplier/useNewSupplierForm.ts:440`
**Severidade:** baixa (client-side, apenas mensagem inline no form; não é backend)
**Descrição:** o catch do `assertPersistableCnpj` usa `err.message` direto em vez de `mapCnpjError(err).message`. Isso vaza a copy Zod ("CNPJ deve conter…") sem passar pela normalização final. Como a copy Zod hoje coincide com o SSOT, o usuário não vê drift — mas se alguém trocar a mensagem do schema, a UI diverge silenciosamente.
**Fix sugerido:** trocar por `mapCnpjError(err).message` (1 linha) na próxima rodada.

## Fora de escopo confirmado

- ❌ Migração `CHECK (cnpj ~ '^\d{14}$')` em `suppliers`/`products` — aguarda confirmação explícita do PO (regra #2).
- ❌ E2E Playwright — delegado ao workflow `e2e-cnpj.yml` (Chromium indisponível no sandbox).

## Recomendação para próxima rodada

1. Corrigir o gap residual em `useNewSupplierForm.ts:440` (1 linha).
2. Após aprovação do PO, aplicar a migração de CHECK constraint e adicionar teste de integração que force `code: 23514` de verdade contra o banco.
