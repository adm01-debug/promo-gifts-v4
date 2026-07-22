# Migração para `invokeEdgeSafe` — SSOT de `functions.invoke`

**Onda 17-18.** Toda chamada nova a Supabase Edge Function DEVE passar pelo
wrapper `invokeEdgeSafe` (`src/lib/edge/safeInvokeCall.ts`). O gate
`scripts/check-invoke-direct-calls.mjs` (rodado no CI) falha se aparecer um
`supabase.functions.invoke(...)` fora da baseline congelada em
`.invoke-direct-baseline.json`.

## Por quê

`invokeEdgeSafe` aplica o mesmo contrato provado em `safeAuthCall`:

- **Nunca-throw** — sempre resolve `{ kind: 'ok' | 'err', ... }`.
- **Timeout por tentativa** (default 10 s).
- **Retry exponencial** só em falhas transitórias (network/server/timeout).
- **Circuit breaker por `op`** (5 falhas / 30 s → cooldown 60 s).
- **Classificação de erro** (`client | credential | ratelimit | network | server | timeout | unknown`).
- **`userMessage` sanitizada** — sem status bruto/stack em produção.
- **Parser defensivo** do body do erro (JSON quebrado / HTML de proxy não explode).

## Antes / depois

```ts
// ❌ Antes — cru
const { data, error } = await supabase.functions.invoke('minha-fn', {
  body: { foo: 1 },
});
if (error) toast.error(error.message); // vaza técnica, sem retry, sem breaker
```

```ts
// ✅ Depois — via SSOT
import { invokeEdgeSafe } from '@/lib/edge/safeInvokeCall';

const r = await invokeEdgeSafe<{ ok: boolean }>('minha-fn', {
  body: { foo: 1 },
  op: 'minha-fn.doThing',
});
if (r.kind === 'ok') {
  // r.data tipado
} else {
  toast.error(r.userMessage);          // já sanitizada
  logger.warn(r.errorKind, r.op);      // classificação p/ observabilidade
}
```

## Regras da allowlist (`.invoke-direct-baseline.json`)

1. É um **snapshot congelado** — cresce apenas em cenários excepcionais, e
   sempre acompanhado de justificativa no PR.
2. **Regressão** (call site novo fora da baseline) → CI falha.
3. **Migração legítima** (call site removido/portado para `invokeEdgeSafe`) →
   rodar `UPDATE_BASELINE=1 node scripts/check-invoke-direct-calls.mjs` e
   commitar a baseline junto do refactor.
4. `STRICT_BASELINE=1` transforma entradas mortas em erro (usado em ondas
   finais para forçar zeragem).

## O que o gate ignora

- Arquivos de teste (`__tests__/`, `*.test.ts`, `e2e/`).
- O próprio SSOT (`src/lib/edge/safeInvokeCall.ts`).
- Padrão dentro de comentários (linha e bloco) ou de strings.

## Próximas ondas

- **19** — migrar call sites críticos (`log-login-attempt`, `crm-db-bridge`,
  `webhook-dispatcher`, `manage-users`, `step-up-verify`).
- **20** — workflow semanal `edge-invoke-fuzz-weekly.yml` (stress do wrapper).
- **21** — `useInvokeEdge` com toast + telemetria integrados.
