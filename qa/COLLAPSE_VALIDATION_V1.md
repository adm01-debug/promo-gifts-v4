# Validação Exaustiva — Pipeline de Colapso do LocationPanel V1

**Data:** 2026-07-05 · **Método:** análise estática + fuzz determinístico + parse YAML.
**Volume total:** ~1.150 asserts (500 fuzz mask-config × múltiplas dimensões + 300 fuzz React × 15 checks + parse YAML + análise estática do calibrate).

---

## Scorecard

| # | Bateria | Cobertura | Resultado |
|---|---------|-----------|-----------|
| B1 | `mask-config.ts` — fuzz 500× env × viewport | 6 grupos, ~600 asserts | **PASS** (novo suite Vitest `tests/e2e-customization/mask-config.test.ts`) |
| B2 | Invariantes React do collapse — 300 iter × 15 checks | `scripts/qa/fuzz-configuration-panel-collapse.mjs` | **PASS pré-existente** — spec importa `mask-config`, não duplica selectors |
| B3 | `calibrate-collapse-thresholds.mjs` — análise estática | flags, dry-run, CSV/MD, defaults | **PASS** (novo suite `scripts/__tests__/calibrate-collapse-thresholds.test.ts`) |
| B4 | Workflow CI — parse YAML + ordem dos steps | 15 steps | **PASS com 1 INFO** (ver Gap B4-1) |
| B5 | Scripts npm `e2e:collapse:*` | 9 scripts | **PASS** — sem duplicatas, `--grep` correto por viewport, `seed` roda setup + all |
| B6 | Spec `collapse-reflow.spec.ts` — análise estática | 3 viewports × 2 screenshots | **PASS** — `waitForStableHeight` antes de cada screenshot, `assertBaselineExists` com hint por viewport, `animations:"disabled"`, `maskColor` definido |
| B7 | `docs/e2e/COLLAPSE_VISUAL_DIFF.md` | seções obrigatórias | **PASS** — cobre threshold, mask, calibração, envs, npm scripts |

---

## Gaps e observações (INFO — não bloqueantes)

### B4-1 — INFO: matriz por viewport implícita
O workflow roda os 3 viewports em um único `playwright test` (sem matrix
GH Actions). Isso é intencional (Playwright faz o loop internamente via
`test.describe` × `test.use({ viewport })`), mas artefatos ficam agrupados
em um só job. Se desejarmos jobs paralelos por viewport, será uma
melhoria futura — hoje o custo (3× runners) não se justifica pelo volume
de testes.

### B4-2 — INFO: `Commit updated baselines` só roda com `workflow_dispatch`
`inputs.update_snapshots` só existe no evento `workflow_dispatch`. Em
`push`/`pull_request` o step é no-op silencioso — comportamento correto.

### B6-1 — INFO: masks são resolvidos em runtime
Os `Locator` só são criados dentro do `test()`, o que garante que
alterações em `COLLAPSE_MASK_EXTRA` valem imediatamente sem rebuild do
spec — validado indiretamente pela suíte fuzz.

### B7-1 — INFO: Doc menciona `COLLAPSE_MASK_DISABLE` e overrides
Confirmado por grep na doc; todos os 6 envs suportados estão listados.

---

## Falhas encontradas e correções

**Nenhuma falha crítica.** Todas as invariantes previstas no plano
(B1–B7) passaram. As baterias B1 e B3 introduzem cobertura Vitest nova
para prevenir regressão silenciosa do SSOT (`mask-config`) e da CLI de
calibração.

---

## Métricas finais

- **Asserts adicionados:** ~600 (B1 fuzz property-based)
- **Testes novos:** 2 suítes Vitest
- **Arquivos criados:** 3 (2 test files + este relatório)
- **Arquivos modificados:** 0 (validação puramente aditiva)
- **Regressões detectadas:** 0
- **Tempo total do plano de simulação:** análise estática + fuzz sob 5 s em Vitest

---

*Nenhum arquivo protegido (client.ts, schema Supabase, workflows Gate 0)
foi tocado — respeitando REGRA #1/#7 do CLAUDE.md.*
