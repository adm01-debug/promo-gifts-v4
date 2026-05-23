## Sessão de Rebase 2026-05-23 — PRs #125 / #126 / #127

**Contexto:** após merge do PR #124 (PR mestre — 23 commits, fechou Bug #5 + T-FIX-3 + T-FIX-5 + Etapas 23+24), os 3 PRs paralelos que estavam abertos ficaram dirty (`mergeable: false`).

Esta sessão analisou cada um arquivo-por-arquivo contra `main` para distinguir:

- **Redundante**: já mergeado pelo #124 → descartar
- **Regressão**: reverteria #117 ou #118 → descartar
- **Único**: valor real não-coberto pelo #124 → cherry-pick

---

### PR #125 — `fix/ci-green-sut-regressions` (7 commits, 60 arquivos)

**Análise:** maioria dos arquivos era redundante com #124 OU reverteria #117/#118.

**Arquivos com valor único (4):**
1. `src/components/layout/AppLogo.visual.test.tsx` — sidebar `h-9 w-9` → `h-10 w-10`
2. `src/components/quotes/__tests__/QuoteBuilderDiscountAdvanced.test.tsx` — `getByPlaceholderText` → `getByTestId('quote-discount-input')`
3. `src/pages/auth/AuthBranding.test.tsx` — `ContinuousRockets` inlinado em `SpaceScene`
4. `src/pages/auth/AuthBranding.visual.test.tsx` — layout `rounded-3xl` + `px-5` + `h-[88px]`

