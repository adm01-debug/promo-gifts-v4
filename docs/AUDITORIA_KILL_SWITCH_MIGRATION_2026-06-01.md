# Auditoria: Kill-Switch Migration Hardening — 2026-06-01

## Contexto

Esta auditoria validou se todas as funcionalidades que existiam na arquitetura com `kill-switch`
foram migradas corretamente para a nova arquitetura (kill-switch OFF, `doufsxqlfjyuvxuezpln` como SSOT).

**Data:** 2026-06-01  
**Arquivos inspecionados:** 15+ arquivos-fonte  
**Cenários simulados:** 15  
**Bugs encontrados e corrigidos:** 3  
**Melhorias aplicadas:** 5 (+ 2 verificações sem mudança necessária)

---

## Resultado da Validação por Funcionalidade

| # | Funcionalidade | Status | Arquivo |
|---|---------------|--------|---------|
| 1 | `supabase.from()` → banco canônico (catálogo, produtos, cotações) | ✅ Migrado | `client.ts` |
| 2 | FORBIDDEN_REFS — proteção contra Lovable Cloud vazio | ✅ Migrado + hardened | `client.ts` |
| 3 | `invokeExternalDb()` → redireciona para PostgREST nativo | ✅ Migrado | `external-db/invoke.ts` |
| 4 | `external-db-bridge` kill-switch (client-side, cache L1/L2) | ✅ Migrado | `external-db/kill-switch-client.ts` |
| 5 | `external-db-bridge` kill-switch (server-side, 410 Gone) | ✅ Migrado | `external-db/invoke.ts` |
| 6 | Circuit breaker 429 para CRM bridge | ✅ Migrado | `crm-db.ts` |
| 7 | Semáforo de concorrência (max 3 simultâneos) para CRM | ✅ Migrado | `crm-db.ts` |
| 8 | `crm-db-bridge` (único DB externo restante) | ✅ Migrado | `crm-db.ts` |
| 9 | Hooks CRM com paginação infinita | ✅ Migrado | `hooks/crm/useCrmCompanies.ts` |
| 10 | Telemetria + request-id em ambas as bridges | ✅ Migrado | `crm-db.ts`, `external-db/invoke.ts` |
| 11 | Auth Supabase nativo + Lovable OAuth | ✅ Migrado | `integrations/supabase/client.ts`, `lovable/index.ts` |
| 12 | `external-db-prewarm.ts` → PostgREST nativo (não mais bridge) | ✅ Migrado | `lib/external-db-prewarm.ts` |

---

## Bugs Corrigidos

### BUG-01 — `client.ts`: Check negativo incompleto (FORBIDDEN_REFS)

**Impacto:** Se Lovable criar novo projeto Cloud com UUID diferente dos listados em FORBIDDEN_REFS,
o cliente poderia apontar para o projeto errado sem aviso.

**Root cause:** `envPointsToForbidden` usava lista de negação. Lista pode ficar desatualizada.

**Fix:** Adicionado `envPointsToCanonical` (check positivo). Se `.env` já aponta para
`doufsxqlfjyuvxuezpln`, aceita diretamente sem checar FORBIDDEN_REFS. Dupla proteção:
check positivo (primário) + FORBIDDEN_REFS (defesa em profundidade).

**Commit:** `56f22229`

---

### BUG-02 — `kill-switch-client.ts`: SSR rollout bias

**Impacto:** 100% dos usuários SSR caíam no mesmo bucket `'ssr-anon'`, fazendo rollout
gradual ser completamente ineficaz (afetava 100% ou 0% dos SSR users, nunca X%).

**Root cause:** `getBucketKey()` retornava string literal `'ssr-anon'` para qualquer
ambiente `window === undefined`.

**Fix:** `generateUUID()` com `crypto.randomUUID()` (W3C Crypto API) + fallback para
`Date.now() + Math.random()`. Cada chamada SSR recebe UUID único → distribuição uniforme.

**Commit:** `fa5fb9cd`

---

### BUG-03 — `kill-switch-client.ts`: KillSwitchActiveError.message conflict

**Impacto:** `KillSwitchActiveError` redeclarava `message: string` como propriedade própria,
conflitando com o property descriptor herdado de `Error.prototype`. Em V8 e JavaScriptCore,
isso produzia stack traces corrompidos e `instanceof Error` inconsistente em alguns transpilers.

