# 📡 Status do Projeto

> **Estado operacional do redeploy hardening do `promo-gifts-v4`.**
> Para entender o produto, ver [`README.md`](./README.md).
> Para o histórico completo de sessões, ver [`docs/redeploy/SESSIONS.md`](./docs/redeploy/SESSIONS.md).

---

## 🎯 Onde estamos hoje

**Última sessão**: 2026-05-23 — **Auditoria exaustiva + Plano de 20 etapas** (11 etapas fechadas, 8 adiadas para sessões dedicadas).

| Métrica | Valor |
|---------|-------|
| Sessões de hardening concluídas | T-FIX-3, T-FIX-4, T-FIX-5, Bugs #1/#2, Redeploy de schemas, Auditoria 2026-05-23 |
| Erros TS em `.tsc-baseline.json` | 1.333 (320 arquivos) — sem regressão |
| Erros ESLint em `.eslint-baseline.json` | 442 (404 arquivos) — drift positivo de 31 capitalizado em 2026-05-23 |
| Próximo cutoff iminente | ✅ T-FIX-3 fechado em 2026-05-23 (era 2026-06-02) — sem outro cutoff em <30 dias |

---

## ✅ Fechado nesta sessão (2026-05-23 — Auditoria + Plano 20 etapas)

PR #124 — branch `claude/code-bug-analysis-VLG0u`.

### Quick wins / desbloqueio CI (Etapas 1-5)
- ✅ **Etapa 1** — P5 do plano "10/10": rename 3 params PascalCase em `AdminStandardRules.test.tsx`
- ✅ **Etapa 2** — refactor `useOptionalOnboardingContext`: elimina 3 empty catches + 3 violações `rules-of-hooks` + 3 `any`
- ✅ **Etapa 3** — regenera baseline ESLint capturando 31 erros eliminados (473→442)
- ✅ **Etapa 4** — T-FIX-3: bump 60 usos de GH Actions em 12 workflows (checkout/setup-node/upload-artifact)
- ✅ **Etapa 5** — T-FIX-5: apply `eslint.config.t-fix-5.proposed.js` → `eslint.config.js` + script `check:proposed-configs`

### Post-mortem CRM bridge (Etapas 6-8)
- ✅ **Etapa 6** — Issue 1: POP `docs/operations/cadastro-secrets-supabase.md` (7 seções)
- ✅ **Etapa 7** — Issue 2: `validateUrlFormat` em `connection-test-runner.ts` (5 tipos, 7 cenários)
- ✅ **Etapa 8** — Issue 2: 15 testes Deno para `validateUrlFormat`

### Pendências menores (Etapas 18-19)
- ✅ **Etapa 18** — `QuoteBuilderStepper.test.tsx`: remove forEach no-op
- ✅ **Etapa 19** — `ScenarioSimulation.test.ts`: corrige Scenario 2 CIF/FOB vs schema real (3 cenários)

### Outras correções (não numeradas)
- ✅ Fix TS2322 em `PriceFreshnessBadge.snapshots.test.tsx` (regressão herdada do T-FIX-4)

### Bônus pós-CI (Etapas 21-27, descobertos após push)
- ✅ **Etapa 21** — TZ=America/Sao_Paulo prefixado em 10 scripts vitest (vitest.config `env.TZ` só vai para `import.meta.env`, não para `process.env` que controla `Date.toLocaleString`). Corrige 13 snapshots PriceFreshnessBadge em ambiente UTC.
- ✅ **Etapa 22** — Mock fix: adiciona `useOptionalOnboardingContext: () => null` em 11 arquivos de teste (regressão da Etapa 2 — componentes passaram a importar a nova função; mocks não exportavam). MainLayout.breadcrumbs 0/6 → 6/6.
- ✅ **Etapa 23** — 5 arquivos NotificationDrawer-*.test.tsx tinham mock path errado (`@/hooks/useNotifications` em vez de `@/hooks/ui`) — `useAuth` rodava de verdade e falhava por falta de AuthProvider. NotificationDrawer-debounce 0/4 → 4/4.
- ✅ **Etapa 24** — `Route path="/login"` → `Route path="/auth"` em 4 *Route tests (DevRoute, AdminRoute, ProtectedRoute, AdminConexoesAccess) — código redireciona para /auth desde refactor antigo. DevRoute 0/2 → 41/41.
- ✅ **Etapa 25** — Mesmo fix /login→/auth em 2 admin tests (reduced-app-navigation, route-no-error-element). 13/13.
- ✅ **Etapa 26** — `useCatalogState.unit.test.tsx`: consolidação de 9 `vi.mock` duplicados em 1 + skip explícito (refactor do hook necessário pra reabilitar — cascata Supabase/contexts faz OOM).
- ✅ **Etapa 27** — `OrganizationProvider` adicionado ao wrapper de `syntax-integrity.test.tsx`.

