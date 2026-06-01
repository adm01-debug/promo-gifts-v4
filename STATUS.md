# 📡 Status do Projeto

> **Estado operacional do redeploy hardening do `promo-gifts-v4`.**
> Para entender o produto, ver [`README.md`](./README.md).
> Para o histórico completo de sessões, ver [`docs/redeploy/SESSIONS.md`](./docs/redeploy/SESSIONS.md).

---

## 🎯 Onde estamos hoje

**Última sessão**: 2026-05-27 — **Auditoria exaustiva do módulo `mockup-generator` (rodada 2)** (`claude/mockup-generator-audit-KlHz3`). Aprofundou a auditoria T1‑T10 anterior cobrindo 12 gaps remanescentes (G1‑G12) e reconciliando o contrato real frontend↔edge↔testes. Destaques: (1) **edge `generate-mockup`** — rejeição de SVG com `errorCode:SVG_NOT_SUPPORTED`, fetch produto+logo em paralelo, `ai_generation_timeout`→`composition_timeout` (não há IA — é compositor canvas), allowlist de host opt-in p/ SSRF; (2) **service** — tradução robusta de erro da edge (lê `error.context`), remoção do payload morto `areas[]`, `layout_url`+`area_config` no select do histórico; (3) **rotação/escala** agora persistidas em `area_config` (sem migration) e restauradas no `loadFromHistory`; (4) **guards de input** no cliente (logo SVG, imagem de produto relativa/`placeholder.svg`); (5) **delete unificado** (fonte única no hook, removido estado duplicado da página) + histórico "carregar" agora usa o `loadFromHistory` rico; (6) **testes** — suíte grep substituída por testes comportamentais reais (service + storage), integração reescrita p/ contrato real, `MockupDeletion` atualizado, fixtures e2e migradas de SVG→PNG. Gates: build ✅, baseline TSC ✅ (zero regressão), 62 testes do módulo ✅, ESLint sem novos problemas nos arquivos tocados. _Nota: composição via `OffscreenCanvas` mantida por decisão (assumida funcional em prod); migração do motor fica para sessão dedicada se surgir `canvas_runtime_unavailable`._

**Sessão anterior**: 2026-05-26 — **Suíte de integração LIVE das Edge Functions**. Harness em `tests/edge-functions/live/` (`_live-client`/`_authz`/`_schemas`/`_live-suite` + registro `descriptors.ts`) cobrindo **82/82** edge functions com HTTP real (fronteira de auth, CORS, validação de input, contrato de erro, sem-crash 5xx) — 672 casos, validados contra o ambiente deployado. Funções destrutivas em negative-only/dry-run. Fuzz expandido (8→20 endpoints, +imagem/uploads). Gate `check:edge-live-coverage` + passos LIVE plugados em `ci.yml` e `edge-integration-all.yml`. Doc: [`docs/testing/EDGE_LIVE_TESTS.md`](./docs/testing/EDGE_LIVE_TESTS.md). _Nota: gate `typecheck` já acusava drift legado em `useGlobalSearch.ts` (etapa 16 adiada), não relacionado a esta sessão._

**Última sessão**: 2026-05-25 — **Hardening de fluxos de usuário** (`claude/project-comprehensive-audit-555Dk`). Auditoria focada nos fluxos do vendedor (catálogo→carrinho→orçamento→kit). Achados/correções: (1) **carrinho** — 10 mutations de `useSellerCarts.ts` engoliam erros sem feedback (RLS/rede/constraint); adicionado `onError` consistente via `sanitizeError`; reorder agora aborta em falha parcial; `duplicateItemToCart` passou a copiar `sort_order`. (2) **#339** — confirmado via DB ao vivo que 6 colunas de personalização não existem (`area_image_url`, `max_area_cm2`, `is_default`×2, `is_personalizable`); migration aditiva idempotente **redigida** (`20260525232003_fix_339_*`), **não aplicada em prod** (aguarda revisão/deploy). Advisors read-only rodados no banco: 0 ERROR de segurança, estado bate com a doc. Gates: build ✅, baseline TSC ✅ (zero regressão), testes do carrinho 8/8 ✅.

**Sessão anterior**: 2026-05-24 — **Continuação do colapso** (`claude/confident-heisenberg-M03BW`). Achado central: o kill-switch nunca havia sido ligado no código da edge `external-db-bridge` (causa raiz do colapso). Corrigido no código + 5 migrations DB aplicadas via MCP (REVOKE anon, drop de 67 índices ociosos, consolidação de policies, captura de `fn_handle_new_user`, otimização do drift-check). `fn_run_smoke_tests()` 14/14 ✅. Detalhes em [`docs/RUNBOOK_COLAPSO_2026-05-24.md`](./docs/RUNBOOK_COLAPSO_2026-05-24.md).

