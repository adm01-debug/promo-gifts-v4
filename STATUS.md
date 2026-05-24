# 📡 Status do Projeto

> **Estado operacional do redeploy hardening do `promo-gifts-v4`.**
> Para entender o produto, ver [`README.md`](./README.md).
> Para o histórico completo de sessões, ver [`docs/redeploy/SESSIONS.md`](./docs/redeploy/SESSIONS.md).

---

## 🎯 Onde estamos hoje

**Última sessão**: 2026-05-23 — **Etapas 9-13** fechadas — refatoração do top-5 do TSC baseline (235 erros eliminados, 0 regressão).

**Sessões recentes**:
- 2026-05-23 (mais recente) — **Etapas 9-13** (top-5 TSC baseline) ✅
- 2026-05-23 — **Etapa 17 / T-FIX-5b** ✅
- 2026-05-23 — Auditoria exaustiva + Plano de 20 etapas (PR #124) — 11 etapas fechadas, 8 adiadas

| Métrica | Valor |
|---------|-------|
| Sessões de hardening concluídas | T-FIX-3, T-FIX-4, T-FIX-5, T-FIX-5b, Bugs #1/#2, Redeploy de schemas, Auditoria 2026-05-23 |
| Erros TS em `.tsc-baseline.json` | 1.010 (291 arquivos) — sem regressão · top-5 eliminado nas etapas 9-13 (2026-05-23) |
| Erros ESLint em `.eslint-baseline.json` | 442 (404 arquivos) — drift positivo de 31 capitalizado em 2026-05-23 |
| Próximo cutoff iminente | ✅ T-FIX-3 fechado em 2026-05-23 (era 2026-06-02) — sem outro cutoff em <30 dias |

---

## ✅ Fechado nesta sessão (2026-05-23 — Etapas 9-13: top-5 do TSC baseline)

Refatoração dos 5 arquivos com mais erros no `.tsc-baseline.json` — **235 erros TS eliminados**, baseline 1.253→1.010, **zero regressão** (gate `typecheck` verde).

| Etapa | Arquivo | Erros | Causa-raiz / correção |
|---|---|---|---|
| 9 | `lib/personalization/adapters/price-response.adapter.ts` | 61 → 0 | Parsers recebiam `Record<string,unknown>` → tipagem de fronteira (12 interfaces `Nested*`/`Flat*`); remove `AnyRec` e cast redundante |
| 10 | `pages/admin/AdminProductFormPage.tsx` | 60 → 0 | `PromobrindProduct` não declarava ~57 campos lidos pelo form → estende o tipo (todos opcionais/nullable) + tipa `products` no dedupe de SKU |
| 11 | `components/admin/products/new-supplier/tabs/AddressTab.tsx` | 56 → 0 | Prop `form: Record<string,unknown>` descartava o tipo do hook → `NewSupplierForm = ReturnType<typeof useNewSupplierForm>` |
| 12 | `components/admin/products/new-supplier/tabs/BasicDataTab.tsx` | 32 → 0 | Mesma origem do AddressTab (mesmo tipo de prop) |
| 13 | `components/compare/CompareTableView.tsx` | 26 → 0 | Acessos `camelCase`→`snake_case` (bugs latentes de runtime: `isKit`/`minQuantity`/`stockStatus`), null-safety em `images`/`colors`, helper `tagArray` p/ JSONB `tags`, refs aninhados `category`/`supplier` no tipo `Product` |

**Efeito colateral positivo**: a extensão de `Product` (refs `category`/`supplier`) tornou obsoletas 2 diretivas `@ts-expect-error` em `ExportFavoritesButton.tsx` (removidas).

**Follow-up registrado**: `StockRiskBadge.tsx` e `OtherSuppliersRow.tsx` ainda tipam `product: Record<string,unknown>` e têm bugs `camelCase` latentes próprios — fora de escopo aqui (cast no call-site); candidatos a uma futura etapa dedicada.

---

## ✅ Fechado em 2026-05-23 (Etapa 17 / T-FIX-5b)

**3 commits sequenciais** resolvendo o anti-padrão B do guard-rail ESLint:

- ✅ [`9bf51be`](https://github.com/adm01-debug/promo-gifts-v4/commit/9bf51beafeeb503794c9825f4cfbdd399c8ef351) — `src/pages/auth/AuthBranding.visual.test.tsx`: eslint-disable + comentário inline justificando (Opção A do T-FIX-5b)
- ✅ [`5318da2`](https://github.com/adm01-debug/promo-gifts-v4/commit/5318da2609064130db8898063bcb7c2e3f140fdc) — `src/components/quotes/__tests__/QuoteBuilderStepper.test.tsx`: mesma decisão para os 5 labels do stepper
- ✅ [`2543585`](https://github.com/adm01-debug/promo-gifts-v4/commit/2543585d28fcaa424741d3956be60f0be4d0ecda) — `docs/redeploy/T-FIX-5-LINT-GUARDRAIL.md`: doc atualizada registrando Fase 2 + 3 critérios para futuras decisões A vs B

**Decisão arquitetural**: Opção A (eslint-disable cirúrgico) venceu Opção B (refactor) e Opção C (warn). Custo real: ~10 min (vs ~3h estimados originalmente). Severity `error` continua protegendo o repo inteiro; apenas 2 exceções autorizadas com comentário inline auditável.

---

## ✅ Fechado em 2026-05-23 (Auditoria + Plano 20 etapas — PR #124)

### Quick wins / desbloqueio CI (Etapas 1-5)
- ✅ **Etapa 1** — P5 do plano "10/10": rename 3 params PascalCase em `AdminStandardRules.test.tsx:107-113`
- ✅ **Etapa 2** — refactor `useOptionalOnboardingContext`: elimina 3 empty catches + 3 violações `rules-of-hooks` + 3 `any`
- ✅ **Etapa 3** — regenera baseline ESLint capturando 31 erros eliminados (473→442)
- ✅ **Etapa 4** — T-FIX-3: bump 60 usos de GH Actions em 12 workflows (checkout/setup-node/upload-artifact)
- ✅ **Etapa 5** — T-FIX-5: apply `eslint.config.t-fix-5.proposed.js` → `eslint.config.js` + script `check:proposed-configs`

### Post-mortem CRM bridge (Etapas 6-8)
- ✅ **Etapa 6** — Issue 1: POP `docs/operations/cadastro-secrets-supabase.md` (7 seções)
- ✅ **Etapa 7** — Issue 2: `validateUrlFormat` em `connection-test-runner.ts` (5 tipos, 7 cenários)
- ✅ **Etapa 8** — Issue 2: 15 testes Deno para `validateUrlFormat`

### Pendências menores (Etapas 18-19)
- ✅ **Etapa 18** — `QuoteBuilderStepper.test.tsx:68`: remove forEach no-op
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

**3 etapas** do plano de 20 ainda ficam para sessões dedicadas (as 5 do TSC baseline — etapas 9-13 — foram fechadas em 2026-05-23):

| # | Etapa | Razão do adiamento | Esforço estimado |
|---|---|---|---|
| 14 | Reduzir `SupabaseConnectionsTab.tsx` (17 ESLint warnings) | Auditoria caso-a-caso | ~1h |
| 15 | Reduzir `CatalogContent.tsx` + `ProductQuickView.tsx` (32 warnings) | Idem | ~2h |
| 16 | Reduzir `useSimulatorWizard.ts` + `useGlobalSearch.ts` (27 warnings) | Idem | ~2h |

**Total estimado**: ~5h de trabalho cuidadoso.

> 💡 Sugestão: rodar essas etapas **uma por sessão dedicada**, sem misturar com novas features.

---

## 📅 Backlog priorizado (atualizado)

| Prioridade | Item | Origem | Cutoff |
|------------|------|--------|--------|
| 🟡 Média | Reduzir top arquivos do ESLint baseline (etapas 14-16) | Auditoria 2026-05-23 | Sem cutoff |
| 🟡 Média | Plano "10/10" #3, #4 (coverage, quality runner) | Bugs anteriores | Sem cutoff |
| 🟢 Baixa | Issue 3 do post-mortem CRM — migrar `EXTERNAL_CRM_*` para `integration_credentials` | Post-mortem | Sponsor precisa fornecer chaves |
| 🟢 Baixa | Flakiness teardown async Helmet/Event listener | Sessão anterior | Sem cutoff |

> ✅ **Removido do backlog em 2026-05-23**: T-FIX-5b (Etapa 17) — anti-padrão B do guard-rail ESLint resolvido via Opção A. Ver `docs/redeploy/T-FIX-5-LINT-GUARDRAIL.md` → seção "Fase 2 — T-FIX-5b RESOLVIDO".
>
> ✅ **Removido do backlog em 2026-05-23**: Etapas 9-13 (top-5 do TSC baseline) — 235 erros eliminados (price-response.adapter 61, AdminProductFormPage 60, AddressTab 56, BasicDataTab 32, CompareTableView 26). Baseline TSC 1.253→1.010. Zero regressão.

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