**Root cause:** Declaração redundante de campo `message` em subclasse de `Error`.

**Fix:** Removida redeclaração. `super(message)` já seta `this.message`. Adicionado
`Object.setPrototypeOf(this, KillSwitchActiveError.prototype)` para compatibilidade
com Babel/SWC em targets `< ES6`.

**Commit:** `fa5fb9cd`

---

## Melhorias Aplicadas

### M-04 — `crm-db.ts`: `detectCanonicalDbHealth()` (health check passivo)

Adicionada função `detectCanonicalDbHealth(timeoutMs = 5000)` que verifica
conectividade e latência do banco canônico via `SELECT limit 1` em `system_kill_switches`.

Retorna `CanonicalDbHealthResult` estruturado: `{ healthy, latencyMs, error, checkedAt }`.

**Uso:** n8n watchdog periódico, GlitchTip, dashboards de monitoramento.

**Commit:** `82b8a1d4`

---

### M-05 — `feature-flags.ts`: Flag `crm_bridge_enabled`

Adicionada flag `crm_bridge_enabled` (default: `true`) para controle dinâmico
do crm-db-bridge via `setFeatureFlag()`.

Diferencia-se do kill-switch (`system_kill_switches`):
- Feature flag: client-side, gerenciada por código/deploy
- Kill-switch: server-side, para desligamentos de emergência

**Commit:** `8cd5305c`

---

### M-06 — `client.ts`: Comentário `SECURITY: RLS required`

Adicionado comentário explicitando que RLS deve estar ativo em todas as tabelas
com dados sensíveis no projeto `doufsxqlfjyuvxuezpln`, com query de verificação:

```sql
SELECT tablename, rowsecurity
FROM pg_tables
WHERE schemaname = 'public' AND rowsecurity = false;
```

**Commit:** `56f22229`

---

### M-07 — `external-db/index.ts`: `@internal` warnings em exports de bridge

Adicionada documentação clara sobre estado da arquitetura e aviso `@internal`
nas funções que bypassam o kill-switch (`invokeExternalDb`, `invokeBridge`, etc.),
prevenindo uso inadvertido em novos recursos.

**Commit:** `53eba60d`

---

## Verificações Sem Mudança Necessária

| Arquivo | Verificação | Resultado |
|---------|-------------|-----------|
| `lazy-client.ts` | Importa dinamicamente de `client.ts` (banco canônico) | ✅ Correto |
| `external-rpc.ts` | Migrado de `external-db-bridge` para `supabase.rpc()` direto | ✅ Correto |

---

## Riscos Residuais (Não Críticos)

| Prioridade | Descrição | Ação Recomendada |
|-----------|-----------|------------------|
| P2 | `crm-db-bridge` sem fallback para indisponibilidade total do `pgxfvjmuubtbowutlide` (apenas rate-limit é tratado) | Implementar modo degradado via flag `crm_bridge_enabled` |
| P3 | `useCrmCompanySelector()` marcado como `@deprecated` ainda pode ter call sites | Migrar para `useCrmInfiniteCompanySelector()` — rastrear com grep |
| P3 | CANONICAL_ANON_KEY hardcoded (design intencional do Supabase, mas visível em repo público) | Confirmar RLS ativo via query documentada em client.ts |

---

## Commits desta Auditoria

| Commit | Arquivo | Descrição |
|--------|---------|-----------|
| `56f22229` | `src/integrations/supabase/client.ts` | BUG-01 check positivo + M-06 comentário RLS |
| `fa5fb9cd` | `src/lib/external-db/kill-switch-client.ts` | BUG-02 SSR bias + BUG-03 Error.message + M-02 crypto.randomUUID |
| `82b8a1d4` | `src/lib/crm-db.ts` | M-04 detectCanonicalDbHealth health check passivo |
| `8cd5305c` | `src/lib/feature-flags.ts` | M-05 flag crm_bridge_enabled |
| `53eba60d` | `src/lib/external-db/index.ts` | M-07 @internal warnings |
| `(este)` | `docs/AUDITORIA_KILL_SWITCH_MIGRATION_2026-06-01.md` | Documentação desta auditoria |