**Sessão anterior**: 2026-05-23 — **Etapas 9-13** fechadas — refatoração do top-5 do TSC baseline (235 erros eliminados, 0 regressão).

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
>
> 💡 Lição da Etapa 13: a causa real no compare folder era import errado entre dois tipos `Product` distintos (`@/types/product` DB-oriented vs `@/types/product-catalog` runtime). Antes de atacar um componente por suposto problema snake_case/camelCase, primeiro confirme se ele importa o tipo runtime correto.

---


## 🌊 Plano de implementação em ondas (P0 primeiro)

> Horizonte sugerido: **4 semanas corridas** a partir de **2026-05-25**.
> Regra de execução: **não iniciar P1 sem concluir critérios de prontidão de P0**.

### Onda P0 (Semana 1 — 2026-05-25 a 2026-05-31)
**Objetivo:** eliminar riscos bloqueantes de operação/segurança e estabilizar trilha de validação.

**Escopo foco**
- Fechar pendências classificadas como bloqueantes no runbook de colapso e auditorias recentes.
- Garantir smoke tests e gates mínimos de CI verdes no fluxo principal.
- Confirmar observabilidade mínima para detectar regressão imediatamente após deploy.

**Marcos semanais (milestones)**
- **M1 (até 2026-05-27):** inventário final de bloqueadores aberto/fechado, com owner por item.
- **M2 (até 2026-05-29):** validação técnica dos fixes de bloqueadores em ambiente controlado.
- **M3 (até 2026-05-31):** checklist de produção assinado (go/no-go) para liberar P1.

**Critérios de prontidão (DoR/DoD da etapa)**
- 100% dos bloqueadores P0 classificados como “fechado” ou com rollback seguro documentado.
- `fn_run_smoke_tests()` sem falhas (baseline da sessão anterior: 14/14).
- Gates críticos do CI (typecheck/testes essenciais) sem regressão em relação ao baseline atual.
- Runbook de incidente atualizado com passos de rollback e owner de plantão.

### Onda P1 (Semana 2 — 2026-06-01 a 2026-06-07)
**Objetivo:** reduzir dívida técnica que gera risco de regressão funcional e de qualidade.

**Escopo foco**
- Executar etapas 14-16 (redução de warnings ESLint em arquivos prioritários).
- Atacar warnings com maior potencial de bug latente (tipagem frouxa, imports ambíguos, fluxos nulos).

**Marcos semanais (milestones)**
- **M4 (até 2026-06-03):** Etapa 14 concluída + diff de warnings publicado.
- **M5 (até 2026-06-05):** Etapa 15 concluída + validação de regressão local/CI.
- **M6 (até 2026-06-07):** Etapa 16 concluída + baseline recalibrado (se aplicável).

**Critérios de prontidão**
- Etapas 14-16 concluídas com evidência (commits + output de checks).
- Nenhum aumento líquido nos baselines de ESLint/TSC.
- Componentes tocados sem TODO bloqueante aberto.

### Onda P2 (Semana 3 — 2026-06-08 a 2026-06-14)
**Objetivo:** consolidar confiabilidade operacional e preparar escala de manutenção.

