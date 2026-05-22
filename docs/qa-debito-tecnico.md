# Débito técnico QA — pós-auditoria 2026-05-22

Este documento rastreia o débito remanescente da auditoria QA exaustiva
(branch `claude/code-qa-review-FPNEb`, PR #80). As 4 ondas commitadas
cobriram o caminho crítico; aqui ficam os itens que precisam de PRs
dedicados.

## Wave 5+ — Substituir `console.*` em produção por structuredLogger

**Status:** demonstrado em `src/hooks/quotes/useQuoteTemplates.ts` (7 substituições).

**Restante:** 256 ocorrências em 90+ arquivos. Hotspots (>= 5 ocorrências):

| Arquivo | Ocorrências |
|---|---|
| `src/components/admin/connections/SmokeTestChecklist.tsx` | 13 |
| `src/pages/auth/Auth.tsx` | 10 |
| `src/lib/personalization/repositories/technique.repository.ts` | 7 |
| `src/hooks/mockup/useMockupGenerator.ts` | 7 |
| `src/hooks/mockup/useMockupDraft.ts` | 6 |
| `src/hooks/intelligence/useExpertConversations.tsx` | 6 |
| `src/hooks/quotes/useDiscountApproval.ts` | 5 |
| `src/hooks/admin/useIPValidation.ts` | 5 |
| `src/hooks/admin/useDeviceDetection.ts` | 5 |
| `src/components/filters/FilterPresets.ts` | 5 |
| `src/components/admin/users/useUserManagement.ts` | 5 |

**Padrão de migração** (ver useQuoteTemplates.ts como referência):

```diff
+ import { createClientLogger } from "@/lib/telemetry/structuredLogger";
+ const log = createClientLogger("hooks.useFoo");

  ...
  } catch (err) {
-   console.error("Error doing X:", err);
+   log.error("do_x_failed", { err });
  }
```

Eventos seguem snake_case com prefixo de domínio (`auth_*`, `quote_*`,
`mockup_*`, etc). `err` é serializado automaticamente pelo logger.

**Lint rule de regressão** (a adicionar em `eslint.config.js`):
```js
{
  files: ["src/**/*.{ts,tsx}"],
  ignores: ["src/lib/telemetry/**", "src/**/*.test.{ts,tsx}"],
  rules: {
    "no-console": ["warn", { allow: ["warn", "error"] }],
  },
}
```

## Wave 5+ — Migrar 7 edge functions para Zod validation

Allowlist em `tests/contracts/edge-functions-contract.test.ts` marca
estas com `TODO: migrar para Zod`:

- `bi-copilot`
- `block-ip-temporarily`
- `kit-ai-builder`
- `market-intelligence-insights`
- `send-transactional-email`
- `step-up-verify`
- `trends-insights`

**Padrão** (ver `crm-db-bridge` como referência):

```ts
import { z } from "npm:zod@3.23.8";

const BodySchema = z.object({
  field1: z.string().min(1),
  field2: z.number().int().positive().optional(),
});

const parsed = BodySchema.safeParse(await req.json());
if (!parsed.success) {
  return new Response(
    JSON.stringify({ error: parsed.error.flatten().fieldErrors }),
    { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
  );
}
```

Após migrar, remova a entrada do `EXCEPTIONS` em
`tests/contracts/edge-functions-contract.test.ts`.

## Wave 5+ — Reativar 23 testes E2E P0 (Playwright)

Status atual: `scripts/check-no-skip-p0.mjs` reporta como WARN.

Arquivos:
- `e2e/flows/p0/01-auth-recovery.spec.ts` (3 skips)
- `e2e/flows/p0/02-catalog-degraded.spec.ts` (3)
- `e2e/flows/p0/03-quote-blocked.spec.ts` (3)
- `e2e/flows/p0/04-checkout-blocked.spec.ts` (3)
- `e2e/flows/p0/05-admin-down.spec.ts` (4)
- `e2e/flows/p0/06-auth-lifecycle.spec.ts` (4)
- `e2e/flows/p0/07-rls-enforcement.spec.ts` (2)
- `e2e/flows/p0/08-password-recovery.spec.ts` (1)

Cada um exige app rodando + seeds + dois usuários distintos (cross-tenant).
Implementação requer fixtures Playwright de auth (`e2e/helpers/auth.ts`)
já existentes — ver `e2e/flows/p0/_mocks.ts` para mocks de page.route().

Quando concluído, rodar `node scripts/check-no-skip-p0.mjs --strict` em CI.

## Wave 5+ — 198 erros TS pré-existentes acumulados

`.tsc-baseline.json` foi absorvido em `c643c8e` para destravar este PR.
Mas há **debito técnico real** a resolver:

- `src/pages/advanced-price-search/types.ts` removeu exports usados por
  `src/components/admin/personalization-manager/*` (4 arquivos).
- `src/components/loading/index.ts` reexporta tipos que não existem mais.
- `src/components/pricing/calculator/*` e `simulator/*` têm refactor
  parcial.
- `src/components/expert/chat/useExpertChat.ts` tem TS1345.

Estratégia recomendada: 1 PR por área (personalization-manager,
loading, pricing/calculator, expert/chat). Após cada, rodar
`npm run typecheck:baseline:update`.

## Hardening adicional sugerido

1. **Lint rule** para proibir `try { useHook() } catch {}` (rules-of-hooks
   reforço) — já bloqueado em runtime mas vale linter.
2. **Gate** para proibir `any` novo em `src/types/` (zod ou type-only).
3. **Smoke contract test extra** para edge functions críticas
   (manage-users, crm-db-bridge): além de offline, fazer chamada real
   via supabase MCP em CI staging.

## Status das 4 ondas

| Onda | Status | Commit | Descrição |
|---|---|---|---|
| 1 | ✅ | f95a792 | P0 tests reativados + gate check-no-skip-p0 |
| (drift) | ✅ | c643c8e | Absorção do baseline TS pré-existente |
| 2 | ✅ | 34a0de4 | useOptionalOnboardingContext + remoção @ts-expect-error |
| 3 | ✅ | 038f34e | 487 contract tests offline para edge functions |
| 4 | ⏳ | (este commit) | Doc + demo migração structuredLogger |