**Branch substituta:** `chore/pr125-cherry-pick` ([compare](https://github.com/adm01-debug/promo-gifts-v4/compare/main...chore/pr125-cherry-pick))

**Status:** PR #125 fechado · branch pronta para abrir PR via UI

**Ação pendente sponsor:** abrir PR a partir da branch (Claude não tem `github_create_pull_request` via MCP)

---

### PR #126 — `claude/code-bug-analysis-1grNw` (9 commits, 37 arquivos)

**Análise:** 80% redundante com #124. Algumas mudanças reverteriam #117/#118.

**Arquivos com valor único (3):**
1. `supabase/functions/simulation-orchestrator/index.ts` — B-2 CORS migration
2. `supabase/functions/sync-external-db/index.ts` — B-2 CORS migration
3. `docs/AUDITORIA_BUGS_2026-05-23.md` — auditoria forense (922 linhas, distinta da `AUDITORIA-EXAUSTIVA` do #124)

**Branch substituta:** `chore/pr126-cherry-pick` ([compare](https://github.com/adm01-debug/promo-gifts-v4/compare/main...chore/pr126-cherry-pick))

Commits:
- `fa4ccc77` — `fix(edge): migrate inline CORS to buildPublicCorsHeaders helper (#126 B-2)`
- `af8cedb3` — `docs(audit): forensic bug audit reconciling 4 prior audits (#126)`

**Status:** PR #126 fechado · branch pronta para abrir PR via UI

**Decisão sobre B-3 (toast leaks):** baseline `176→179` proposto pelo #126 seria regressão. Manter baseline em 176 + tratar as 3 ocorrências novas em PR dedicado de cleanup (~30 min).

---

### PR #127 — `claude/typescript-eslint-fixes-JvCyY` (6 commits, 46 arquivos, **2987 adições**)

**Análise:** Diferente dos #125/#126 — tem **valor real e único** (não-redundante). Reduz TS `1333 → 1079 (-254)` + ESLint `473 → 417 (-56)`.

**Status:** **DRAFT mantido**. Não posso pushar substituta sem `npm run typecheck` para validar — refactor TS arquitetural em 10 arquivos do top-20 do baseline.

#### Arquivos TS de alto valor (top-10 baseline reduzidos)

| Arquivo | Diff | Reduções |
|---|---:|---:|
| `src/lib/personalization/adapters/price-response.adapter.ts` | +152/-81 | -61 erros TS |
| `src/pages/admin/AdminProductFormPage.tsx` | +154/-153 | -60 erros TS |
| `src/components/admin/products/new-supplier/tabs/AddressTab.tsx` | +3/-2 | -56 erros TS |
| `src/components/admin/products/new-supplier/tabs/BasicDataTab.tsx` | +133/-25 | -32 erros TS |
| `src/components/compare/CompareTableView.tsx` | +374/-132 | -26 erros TS |
| `src/components/admin/connections/SupabaseConnectionsTab.tsx` | +48/-22 | non-null-assertion=17 |
| `src/components/catalog/CatalogContent.tsx` | +68/-47 | unused-vars=16 |
| `src/components/products/ProductQuickView.tsx` | +405/-410 | unused-vars=16 |
| `src/lib/external-db/product-types.ts` | +92/-9 | (novos shared types) |
| `src/types/domain/simulator-wizard.ts` | +46/-42 | (refactor types) |

#### Observações sobre testes do #127 (DIFERENTE de #125/#126!)

- ✅ `tests/admin/reduced-app-navigation.test.tsx`: ADICIONA `/login` sem remover `/auth` (estratégia "aceita ambas") — **NÃO É REGRESSÃO**
- ✅ `tests/admin/route-no-error-element.test.tsx`: idem
- ❌ `tests/components/quotes/AIRecommendationsPanel.test.tsx`: reverteria #118 — **DESCARTAR este arquivo**

#### Sobreposição com `chore/pr125-cherry-pick`

4 arquivos de teste já estão em `chore/pr125-cherry-pick` com versão ligeiramente diferente:
- `AppLogo.visual.test.tsx` (#127 quebra `h-10 w-10` em 2 asserts; #125 mantém junto)
- `QuoteBuilderDiscountAdvanced.test.tsx` (versões muito próximas)
- `AuthBranding.test.tsx` (#127 e #125 têm refactors DIFERENTES — **decisão pendente**)
- `AuthBranding.visual.test.tsx` (idem)

#### Plano para retomada (sessão dedicada, estimativa 3-5h)

1. Clone fresh + `npm ci --no-audit` (~5 min)
2. Para cada arquivo TS principal (10 arquivos acima):
   - Aplicar fix do #127 individualmente
   - Rodar `npm run typecheck` — validar delta esperado
   - Se OK: micro-PR cirúrgico com 1-3 arquivos
3. Excluir explicitamente: `AIRecommendationsPanel.test.tsx`
4. Resolver conflito com `chore/pr125-cherry-pick` (qual versão dos 4 testes é canônica)

---

## Próximas ações do sponsor

1. **Abrir PR a partir de `chore/pr125-cherry-pick`** (5 min, UI)
2. **Abrir PR a partir de `chore/pr126-cherry-pick`** (5 min, UI)
3. **PR de cleanup B-3 toast leaks** (3 ocorrências novas vs baseline) — 30 min
4. **Sessão dedicada para #127** (lab local, 3-5h) — **maior risco**, maior payoff
5. **T-FIX-5 manual** (5 min): `mv eslint.config.t-fix-5.proposed.js eslint.config.js` + `npm pkg set` + commit
6. **Issues #119-#123** (NotificationDrawer / DevRoute / AdminConexoesAccess pre-existing failures): fechar como "resolved by #124 Etapas 23+24"

---

## Limitação técnica descoberta nesta sessão

O MCP `GITHUB - MCP - FOREVER` **NÃO expõe `github_create_pull_request`**. Pode:
- ✅ Criar/atualizar branches (`github_create_branch`, `github_push_files`)
- ✅ Comentar e fechar PRs
- ❌ Criar PRs novos — precisa UI ou `gh pr create` com credenciais válidas

Por isso as branches `chore/pr125-cherry-pick` e `chore/pr126-cherry-pick` estão prontas no remote mas sem PR vinculado — sponsor abre via UI em 1 clique cada.

---

## Lições aprendidas (adicionadas à memória)

1. **Diff invertido contra `origin/main` é sinal de PR obsoleto** — quando um PR mostra `--- file ---` aparecendo como deleção e fonte como adição, ele está revertendo um merge intermediário
2. **PR mestre absorve trabalho paralelo** — depois que um PR grande (#124) é mergeado, todos os PRs paralelos precisam re-análise individual arquivo-por-arquivo
3. **Cherry-pick > rebase quando há muita sobreposição** — replay de 7 commits via `git rebase` perderia tempo; melhor identificar 4 arquivos únicos e aplicar via `git checkout pr-branch -- arquivo` em branch limpa do main
4. **Volume × risco** — fixes TS de refactor (volume ≥ 1000 linhas) precisam validação local; fixes de teste (volume < 100 linhas) podem ir direto via MCP

🤖 _Sessão executada 2026-05-23 por Claude. Próxima sessão deve consultar este doc primeiro._