---

## ⏳ Pendências adiadas (sessões dedicadas)

8 etapas do plano de 20 ficaram para sessões dedicadas porque exigem refactor arquitetural não-trivial:

| # | Etapa | Razão do adiamento | Esforço estimado |
|---|---|---|---|
| 9 | Refatorar `price-response.adapter.ts` (61 erros TS) | Adapter complexo, mistura snake/camelCase, nullable fields | ~4h |
| 10 | Refatorar `AdminProductFormPage.tsx` (60 erros TS) | Form com 60 fields, schemas Zod entrelaçados | ~4h |
| 11 | Refatorar `AddressTab.tsx` (56 erros TS) | Form de endereço com validações múltiplas | ~3h |
| 12 | Refatorar `BasicDataTab.tsx` (32 erros TS) | Mesma origem do AddressTab | ~2h |
| 13 | Refatorar `CompareTableView.tsx` (26 erros TS) | Renomear ~15 acessos `camelCase` → `snake_case` + null-safe (verificar callers) | ~2h |
| 14 | Reduzir `SupabaseConnectionsTab.tsx` (17 ESLint warnings) | Auditoria caso-a-caso | ~1h |
| 15 | Reduzir `CatalogContent.tsx` + `ProductQuickView.tsx` (32 warnings) | Idem | ~2h |
| 16 | Reduzir `useSimulatorWizard.ts` + `useGlobalSearch.ts` (27 warnings) | Idem | ~2h |
| 17 | T-FIX-5b — antipadrão B (`expect` em `forEach` em `it`) | Evolução do guard-rail ESLint | ~3h |

**Total estimado**: ~23h de trabalho cuidadoso.

> 💡 Sugestão: rodar essas etapas **uma por sessão dedicada**, sem misturar com novas features. A refatoração de um arquivo do top-5 do TSC baseline gera ~20+ pares de edits e é frágil — vale ter 100% do CI rodando antes/depois de cada.

---

## 📅 Backlog priorizado (atualizado)

| Prioridade | Item | Origem | Cutoff |
|------------|------|--------|--------|
| 🟡 Alta | Refatorar top-5 arquivos do TSC baseline (etapas 9-13 do plano) | Auditoria 2026-05-23 | Sem cutoff |
| 🟡 Média | Reduzir top arquivos do ESLint baseline (etapas 14-16) | Idem | Sem cutoff |
| 🟡 Média | Plano "10/10" #3, #4 (coverage, quality runner) | Bugs anteriores | Sem cutoff |
| 🟢 Baixa | T-FIX-5b — antipadrão B | T-FIX-4 audit | Sem cutoff |
| 🟢 Baixa | Issue 3 do post-mortem CRM — migrar `EXTERNAL_CRM_*` para `integration_credentials` | Post-mortem | Sponsor precisa fornecer chaves |
| 🟢 Baixa | Flakiness teardown async Helmet/Event listener | Sessão anterior | Sem cutoff |

---

## 🗺️ Navegação rápida

Para diferentes perfis que abrem o repo:

| Quem | O que olhar primeiro |
|------|-----------------------|
| **Novo dev** querendo entender o produto | [`README.md`](./README.md) |
| **Sponsor** querendo ver o que falta fechar | Este arquivo (`STATUS.md`) → seção *Pendências adiadas* |
| **Code reviewer** entendendo decisões recentes | [`docs/redeploy/SESSIONS.md`](./docs/redeploy/SESSIONS.md) (dashboard executivo) |
| **Agente IA novo** continuando o trabalho | [`docs/redeploy/SESSIONS.md`](./docs/redeploy/SESSIONS.md) → entrada mais recente |
| **Auditor** verificando trilha de mudanças | `docs/AUDITORIA-EXAUSTIVA-2026-05-23.md` + `docs/PLANO-20-ETAPAS-2026-05-23.md` + `docs/redeploy/T-FIX-*-*.md` |

---

## 🔄 Atualização deste arquivo

Este arquivo deve ser atualizado **ao final de cada sessão** que produz mudanças no estado operacional do projeto. Padrão BPM:

1. Sessão fecha → última entrada adicionada em `SESSIONS.md`
2. Pendências mudam → seção `Pendências adiadas` atualizada aqui
3. Backlog reordena → seção `Backlog priorizado` revisada aqui
4. Commit conjunto: `docs(status): refresh após sessão <X>`

> 💡 Quando o redeploy hardening tiver lead time zero (sem pendências, sem backlog crítico), este arquivo pode virar um simples "✅ projeto estável — sem hardening em curso" e ficar dormente até a próxima onda de melhorias.
