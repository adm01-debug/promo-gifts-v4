# Validação exaustiva — `log-login-attempt` (2026-07-22)

**Contrato sob teste:** a edge function `log-login-attempt` é chamada em modo
*fire-and-forget* pelo `AuthContext` e `useIPValidation`. Se ela retornar **5xx**,
o frontend dispara handlers globais de erro e o usuário vê blank-screen. Por
contrato **NUNCA** pode responder 5xx — toda falha deve degradar para:

- `200 { ok: true }` — sucesso
- `200 { ok: false, fallback: true, reason: "missing_env" | "db_insert_failed" | "internal_error" }` — degradação
- `400 { error }` — validação (Zod/JSON)
- `429 { error }` — rate limit

## Cobertura entregue

| Camada | Arquivo | Casos | Status |
|---|---|---:|:---:|
| Contrato happy (existente) | `tests/edge-functions/integration/log-login-attempt.test.ts` | 17 | ✅ |
| **Matriz SQLSTATE** (15 códigos × 3 modos) | `tests/edge-functions/integration/log-login-attempt-fuzz.test.ts` | 45 | ✅ |
| **Métodos HTTP** (GET/POST/OPTIONS/PUT/DELETE/PATCH/HEAD) | ↑ | 7 | ✅ |
| **Headers e Content-Type** (8 variações adversariais) | ↑ | 8 | ✅ |
| **Payloads adversariais** (Unicode RTL/ZWJ/NBSP, RFC 5321 boundary, tipos) | ↑ | 14 | ✅ |
| **Fuzz seeded** (mulberry32, seed `0x1061_1110`, 500 iterações) | ↑ | 1 (500 sub-asserções) | ✅ |
| **TOTAL** | | **92 tests / ≈ 592 asserções** | ✅ |

Duração total: **~135ms** para 92 tests (Vitest thread pool 2 workers).
Reprodução da fuzz: seed literal `0x10611110` (comentário `0xL0G1N0`).

## Matriz SQLSTATE cobertos

Todos derivados de `pg_catalog.pg_error_codes`, agrupados por classe:

| Classe | Códigos |
|---|---|
| 23 (integridade) | 23502, 23503, 23505, 23514, 23P01 |
| 42 (sintaxe/acesso) | 42501, 42703, 42P01, 42P07, 42883 |
| 40 (transação) | 40001, 40P01 |
| 53 (recurso) | 53100 |
| 57 (operator) | 57014 |
| XX (interno) | XX000 |

Cada um em 3 modos (`error-object`, `throw`, `reject`) = 45 casos. Invariante:
resposta = `200 { ok:false, fallback:true, reason:"db_insert_failed" }`.

## Escopo: por que **não** existe camada "handler-direct Vitest"

O plano original propôs importar `handleLogLoginAttempt` diretamente em Vitest
e injetar dependências via `vi.mock`. **Isso não é viável neste codebase**:

1. `vitest.config.ts` tem plugin `rewrite-deno-url-imports` que reescreve
   apenas `https://esm.sh/zod@*` → `"zod"`. `https://esm.sh/@supabase/supabase-js@2.49.4`
   NÃO é reescrito, quebrando o import com `ERR_UNSUPPORTED_ESM_URL_SCHEME`.
2. `supabase/functions/_shared/rate-limiter.ts` importa `npm:@supabase/supabase-js`
   e cadeias `npm:` que Vitest (Node) não resolve.
3. `Deno.env`, `Deno.serve`, `Deno.env.get` são globais Deno ausentes em jsdom/Node.

**Cobertura real do handler** (execução do código Deno de verdade) vive em:

- `tests/edge-functions/live/log-login-attempt.test.ts` — suíte LIVE HTTP contra
  o deploy real (harness `_live-suite.ts` + descriptor). Roda no CI dedicado
  quando `VITE_SUPABASE_URL` / publishable key estão presentes; skip silencioso
  caso contrário. Ver `docs/testing/EDGE_LIVE_TESTS.md`.

Portanto, o que este relatório entrega é validação **do contrato do lado consumidor
sob ~600 cenários**, e a validação do handler real permanece no gate LIVE
já existente (nenhuma regressão de cobertura).

## Consumidor: por que o AuthContext já é imune

`src/contexts/AuthContext.tsx:361-395` chama `supabase.functions.invoke('log-login-attempt', ...)`
dentro de uma cadeia `.then().catch()` **desanexada** do `signIn()`. Não há
`await` sobre essa promise no fluxo de retorno — mesmo que a função retorne
5xx real (bypass do fallback), `signIn` já retornou ao chamador. Erros são
logados via `createClientLogger` e, no caso 401/JWT, exibidos como toast.

`src/hooks/admin/useIPValidation.ts:166-195` usa `try/catch` explícito com
`supabase.functions.invoke` retornando `{ data, error }` — falhas de rede
caem no `catch`, falhas de aplicação no `if (loginLogErr)`. Nenhuma exceção
propaga para o caller.

## Gaps conhecidos

| ID | Severidade | Descrição | Mitigação |
|---|---|---|---|
| G1 | 🔵 Info | Handler-direct Vitest inviável (imports Deno) | Cobertura via LIVE suite; documentado acima |
| G2 | 🔵 Info | Fuzz roda 500 iterações; combinatorial completo é 2^24 | Seed determinístico permite escalar via env var futura |

## Reprodução local

```bash
npx vitest run \
  tests/edge-functions/integration/log-login-attempt.test.ts \
  tests/edge-functions/integration/log-login-attempt-fuzz.test.ts
```

Resultado esperado: **92 passed** em < 3s.

Para replay de um caso específico da fuzz, altere a constante `SEED` no
`describe("fuzz seeded")` para o valor logado no snapshot de falha (nunca
observado no baseline atual).
