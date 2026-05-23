# Auditoria exaustiva de bugs e falhas — `promo-gifts-v4`

> **Data**: 2026-05-23
> **Branch analisada**: `claude/code-bug-analysis-VLG0u`
> **Última sessão de hardening**: T-FIX-5 (2026-05-22)
> **Escopo**: 4 frentes — baselines de dívida, hardening, code smells, post-mortems abertos
> **Método**: leitura cruzada de `STATUS.md`, `docs/redeploy/SESSIONS.md`, `docs/issues-pendentes-2026-05-22.md`, baselines JSON, e varredura `grep`/`jq` sobre `src/` e `supabase/functions/`

---

## TL;DR

**Resposta direta à pergunta "todos os bugs e falhas foram corrigidos?": NÃO.**

O projeto opera sob 3 gates de regressão (`.tsc-baseline.json`, `.eslint-baseline.json`, `.toast-leaks-baseline.json`) que congelam **1.333 erros TypeScript + 409 arquivos com warnings ESLint + 176 toast leaks** como dívida tolerada. Esses gates impedem PIORA, não obrigam CORREÇÃO. Além disso, **9 itens declarados em `STATUS.md`** e **3 issues abertas do post-mortem 2026-05-22** continuam sem fechar.

| Categoria | ✅ Corrigido | 🟡 Pendente | 🔴 Congelado (baseline) |
|---|---|---|---|
| Hardening (T-FIX-*, Ondas, Bugs #1/#2, T14) | 14 sessões fechadas | 7 itens em `STATUS.md` | — |
| Erros TypeScript | corrigidos via PRs específicos | 1.333 erros em 320 arquivos | 1.333 |
| Warnings ESLint | regressões barradas no CI | 409 arquivos com warnings registrados | 409 |
| Toast leaks | regressões barradas | — | 176 |
| Post-mortems / incidentes | 1 fechado (CRM bridge URL) | 3 issues sem PR | — |
| Code smells (`as any`, `eslint-disable`) | — | 175 type escapes + 73 eslint-disable + 3 empty catch | — |

---

## 1. Dívida congelada em baselines

Os 3 baselines são **gates de regressão**, não correções. O CI falha apenas se um arquivo:regra ganhar erro novo — drift positivo (redução) é permitido. Em produção isso significa: **a dívida está visível e quantificada, mas não obrigatoriamente decrescente**.

### 1.1 `.tsc-baseline.json` — 1.333 erros TypeScript

- Snapshot: `2026-05-22T14:24:10.689Z`
- 320 arquivos com erros suprimidos
- **Subiu** de 1.214 (2026-05-09, PR #109) → 1.333 (2026-05-22) = **+119 erros em 13 dias**
- Gate: `scripts/check-tsc-baseline.mjs` via `npm run typecheck`
- Comando para ver todos: `npm run typecheck:full`

**Top 5 arquivos para refatorar (28% da dívida concentrada):**

| Arquivo | Erros suprimidos |
|---|---|
| `src/lib/personalization/adapters/price-response.adapter.ts` | 61 |
| `src/pages/admin/AdminProductFormPage.tsx` | 60 |
| `src/components/admin/products/new-supplier/tabs/AddressTab.tsx` | 56 |
| `src/components/admin/products/new-supplier/tabs/BasicDataTab.tsx` | 32 |
| `src/components/compare/CompareTableView.tsx` | 26 |

**Top 5 (continuação):** `MaterialsFilter.tsx` (24), `useAccessSecurity.ts` (20), `RamosFilter.tsx` (19), `FutureStockModal.tsx` (19), `AdminStructuralComparison.test.tsx` (19) = 21% adicional.

> 🚨 **Sinal de alerta**: o baseline TS aumenta a cada sessão. O gate previne regressão por arquivo:regra, mas novos arquivos com erros entram livremente. Sem uma meta de redução por sprint, a dívida só cresce.

### 1.2 `.eslint-baseline.json` — 409 arquivos com warnings

- Snapshot: `2026-05-22T03:12:40.396Z`
- 409 arquivos com entradas
- Gate: `scripts/check-eslint-baseline.mjs` via `npm run lint:baseline`

**Top 5 arquivos:**

| Arquivo | Warnings |
|---|---|
| `src/components/admin/connections/SupabaseConnectionsTab.tsx` | 17 |
| `src/components/catalog/CatalogContent.tsx` | 16 |
| `src/components/products/ProductQuickView.tsx` | 16 |
| `src/hooks/simulator/useSimulatorWizard.ts` | 15 |
| `src/components/search/useGlobalSearch.ts` | 12 |

### 1.3 `.toast-leaks-baseline.json` — 176 leaks

- Snapshot: `2026-05-18T12:27:24.885Z`
- Gate: `scripts/check-toast-leaks.mjs`
- Tipo: toasts que escapam do sanitizador `safeToast` (ver `src/lib/security/safeToast.ts`)

---

## 2. Hardening — status por sessão

Fonte autoritativa: `docs/redeploy/SESSIONS.md` + `STATUS.md`.

### 2.1 ✅ Corrigido e mergeado (14 sessões)

| Sessão | Data | Commits | Estado |
|---|---|---|---|
| T-FIX-4 — `forEach` → `it.each` em 5 arquivos de teste | 2026-05-22 | `b9a51be` → `a2c3fa2` | ✅ fechado (2.014 testes pós-refator vs ~57 antes) |
| Bug #1 do "10/10" — Migrations sync guard | 2026-05-22 | PR #111 `5f3ec9d` | ✅ mergeado |
| Bug #2 do "10/10" — `parseContract` generics | 2026-05-22 | PR #115 `0c650ca` | ✅ mergeado (#116 fechado como duplicate) |
| Redeploy de schemas — Fases 2+3+3.5+4+1.1 | 2026-05-22 | 10 commits | ✅ fechado |
| Manual Lovable → Supabase Oficial | 2026-05-22 | 4 commits, ~95 KB | ✅ publicado |
| T14 UPDATE 3 — outcome gate → marker-file pattern | < 2026-05-22 | `7b50609` | ✅ deployed |
| T14 UPDATE 4 — auto-commit smoke gate diagnostic | < 2026-05-22 | `e96134c` | ✅ deployed |
| Onda 1 — Edge auth | < 2026-05-09 | `docs/hardening/ONDA-1-EDGE-AUTH.md` | ✅ fechada |
| Onda 3 — Remove orphans | < 2026-05-09 | `ONDA-3-REMOVE-ORPHANS.md` | ✅ fechada |
| Onda 4 — esbuild preserve warn/error | < 2026-05-09 | `ONDA-4-ESBUILD-PRESERVE-WARN-ERROR.md` | ✅ fechada |
| Onda 5 — Glitchtip init | < 2026-05-09 | `ONDA-5-GLITCHTIP-INIT.md` | ✅ fechada |
| Onda 6 — AI quota fail-closed | < 2026-05-09 | `ONDA-6-AI-QUOTA-FAIL-CLOSED.md` | ✅ fechada |
| Onda 7 — Discount fail-closed | < 2026-05-09 | `ONDA-7-DISCOUNT-FAIL-CLOSED.md` | ✅ fechada |
| Onda 8 — RLS notification templates | < 2026-05-09 | `ONDA-8-RLS-NOTIFICATION-TEMPLATES.md` | ✅ fechada |
| Onda 9 — Drop public token tables | < 2026-05-09 | `ONDA-9-DROP-PUBLIC-TOKEN-TABLES.md` | ✅ fechada |
| Onda 10 — Sync quote Bitrix auth | < 2026-05-09 | `ONDA-10-SYNC-QUOTE-BITRIX-AUTH.md` | ✅ fechada |
| **Typecheck bug (cobertura de 1 arquivo apenas)** | 2026-05-09 | `fix/typecheck-coverage-with-baseline` | ✅ fechado via PR #109 |

### 2.2 🟡 Pendente (declarado em `STATUS.md`)

| # | Pendência | Cutoff | Bloqueio |
|---|---|---|---|
| P1 | **T-FIX-5** — 3 passos manuais (apply `eslint.config.t-fix-5.proposed.js` → `eslint.config.js`, `npm pkg set scripts.check:proposed-configs=...`, validar suite vitest) | ASAP | Aguarda sponsor (Joaquim) — MCP sem acesso ao blob SHA |
| P2 | **T-FIX-3** — bump GH Actions: `checkout@v4→v5`, `setup-node@v4→v6`, `upload-artifact@v4→v5` | **2026-06-02** | Backlog herdado |
| P3 | Plano "10/10" #3 — Test Coverage | — | Aberto |
| P4 | Plano "10/10" #4 — quality "Run tests" | — | Aberto |
| P5 | Plano "10/10" #5 — ESLint baseline gate (3 warnings em `AdminStandardRules.test.tsx` por params PascalCase do T-FIX-4) | — | Aberto |
| P6 | T-FIX-5b — antipadrão B residual (`expect` em `forEach` em `it`) | — | Baixa prioridade |
| P7 | `tests/.../QuoteBuilderStepper.test.tsx:68` forEach vazio | — | Baixa prioridade |
| P8 | `tests/.../ScenarioSimulation.test.ts` — 1 fail Scenario 2 CIF/FOB | — | Baixa prioridade |
| P9 | Flakiness teardown async Helmet/Event listener | — | Baixa prioridade |

---

## 3. Code smells (varredura `src/` + `supabase/functions/`)

### 3.1 Resumo numérico

| Categoria | Total | Severidade |
|---|---|---|
| `@ts-ignore` / `@ts-expect-error` / `@ts-nocheck` | 15 | 🟢 baixa (a maioria são hints Deno runtime legítimos) |
| `eslint-disable` (linhas ou arquivos) | 73 | 🟡 média |
| `as any` (escape de tipo) | 68 | 🟡 média |
| `as unknown` (escape de tipo) | 107 | 🟡 média |
| Empty catch blocks `catch(e) {}` | 3 | 🔴 alta |
| Markers reais `TODO:` / `FIXME` / `HACK:` / `XXX:` / `BUG:` | **0** | ✅ excelente — sem dívida em comentário |
| Pendências `TODO` em comentário ortográfico em pt-BR | ~23 (descartadas) | — |

> 📝 **Nota metodológica**: o grep inicial por `TODO|FIXME|HACK|XXX|BUG:` capturou 23 ocorrências, mas após revisão **zero** são markers reais. Todos os hits eram a palavra portuguesa "TODOS" em comentários (ex: `// === GRADIENTES — TODOS RAINBOW ===` em `theme-presets.ts`) ou strings literais como `"HACKED"` em testes RLS (`rls-audit/index.ts:126`).

### 3.2 Empty catches (correção sugerida — alta prioridade)

3 ocorrências que silenciam erros sem log:

```
src/components/ui/ShortcutsHelpDialog.tsx:20            } catch (e) {}
src/components/common/EnhancedSpotlight.tsx:25          } catch (e) {}
src/components/layout/sidebar/SidebarBrandHeader.tsx:16 } catch (e) {}
```

**Risco**: erros aqui passam despercebidos. Mínimo aceitável: `catch { /* intencional: motivo */ }` ou um `logger.debug(e)`.

### 3.3 Top `as any` (escape de tipo)

| Arquivo | Ocorrências |
|---|---|
| `src/components/admin/connections/__tests__/ConnectionsOverviewTable.test.tsx` | 7 |
| `src/logic/quotes/__tests__/calculations.test.ts` | 6 |
| `src/hooks/common/useOrgData.ts` | 5 |
| `src/components/dev/__tests__/BridgeMetricsOverlay.test.tsx` | 5 |
| `src/hooks/__tests__/useAdvancedFilters.unit.test.tsx` | 4 |

Maior parte em testes (aceitável quando mocka tipos complexos). `useOrgData.ts` (produção, 5 escapes) merece refator.

### 3.4 Top `eslint-disable`

| Arquivo | Ocorrências |
|---|---|
| `src/hooks/mockup/useMockupGenerator.ts` | 9 |
| `src/components/admin/connections/SmokeTestChecklist.tsx` | 9 |
| `supabase/functions/e2e-cleanup/index.ts` | 5 |

`useMockupGenerator.ts` e `SmokeTestChecklist.tsx` são candidatos a auditoria caso-a-caso para entender se as supressões ainda são necessárias.

### 3.5 `@ts-ignore` / `@ts-expect-error` — todos legítimos

15 ocorrências, todas com justificativa em comentário:

- 8x em `supabase/functions/e2e-cleanup/index.ts` — `@ts-ignore - Deno runtime` (legítimo — Deno globals não tipados)
- 4x em componentes `favorites/*` — `@ts-expect-error - category_name vem do enriched` (legítimo — narrowing de tipo enriquecido)
- 1x em `hooks/__tests__/useGenericFuzzySearch.unit.test.tsx` — testa null query
- 2x em `supabase/functions/_shared/dispatcher-auth.test.ts` — testa runtime guard

✅ **Nenhum `@ts-ignore` órfão ou injustificado encontrado.**

---

## 4. Post-mortems / incidentes abertos

### 4.1 ✅ Incidente CRM bridge — corrigido em runtime (2026-05-22)

- Documento: `docs/incidents/2026-05-22-crm-db-bridge-url-malformada.md`
- Causa: URL do Dashboard colada no secret `EXTERNAL_CRM_URL` em vez da URL da API
- Resolução: secret corrigido manualmente, deploy v53 OK em 17:11 UTC
- **MAS**: 3 issues derivadas seguem sem PR

### 4.2 🟡 3 issues abertas (`docs/issues-pendentes-2026-05-22.md`)

MCP de criação de issues falhou na sessão; specs estão prontas em markdown:

| # | Issue | Esforço | Bloqueio |
|---|---|---|---|
| I1 | `docs(operations): POP de cadastro de secrets externos` | ~1h (doc puro) | nenhum |
| I2 | `feat(observability): connections-health-check valida formato de URLs externas` (`validateUrlFormat`) | ~3h (código + testes) | nenhum |
| I3 | `refactor(security): migrar EXTERNAL_CRM_* para integration_credentials (DB-first)` | ~2h (+24h canary) | sponsor precisa fornecer `EXTERNAL_CRM_SERVICE_ROLE_KEY` e `EXTERNAL_CRM_ANON_KEY` |

**Risco residual**: I2 é o gap mais perigoso — sem `validateUrlFormat`, qualquer URL não-vazia passa o check superficial e só falha no `fetch()`, mascarando a causa-raiz como já aconteceu.

### 4.3 ✅ Incidente env exposure (2026-04) — fechado

- Documento: `docs/INCIDENTS/2026-04-env-exposure.md`
- Não há ação pendente declarada.

---

## 5. Matriz risco × cutoff

| Item | Risco | Cutoff | Recomendação |
|---|---|---|---|
| 1.333 erros TS subindo (+119/13d) | 🔴 ALTO — tendência crescente | sem prazo | Definir meta de redução por sprint |
| T-FIX-3 bump GH Actions | 🟡 MÉDIO — depreciação | **2026-06-02** | **Atacar primeiro — 10 dias** |
| Issue 2 — `validateUrlFormat` | 🟡 MÉDIO — repete incidente | sem prazo | Próxima sessão após T-FIX-3 |
| T-FIX-5 (3 passos manuais sponsor) | 🟡 MÉDIO — guarda anti-regressão | ASAP | Confirmar com sponsor |
| 3 empty catches | 🟡 MÉDIO — debug invisível | sem prazo | Quick fix (~15 min) |
| 176 toast leaks | 🟢 BAIXO — barrado por gate | sem prazo | Atacar quando refatorar áreas afetadas |
| 409 arquivos ESLint warnings | 🟢 BAIXO — barrado por gate | sem prazo | Mesmo padrão |

---

## 6. Recomendação priorizada (top 5)

1. **T-FIX-3 — bump GH Actions** (cutoff iminente, baixo esforço) — ~30 min
2. **Issue 2 — `validateUrlFormat`** (fecha gap do incidente CRM, médio esforço) — ~3h
3. **3 empty catches** (alto risco, baixíssimo esforço) — ~15 min (`ShortcutsHelpDialog.tsx:20`, `EnhancedSpotlight.tsx:25`, `SidebarBrandHeader.tsx:16`)
4. **Plano de ataque para tsc-baseline** — começar pelos 5 arquivos com 61+60+56+32+26 = **235 erros (18% da dívida)**, focando em `price-response.adapter.ts` e `AdminProductFormPage.tsx`
5. **T-FIX-5 (3 passos sponsor)** — desbloqueia o gate ESLint contra `forEach()` em testes

---

## 7. Anexos

### 7.1 Arquivos com `@ts-ignore` / `@ts-expect-error` (lista completa)

```
src/components/favorites/FavoritePresentationLauncher.tsx:22
src/components/favorites/FavoritePresentationLauncher.tsx:28
src/components/favorites/ExportFavoritesButton.tsx:58
src/components/favorites/ExportFavoritesButton.tsx:96
src/hooks/__tests__/useGenericFuzzySearch.unit.test.tsx:64
supabase/functions/e2e-cleanup/index.ts:26
supabase/functions/e2e-cleanup/index.ts:158
supabase/functions/e2e-cleanup/index.ts:175
supabase/functions/e2e-cleanup/index.ts:177
supabase/functions/e2e-cleanup/index.ts:184
supabase/functions/e2e-cleanup/index.ts:186
supabase/functions/e2e-cleanup/index.ts:223
supabase/functions/e2e-cleanup/index.ts:331
supabase/functions/_shared/dispatcher-auth.test.ts:31
supabase/functions/_shared/dispatcher-auth.test.ts:33
```

### 7.2 Como reproduzir a auditoria

```bash
# Dívida em baselines
jq '.totalErrors, .generatedAt' .tsc-baseline.json
jq '(.counts | length), .generatedAt' .eslint-baseline.json
jq '.total, .generated_at' .toast-leaks-baseline.json

# Top arquivos
jq '.counts | to_entries | map({k:.key, c: (if (.value | type) == "object" then (.value | to_entries | map(.value) | add) else .value end)}) | sort_by(-.c) | .[0:5]' .tsc-baseline.json

# Code smells
grep -rEn '@ts-(ignore|expect-error|nocheck)' src/ supabase/functions/ --include="*.ts" --include="*.tsx" | wc -l
grep -rEn ' as any[^a-zA-Z]' src/ --include="*.ts" --include="*.tsx" | wc -l
grep -rEn 'catch\s*\([^)]*\)\s*\{\s*\}' src/ supabase/functions/ --include="*.ts" --include="*.tsx"

# Gates de regressão (rodam em CI)
npm run typecheck         # gate tsc-baseline
npm run lint:baseline     # gate eslint-baseline
npm run check:toast-leaks # gate toast-leaks
```

### 7.3 Referências cruzadas

- `STATUS.md` — pendências do sponsor + backlog priorizado
- `docs/redeploy/SESSIONS.md` — dashboard executivo das sessões
- `docs/redeploy/T-FIX-5-CHECKLIST.md` — 3 passos manuais pendentes
- `docs/issues-pendentes-2026-05-22.md` — specs das 3 issues do post-mortem CRM
- `docs/incidents/2026-05-22-crm-db-bridge-url-malformada.md` — post-mortem fonte
- `docs/sessoes/2026-05-09-typecheck-bug-found.md` — origem do baseline TS

---

## Conclusão

O projeto está **estruturalmente saudável**: hardening recente fechou 16 sessões, gates de regressão protegem contra piora, zero marker TODO/FIXME órfão, todos os `@ts-ignore` têm justificativa, apenas 3 empty catches.

**Mas não é "bug-free":**
- **1.333 erros TS suprimidos** crescendo a +9/dia
- **9 pendências em `STATUS.md`** (1 com cutoff em 10 dias)
- **3 issues abertas** do incidente CRM sem PR
- **176 toast leaks + 409 arquivos ESLint** com warnings tolerados

A pergunta correta não é "todos foram corrigidos?" (resposta: não) mas **"a dívida está sob controle?"** — e a resposta aqui é **parcialmente**: gates impedem regressão, mas sem meta de redução, a dívida só cresce.

---

## Adendo (2026-05-23 — sessão de correção em sequência ao relatório)

Após este relatório, foi executado um **plano de 20 etapas de correção** (PR #124, branch `claude/code-bug-analysis-VLG0u`). Resultado:

### ✅ 11 etapas fechadas

| # | Etapa | Commit |
|---|---|---|
| 1 | Fix P5 (PascalCase params em `AdminStandardRules.test.tsx`) | `1160f3b` |
| 2 | `useOptionalOnboardingContext` elimina 3 empty catches + 3 `rules-of-hooks` + 3 `any` | `94577a9` |
| — | Fix TS2322 em `PriceFreshnessBadge.snapshots.test.tsx` (regressão herdada T-FIX-4) | `964518e` |
| 3 | Regenera baseline ESLint (473→442 erros, -31) | `285cd22` |
| 4 | T-FIX-3: bump 60 usos GH Actions em 12 workflows | `c9ab4a2` |
| 5 | T-FIX-5: apply proposed config + `check:proposed-configs` script | `5876bfc` |
| 6 | Issue 1 do post-mortem: POP `docs/operations/cadastro-secrets-supabase.md` | `fab293b` |
| 7 | Issue 2: `validateUrlFormat` em `connection-test-runner.ts` | `e5632a1` |
| 8 | Issue 2: 15 testes Deno para `validateUrlFormat` | `307ddfd` |
| 18 | Remove forEach no-op em `QuoteBuilderStepper.test.tsx` | `6250622` |
| 19 | Corrige Scenario 2 CIF/FOB em `ScenarioSimulation.test.ts` (3 cenários) | `17a16d3` |

### 🟡 9 etapas adiadas

Refatorações arquiteturais que exigem sessão dedicada (~23h total estimado):

- **Etapas 9-13** (top-5 do TSC baseline: `price-response.adapter.ts` 61err, `AdminProductFormPage.tsx` 60, `AddressTab.tsx` 56, `BasicDataTab.tsx` 32, `CompareTableView.tsx` 26) — exigem normalizar camelCase ↔ snake_case + null-safe.
- **Etapas 14-16** (top arquivos do ESLint baseline) — auditoria caso-a-caso.
- **Etapa 17** (T-FIX-5b — antipadrão B) — evolução do guard-rail ESLint.

### Impacto mensurável

| Métrica | Antes (2026-05-22) | Depois (2026-05-23) | Δ |
|---|---|---|---|
| `.eslint-baseline.json` (erros) | 473 | 442 | **−31** |
| `.eslint-baseline.json` (arquivos) | 409 | 404 | **−5** |
| Empty catches | 3 | 0 | **−3** |
| `rules-of-hooks` violations | 3 | 0 | **−3** |
| `any` em código de produção | 68 (3 destes) | 65 | **−3** |
| Pendências em `STATUS.md` | 9 | 6 (adiadas) | **−3 fechadas** |
| Issues do post-mortem CRM | 3 | 1 (Issue 3 bloqueada por sponsor) | **−2 fechadas** |
| T-FIX-3 cutoff | 2026-06-02 (10d) | ✅ fechado | **−1 risco** |

### Veredicto pós-correção

A pergunta original — "**todos os bugs e falhas foram corrigidos?**" — continua respondida com **NÃO**, mas:

- ✅ Quick wins fechados (cutoffs eliminados, gates desbloqueados, smells altos atacados)
- ✅ Post-mortem do CRM bridge endereçado (POP + `validateUrlFormat` + testes)
- ✅ Plano explícito para os 9 itens grandes que ficaram (ver `STATUS.md` → *Pendências adiadas*)
- 🟡 1.333 erros TS continuam no baseline (não regrediram, mas só caem com Etapas 9-13)

Próxima ação recomendada: rodar Etapa 13 (`CompareTableView.tsx`) como sessão isolada — é a menor dos top-5 e os 26 erros são todos do mesmo padrão (acesso camelCase a campos snake_case + nullable). Serve de modelo para as Etapas 9-12.
