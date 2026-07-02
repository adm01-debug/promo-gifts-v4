# Quality Gate — Calendar redesign & Quote Conditions visual pipeline

**Data:** 2026-07-02
**Escopo auditado:**
1. `src/components/ui/calendar.tsx` — redesign com tokens semânticos.
2. `e2e/ui/quote-conditions-visual.spec.ts` — hardening (networkidle, `fonts.ready`, animations disabled, caret hide, scale css).
3. `.github/workflows/e2e-quote-conditions-pr-check.yml` — PR check bloqueante.
4. `.github/workflows/e2e-update-quote-conditions-snapshots.yml` — update manual.

## Resultados

| Bateria | Total | Pass | Fail |
|---|---:|---:|---:|
| Unit — `calendar.redesign.test.tsx` (jsdom, incl. fuzz 100×) | 11 | 11 | 0 |
| Contract — `quote-conditions-spec-contract.test.ts` | 6 | 6 | 0 |
| YAML audit — `validate-quote-conditions-workflows.mjs` | 31 checks | 31 | 0 |
| Fuzz tokens — `fuzz-calendar-tokens.mjs` (500 iters) | 500 | 500 | 0 |
| **Total** | **548** | **548** | **0** |

## Cobertura das asserções

### Calendar (unit + fuzz)
- pt-BR: mês "julho" + ano 2026.
- `caption`: `font-semibold + capitalize + tracking-tight`.
- `nav_button`: `rounded-lg h-8 w-8` + `hover:bg-accent`, sem `border-input` (variant outline eliminado).
- `head_cell`: `uppercase + tracking-wider + muted-foreground/70`.
- `day`: `rounded-lg + h-9 w-9` em todos os botões.
- `day_today`: `ring-1 ring-primary/40 text-primary`, sem `bg-accent` sólido.
- `day_selected`: `bg-primary text-primary-foreground shadow-sm rounded-lg`.
- `day_outside`: `muted-foreground/40`.
- Range middle: presença de `rounded-none` no cell wrapper.
- Anti-regressão de cores hard-coded: 0 ocorrências de `bg-white|bg-black|text-white|#hex` em qualquer nó.
- Fuzz 100 renders com `defaultMonth` alternando 2020–2029 × 12 meses × 27 dias — sempre 1 caption por render, texto não vazio, sem exceções.

### Spec E2E (contrato)
- 3 viewports (375/768/1280) presentes.
- `waitForLoadState('networkidle')` + `document.fonts?.ready` + `addStyleTag` com `animation:none / transition:none / caret-color:transparent`.
- `toHaveScreenshot` com `animations: 'disabled'`, `caret: 'hide'`, `scale: 'css'`, `maxDiffPixelRatio: 0.02`.
- Tolerâncias de bounding box ≤ 4px (todas as ocorrências).
- Ordem de foco Validade → Forma → Prazo preservada.

### Workflows (31 checks)
- PR check: trigger `pull_request` main, `paths` cobre spec + baselines + `QuoteBuilderPage.tsx` + `components/quotes/**` + `playwright.config.ts`; `permissions` sem `contents:write`; **sem** `--update-snapshots` (fail-on-diff garantido).
- Update manual: `workflow_dispatch` com input `branch`; `contents:write`; `--update-snapshots`; `git push origin HEAD:${{ inputs.branch }}` (não hardcoded).
- Cache key idêntico entre PR e UP (hit rate consistente).
- Ambos com `concurrency`, `timeout-minutes`, `actions/cache@v4` e sem TABs.

## Gaps encontrados e fechados
1. **Seletores `.rdp-*` inexistentes** após override via `classNames` → refeito o teste usando `aria-current="date"`, `aria-selected="true"` e busca por classes utilitárias verbatim.
2. **`day-outside` falso-positivo** no cell wrapper (contém o seletor `[&:has(...)].day-outside]`) → passou a filtrar apenas `button[name="day"]` com `\bday-outside\b`.
3. **Contract test fora do include do Vitest** (estava em `e2e/ui/__tests__/`) → movido para `tests/contracts/`, path incluído no config global.
4. **Ordem de foco** — índice ambíguo pois `payment-method-select` aparece na constante `SELECT_TIDS` no topo → ajustado para casar `method).toBeFocused` / `terms).toBeFocused` dentro do bloco de foco.

## Nada rodado por design (fora do escopo)
- Playwright real: exige Vite + auth de usuário — os PNGs baseline são gerados pelo workflow manual **E2E · Update Quote Conditions snapshots**.
- `Popover`, `QuoteBuilderPage.tsx` e lógica de negócio: intocados.

## Artefatos
- `src/components/ui/__tests__/calendar.redesign.test.tsx`
- `tests/contracts/quote-conditions-spec-contract.test.ts`
- `scripts/qa/validate-quote-conditions-workflows.mjs`
- `scripts/qa/fuzz-calendar-tokens.mjs`
- `docs/validation/calendar-and-quote-conditions-hardening.md` (este arquivo)