**Escopo foco**
- Fechar itens médios de qualidade runner/coverage (plano 10/10 #3 e #4).
- Tratar flakiness remanescente de teardown async/helmet/event listeners.

**Marcos semanais (milestones)**
- **M7 (até 2026-06-10):** estratégia de coverage acordada e aplicada no pipeline.
- **M8 (até 2026-06-12):** correções de flakiness aplicadas com repetição de testes.
- **M9 (até 2026-06-14):** estabilidade de suíte validada em execuções consecutivas.

**Critérios de prontidão**
- Redução perceptível de intermitência de testes (registro em sessão).
- Pipeline de qualidade executável sem bypass manual.
- Checklists de troubleshooting atualizados para time de manutenção.

### Onda P3 (Semana 4 — 2026-06-15 a 2026-06-21)
**Objetivo:** finalizar pendências não-bloqueantes e formalizar estado estável do redeploy.

**Escopo foco**
- Pendências baixas (ex.: Issue 3 CRM depende de sponsor/chaves).
- Documentação final de operação contínua e “steady state”.

**Marcos semanais (milestones)**
- **M10 (até 2026-06-17):** decisão explícita sobre itens dependentes de terceiros.
- **M11 (até 2026-06-19):** handoff técnico consolidado.
- **M12 (até 2026-06-21):** STATUS simplificado para modo manutenção (se elegível).

**Critérios de prontidão**
- Backlog sem item crítico/médio sem owner.
- Dependências externas com SLA/data alvo registrada.
- Projeto apto a operar sem “onda de hardening” ativa.

## 🛡️ Plano de mitigação para gaps bloqueantes

### 1) Identificação e classificação rápida (até 24h)
- Classificar cada gap em: **bloqueante**, **alto não-bloqueante**, **monitorável**.
- Atribuir owner técnico + owner de negócio por gap.
- Registrar impacto (segurança, disponibilidade, compliance, dados).

### 2) Contenção imediata (fail-safe)
- Aplicar feature flag/kill-switch quando houver risco de impacto em produção.
- Se não houver correção segura no mesmo ciclo, ativar rollback para último estado estável.
- Congelar mudanças não essenciais no mesmo domínio até estabilização.

### 3) Remediação com janela controlada
- Corrigir primeiro causa-raiz (não apenas sintoma).
- Exigir evidência mínima: teste automatizado ou smoke reproduzindo o cenário do gap.
- Executar validação pós-fix em duas camadas: técnica (CI/smoke) + operacional (runbook).

### 4) Governança e comunicação
- Abrir registro de incidente interno para todo gap bloqueante.
- Publicar status diário curto enquanto houver bloqueador aberto.
- Declarar explicitamente critério de saída: quando o gap deixa de ser bloqueante.

### 5) Prevenção de recorrência
- Transformar o aprendizado em guard-rail (lint, teste, policy, monitor, alerta).
- Atualizar documentação de arquitetura/operação na mesma PR do fix.
- Revisar se há outros pontos homólogos com a mesma vulnerabilidade estrutural.


## 📅 Backlog priorizado (atualizado)

### Consolidação de gaps (cobertura, qualidade e fuzz) — priorizada por risco × impacto de negócio

| Prioridade | Gap consolidado | Risco técnico | Impacto no negócio | Owner | Prazo alvo | Critério de verificação pós-correção |
|------------|------------------|---------------|--------------------|-------|------------|--------------------------------------|
| 🔴 P0 | **Coverage em fluxos críticos de receita/autorização** (`discountApprovalFlow`, `simulator-wizard-pricing-parity`, contratos webhook/transactional-email) | Regressão silenciosa em regras de preço, aprovação comercial e integração transacional | Orçamento incorreto, atraso de pedidos e risco de perda de venda | **Backend + Pricing guild** | **2026-06-07** | Suite alvo obrigatória verde (`tests/integration/discountApprovalFlow.test.ts`, `tests/integration/simulator-wizard-pricing-parity.test.ts`, `tests/contracts/send-transactional-email.contract.test.ts`, `tests/contracts/webhooks.contract.test.ts`) + cobertura mínima >= baseline atual nesses diretórios |
| 🔴 P0 | **Quality debt do baseline ESLint (etapas 14-16)** em `SupabaseConnectionsTab`, `CatalogContent`, `ProductQuickView`, `useSimulatorWizard`, `useGlobalSearch` | Warnings mascaram defeitos de tipagem/lógica e dificultam revisão | Aumenta lead time de entrega e chance de hotfix em produção | **Frontend chapter (Admin + Search)** | **2026-06-10** | `npm run lint` sem aumento do baseline e redução líquida nos 5 arquivos-alvo + checklist de revisão sem `eslint-disable` novo não justificado |
| 🟠 P1 | **Fuzz/property tests para parsing e borda de dados externos** (`price-response.adapter`, máscaras, formatação, mapper de produto, URLs) | Inputs malformados escapam dos testes de exemplo | Falhas intermitentes em cadastro/cotação e suporte reativo | **Quality Enablement + Backend integration** | **2026-06-14** | Novos testes fuzz determinísticos passando (seed fixo) cobrindo parsers críticos + regressão reproduzida por pelo menos 1 caso mínimo por classe de bug |
| 🟡 P2 | **Runner de qualidade unificado do plano 10/10 (#3 e #4)** com gate explícito de coverage + smoke + contratos prioritários | Sinais de qualidade fragmentados entre scripts | Decisão de release sem visão única (risco de falso verde) | **DevEx/CI** | **2026-06-17** | Pipeline único documentado e executável local/CI; falha obrigatória quando qualquer gate crítico quebrar; evidência em log de execução anexada no PR |
| 🟢 P3 | Issue 3 do post-mortem CRM — migrar `EXTERNAL_CRM_*` para `integration_credentials` | Persistência de segredo fora do fluxo padrão | Bloqueio de evolução de segurança/compliance | **Plataforma + Sponsor** | **Dependente de chaves do sponsor (sem data firme)** | Migração aplicada em ambiente de teste + rotação de segredo validada + runbook atualizado |
| 🟢 P3 | Flakiness teardown async Helmet/Event listener | Instabilidade intermitente de testes de UI | Ruído em CI e retrabalho de triagem | **Frontend chapter** | **2026-06-21** | Reexecução 20x dos testes-alvo sem falha intermitente + remoção de skips/workarounds temporários |

### Critérios transversais de aceite (todos os itens acima)

1. **Sem regressão de baseline** (`.tsc-baseline.json` e `.eslint-baseline.json` não podem piorar).
2. **Evidência no PR**: comando rodado, output resumido e arquivo/teste afetado.
3. **Owner explícito na issue** com data alvo e status semanal (`on-track`, `at-risk`, `blocked`).
4. **Pós-correção monitorado por 7 dias** sem reabertura do mesmo bug/sintoma.

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
