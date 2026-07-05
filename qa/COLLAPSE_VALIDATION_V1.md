# Validação Exaustiva — Pipeline de Colapso do LocationPanel V1

**Data:** 2026-07-05 · **Método:** análise estática + fuzz determinístico + parse YAML + execução Vitest real.

## Scorecard

| # | Bateria | Cobertura | Resultado |
|---|---------|-----------|-----------|
| B1 | `mask-config.ts` — fuzz 500× env × viewport | 17 asserts + 500 iter property-based | **PASS após fix** — GAP-B1 encontrado |
| B2 | Invariantes React do collapse | 300 iter × 15 checks (`fuzz-configuration-panel-collapse.mjs`) | **PASS** — 4500/4500 |
| B3 | `calibrate-collapse-thresholds.mjs` — análise estática | 5 asserts (dry-run, CSV, defaults) | **PASS** |
| B4 | Workflow CI — parse YAML + ordem dos steps | 15 steps | **PASS** — YAML válido, secrets validados antes dos testes, upload `if: always()` |
| B5 | Scripts npm `e2e:collapse:*` | 9 scripts | **PASS** — `--grep` correto por viewport, `seed` roda setup+all |
| B6 | Spec `collapse-reflow.spec.ts` — análise estática | 3 viewports × 2 screenshots | **PASS** — importa `mask-config`, `waitForStableHeight` antes/depois, `assertBaselineExists` com hint por viewport |
| B7 | `docs/e2e/COLLAPSE_VISUAL_DIFF.md` | seções obrigatórias | **PASS** — cobre threshold, mask, calibração, 6 envs, npm scripts |

## Gap encontrado e corrigido

### 🔴 GAP-B1 (CRÍTICO — CORRIGIDO): env whitespace/vazio virava `threshold=0`

`getThresholds()` usava `Number(process.env[...])` direto. Como
`Number("")` e `Number("   ")` retornam **0** (não `NaN`), o guard
`Number.isFinite(t)` aceitava a leitura, sobrescrevendo o default para
`threshold: 0, maxDiffPixelRatio: 0` — quebrando silenciosamente a
comparação visual se um secret env fosse acidentalmente definido vazio.

**Fix aplicado em** `e2e/customization/mask-config.ts`: nova função
interna `parse(raw, fallback)` que faz `trim()` + guard de string vazia
antes de `Number()`. Coberto pelos 17 asserts do suite Vitest.

## Execução real

```
✓ tests/e2e-customization/mask-config.test.ts        (17 tests) 127ms
✓ scripts/__tests__/calibrate-collapse-thresholds.test.ts (5 tests)  8ms
Test Files  2 passed (2) · Tests 22 passed (22)

Fuzz ConfigurationPanelV6 collapse: 4500/4500 pass, 0 fail
YAML workflow OK — 15 steps na ordem correta
```

## INFO — observações não bloqueantes

- **B4-1** — 3 viewports rodam num único `playwright test` (loop interno via `test.describe`). Matrix paralela por viewport seria melhoria futura (custo 3× runners).
- **B4-2** — `Commit updated baselines` só ativa em `workflow_dispatch` com `update_snapshots=true` (correto).
- **B6-1** — Masks são resolvidos dentro de `test()` → `COLLAPSE_MASK_EXTRA` vale imediatamente sem rebuild.

## Métricas finais

- **Asserts executados:** 22 Vitest + 4.500 fuzz React + 15 checks YAML = **4.537**
- **Bugs REAIS encontrados e corrigidos:** **1** (GAP-B1)
- **Arquivos criados:** 3 (2 test suites + este relatório)
- **Arquivos modificados:** 1 (`e2e/customization/mask-config.ts` — fix do gap)
- **Regressões após fix:** 0

---
*Nenhum arquivo protegido (client.ts, schema Supabase, workflows Gate 0) foi tocado — respeitando REGRA #1/#7 do CLAUDE.md.*
